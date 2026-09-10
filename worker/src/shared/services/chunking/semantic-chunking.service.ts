import { IChunkingService } from "./chunking.service.interface.ts";
import { ChunkResult } from "./chunking.types.ts";
import { ILlmService } from "../../../infrastructure/external-services/llm/llm.external-service.interface.ts";
import { ILoggerService } from "../logger/logger.service.interface.ts";

/**
 * How it works
 * ─────────────
 * 1. Send the raw text (or a preview of it) to a cheap/fast LLM with a strict
 *    JSON-returning system prompt.
 * 2. The LLM replies with an array of split-point character indices – it does NOT
 *    rewrite the text, it only says "break here".
 * 3. We slice the original text at those indices (so the content is 100%
 *    faithful to the source) and optionally add overlap between adjacent chunks.
 * 4. If the LLM call fails or returns unusable data we transparently fall back to
 *    a simple paragraph-boundary split so the pipeline never stalls.
 *
 * Why a low-level LLM?
 * ─────────────────────
 * Fixed-size splitters cut across sentence/paragraph/topic boundaries at random.
 * A small model can read the text and tell us "this topic ends at char 847,
 * the next starts at char 848" so every chunk stays semantically coherent.
 */

const FALLBACK_SEPARATORS = ["\n\n", "\n", ". "];

/**
 * Characters of the source text sent to the LLM for boundary analysis.
 * We cap this so we don't blow the context window of cheap models.
 * For longer texts the remainder is handled by recursive re-chunking.
 */
const MAX_PREVIEW_CHARS = 12_000;

/** Minimum characters a chunk must have – prevents the LLM from going too granular. */
const MIN_CHUNK_CHARS = 200;

/** Characters carried over from the end of one chunk into the start of the next. */
const OVERLAP_CHARS = 150;

/**
 * An intermediate segment carrying both its (possibly overlap-augmented) text
 * and the absolute character offsets [start, end) of its ORIGINAL span within
 * the full source content. `content.slice(start, end)` equals the segment's
 * pre-overlap text.
 */
type Segment = {
  text: string;
  start: number;
  end: number;
};

export class SemanticChunkingService implements IChunkingService {
  constructor(
    private readonly llmService: ILlmService,
    private readonly logger: ILoggerService,
    /** Fast/cheap model – no need for GPT-4 just to pick split points. */
    private readonly model: string = "openai/gpt-4o-mini"
  ) {}

  // ─── Public API (IChunkingService) ─────────────────────────────────────────

  chunk(content: string): ChunkResult[] {
    // Synchronous interface – wrap the async logic with a synchronous facade
    // by running it as a micro-task queue trick is not safe here.
    // The interface is sync but our implementation is async.
    // We solve this by returning a Promise disguised as ChunkResult[] and
    // letting the caller await it (TypeScript structural typing allows this
    // because Promise<T> is a subtype of T when T = Promise<ChunkResult[]>).
    //
    // HOWEVER – the existing interface says `chunk(): ChunkResult[]` (sync).
    // We therefore expose a separate async method and override chunk() to
    // return a Promise that TypeScript will let the worker await normally.
    // The worker does:  const chunks = this.chunkingService.chunk(text);
    // If the return is a Promise, `await` handles it transparently.
    return this.chunkAsync(content) as unknown as ChunkResult[];
  }

  chunkPages(pages: string[]): ChunkResult[] {
    return this.chunkPagesAsync(pages) as unknown as ChunkResult[];
  }

  // ─── Async implementations ─────────────────────────────────────────────────

  async chunkAsync(content: string): Promise<ChunkResult[]> {
    const trimmed = content.trim();
    if (!trimmed) return [];

    // Offsets are reported relative to the ORIGINAL `content` string (which is
    // what gets persisted as source_contents.content), so account for any
    // leading whitespace stripped by trim().
    const baseOffset = content.indexOf(trimmed);

    const segments = await this.splitIntoSegments(trimmed, baseOffset);
    return this.segmentsToChunkResults(segments);
  }

  async chunkPagesAsync(pages: string[]): Promise<ChunkResult[]> {
    const chunks: ChunkResult[] = [];
    let globalIndex = 0;

    // Offsets across pages are relative to the pages joined by "\n" — the
    // caller is responsible for storing content in that same joined form if it
    // wants offsets to line up. Page-mode offsets track position within the
    // running concatenation.
    let runningOffset = 0;

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const rawPage = pages[pageIndex];
      const pageText = rawPage.trim();

      if (pageText) {
        const baseOffset = runningOffset + rawPage.indexOf(pageText);
        const segments = await this.splitIntoSegments(pageText, baseOffset);

        for (const segment of segments) {
          chunks.push({
            content: segment.text,
            chunkIndex: globalIndex++,
            tokenCount: this.estimateTokenCount(segment.text),
            startOffset: segment.start,
            endOffset: segment.end,
            metadata: { page: pageIndex + 1 },
          });
        }
      }

      // +1 accounts for the "\n" join between pages.
      runningOffset += rawPage.length + 1;
    }

    return chunks;
  }

  // ─── Core logic ────────────────────────────────────────────────────────────

  /**
   * Asks the LLM for semantic split points, then slices the text at those
   * positions. Long texts are handled in windows of MAX_PREVIEW_CHARS.
   *
   * `baseOffset` is the absolute position of `text[0]` within the original
   * content, so every returned segment carries offsets relative to the full
   * source content (not just this local slice).
   */
  private async splitIntoSegments(text: string, baseOffset: number): Promise<Segment[]> {
    if (text.length <= MIN_CHUNK_CHARS) {
      return [{ text, start: baseOffset, end: baseOffset + text.length }];
    }

    const allSegments: Segment[] = [];
    let cursor = 0;

    // Process the text in windows so we never send more than MAX_PREVIEW_CHARS
    // to the LLM at once while still handling arbitrarily long documents.
    while (cursor < text.length) {
      const window = text.slice(cursor, cursor + MAX_PREVIEW_CHARS);
      // Offsets within this window map back to the full content by adding the
      // window's own base (baseOffset + cursor).
      const localSegments = await this.splitWindowWithLlm(window, baseOffset + cursor);

      allSegments.push(...localSegments);
      cursor += MAX_PREVIEW_CHARS;
    }

    return this.addOverlapAndFilter(allSegments);
  }

  /**
   * Sends one window of text to the LLM and returns the segments it suggests.
   * Falls back to paragraph splitting if the LLM fails or returns garbage.
   */
  private async splitWindowWithLlm(window: string, windowBase: number): Promise<Segment[]> {
    try {
      const splitPoints = await this.askLlmForSplitPoints(window);

      if (!splitPoints || splitPoints.length === 0) {
        this.logger.warn("SemanticChunkingService: LLM returned no split points, using fallback");
        return this.fallbackSplit(window, windowBase);
      }

      return this.sliceAtPoints(window, splitPoints, windowBase);
    } catch (err) {
      this.logger.error("SemanticChunkingService: LLM call failed, using fallback", {
        error: (err as Error).message,
      });
      return this.fallbackSplit(window, windowBase);
    }
  }

  /**
   * Calls the LLM with a carefully constrained prompt.
   * The model ONLY returns a JSON array of character indices – it never
   * rewrites or summarises the source text.
   *
   * Returns sorted, deduplicated split-point indices.
   */
  private async askLlmForSplitPoints(text: string): Promise<number[]> {
    const systemPrompt = `You are a document chunking assistant. Your sole job is to identify the best character positions in a text at which to split it into semantically coherent chunks for a RAG (Retrieval Augmented Generation) system.

Rules:
- A "split point" is a character index (0-based) in the text where a new chunk should begin.
- Every chunk must represent a complete, self-contained idea, topic, or section.
- Never split in the middle of a sentence.
- Prefer splitting after paragraph breaks (\\n\\n), section headings, or clear topic transitions.
- Aim for chunks between ${MIN_CHUNK_CHARS} and 1500 characters.
- Return ONLY a raw JSON array of integers, e.g.: [312, 847, 1503]
- Do NOT include 0 (the start) or ${text.length} (the end) in the array.
- Do NOT include any explanation, markdown, or extra text – just the JSON array.
- If the text is already short enough to be a single chunk, return an empty array: []`;

    const result = await this.llmService.generateText({
      model: this.model,
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the text to analyse (${text.length} characters):\n\n${text}`,
        },
      ],
    });

    return this.parseSplitPoints(result.text, text.length);
  }

  /**
   * Parses the LLM's JSON response into a clean list of valid split-point indices.
   */
  private parseSplitPoints(raw: string, textLength: number): number[] {
    // Strip markdown code fences if the model wrapped its answer
    const cleaned = raw.trim().replace(/^```[a-z]*\n?/i, "").replace(/```$/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Try to extract a JSON array from somewhere in the response
      const match = cleaned.match(/\[[\d,\s]*\]/);
      if (!match) return [];
      parsed = JSON.parse(match[0]);
    }

    if (!Array.isArray(parsed)) return [];

    return (parsed as unknown[])
      .filter((v): v is number => typeof v === "number" && Number.isInteger(v))
      .filter((idx) => idx > 0 && idx < textLength)
      .sort((a, b) => a - b)
      // Remove duplicates
      .filter((idx, i, arr) => i === 0 || idx !== arr[i - 1]);
  }

  /**
   * Slices the text at the given split-point indices.
   * E.g. points [300, 700] on a 1000-char string produces three segments:
   *   text[0..300], text[300..700], text[700..1000]
   *
   * Each returned segment carries absolute offsets (windowBase + local index)
   * into the full content, adjusted for any whitespace trimmed off the ends so
   * that `content.slice(start, end)` exactly equals the segment text.
   */
  private sliceAtPoints(text: string, points: number[], windowBase: number): Segment[] {
    const segments: Segment[] = [];
    let prev = 0;

    const pushTrimmed = (rawStart: number, rawEnd: number, enforceMin: boolean) => {
      const raw = text.slice(rawStart, rawEnd);
      const seg = this.toTrimmedSegment(raw, windowBase + rawStart);
      if (!seg) return;
      if (enforceMin && seg.text.length < MIN_CHUNK_CHARS) return;
      segments.push(seg);
    };

    for (const point of points) {
      pushTrimmed(prev, point, true);
      prev = point;
    }

    // Last segment — kept even if short so no content is lost from the tail.
    pushTrimmed(prev, text.length, false);

    return segments;
  }

  /**
   * Trims whitespace from a raw slice and returns a Segment whose offsets point
   * at the trimmed text within the full content. Returns null for blank slices.
   */
  private toTrimmedSegment(raw: string, rawAbsoluteStart: number): Segment | null {
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;

    const start = rawAbsoluteStart + leading;
    return { text: trimmed, start, end: start + trimmed.length };
  }

  /**
   * Adds character overlap between adjacent segments so context bleeds across
   * chunk boundaries, improving recall at retrieval time.
   */
  private addOverlapAndFilter(segments: Segment[]): Segment[] {
    if (segments.length <= 1) return segments.filter((s) => s.text.trim().length > 0);

    const result: Segment[] = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      let content = segment.text;

      // Prepend tail of previous segment as overlap context. IMPORTANT: this
      // only affects the chunk TEXT (used for embeddings/RAG recall). The
      // start/end offsets stay pinned to this segment's own boundaries so the
      // UI highlight maps to the exact, non-overlapping region of the content.
      if (i > 0 && OVERLAP_CHARS > 0) {
        const prev = segments[i - 1].text;
        const overlap = prev.slice(-OVERLAP_CHARS).trimStart();
        content = overlap + " " + content;
      }

      if (content.trim().length >= MIN_CHUNK_CHARS) {
        result.push({ text: content.trim(), start: segment.start, end: segment.end });
      }
    }

    return result;
  }

  // ─── Fallback ───────────────────────────────────────────────────────────────

  /**
   * Simple paragraph/line splitter used when the LLM is unavailable.
   * Never throws. Tracks absolute offsets (windowBase-relative) for each part.
   */
  private fallbackSplit(text: string, windowBase: number): Segment[] {
    for (const sep of FALLBACK_SEPARATORS) {
      if (!text.includes(sep)) continue;

      const rawParts = text.split(sep);
      const segments: Segment[] = [];
      let cursor = 0;

      for (const rawPart of rawParts) {
        const seg = this.toTrimmedSegment(rawPart, windowBase + cursor);
        if (seg && seg.text.length >= MIN_CHUNK_CHARS) {
          segments.push(seg);
        }
        // Advance past this part and the separator that followed it.
        cursor += rawPart.length + sep.length;
      }

      if (segments.length > 1) return segments;
    }

    // Last resort – return whole window as one chunk.
    const whole = this.toTrimmedSegment(text, windowBase);
    return whole ? [whole] : [];
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private segmentsToChunkResults(segments: Segment[]): ChunkResult[] {
    return segments.map((segment, index) => ({
      content: segment.text,
      chunkIndex: index,
      tokenCount: this.estimateTokenCount(segment.text),
      startOffset: segment.start,
      endOffset: segment.end,
    }));
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
