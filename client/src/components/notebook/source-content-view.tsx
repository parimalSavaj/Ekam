"use client";

import { useMemo, useState } from "react";
import { useSourceContent } from "@/hooks/use-sources";
import { SourceChunk } from "@/lib/api";
import {
  ArrowLeft,
  FileText,
  Hash,
  File,
  Globe,
  Film,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface SourceContentViewProps {
  notebookId: string;
  sourceId: string;
  onBack: () => void;
}

const typeIcons = {
  text: FileText,
  markdown: Hash,
  pdf: File,
  url: Globe,
  youtube: Film,
} as const;

/**
 * A rendered piece of the full content. `chunk` is set when the segment maps to
 * a specific chunk (hoverable/highlightable); null for gaps between chunks.
 */
type ContentSegment = {
  key: string;
  text: string;
  chunk: SourceChunk | null;
};

/**
 * Resolves a [start, end) span in the full content for every chunk.
 *
 * Preferred: use the persisted character offsets when present.
 * Fallback: when offsets are missing (legacy rows), locate each chunk's content
 * inside the full text sequentially. Because chunks may carry overlap text at
 * their edges, we match against the chunk's own words progressively and, when an
 * exact match fails, fall back to anchoring on the first meaningful slice of the
 * chunk. This lets inline hover-highlighting work even without stored offsets.
 */
function resolveChunkSpans(
  content: string,
  chunks: SourceChunk[]
): { chunk: SourceChunk; start: number; end: number }[] {
  const spans: { chunk: SourceChunk; start: number; end: number }[] = [];
  let searchFrom = 0;

  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

  for (const chunk of ordered) {
    // 1) Trust stored offsets when we have them.
    if (
      chunk.startOffset !== null &&
      chunk.endOffset !== null &&
      chunk.endOffset > chunk.startOffset
    ) {
      spans.push({
        chunk,
        start: Math.max(0, chunk.startOffset),
        end: Math.min(content.length, chunk.endOffset),
      });
      continue;
    }

    // 2) Fallback: find the chunk text within the content from where we left off.
    const needle = chunk.content.trim();
    if (!needle) continue;

    let idx = content.indexOf(needle, searchFrom);
    let matchLen = needle.length;

    // Overlap or trimming can prevent an exact match. Anchor on a leading slice.
    if (idx === -1) {
      const anchor = needle.slice(0, Math.min(needle.length, 60)).trim();
      idx = anchor ? content.indexOf(anchor, searchFrom) : -1;
      matchLen = anchor.length;
    }

    if (idx === -1) continue;

    const start = idx;
    const end = Math.min(content.length, idx + matchLen);
    spans.push({ chunk, start, end });
    searchFrom = end;
  }

  return spans;
}

/**
 * Builds an ordered list of segments covering the ENTIRE content string. Regions
 * not covered by any chunk are emitted as plain (non-highlightable) gap segments
 * so no text is ever dropped. Overlapping spans are clamped so each character
 * belongs to at most one chunk.
 */
function buildSegments(content: string, chunks: SourceChunk[]): ContentSegment[] {
  const spans = resolveChunkSpans(content, chunks).sort((a, b) => a.start - b.start);

  const segments: ContentSegment[] = [];
  let cursor = 0;

  for (const { chunk, start: rawStart, end: rawEnd } of spans) {
    const start = Math.max(rawStart, cursor);
    const end = Math.min(rawEnd, content.length);
    if (end <= start) continue;

    // Emit any uncovered gap before this chunk as plain text.
    if (start > cursor) {
      segments.push({
        key: `gap-${cursor}`,
        text: content.slice(cursor, start),
        chunk: null,
      });
    }

    segments.push({
      key: `chunk-${chunk.id}`,
      text: content.slice(start, end),
      chunk,
    });

    cursor = end;
  }

  // Trailing gap after the last chunk.
  if (cursor < content.length) {
    segments.push({
      key: `gap-${cursor}`,
      text: content.slice(cursor),
      chunk: null,
    });
  }

  return segments;
}

export function SourceContentView({ notebookId, sourceId, onBack }: SourceContentViewProps) {
  const { data, isLoading, isError, error } = useSourceContent(notebookId, sourceId);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);

  const segments = useMemo(() => {
    if (!data?.content) return [];
    return buildSegments(data.content, data.chunks);
  }, [data?.content, data?.chunks]);

  const TypeIcon = data ? typeIcons[data.type] ?? FileText : FileText;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/20 px-6 py-4 dark:border-white/10">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-[#0d2847]/50 transition-colors hover:bg-[#0d2847]/5 hover:text-[#0d2847] dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#0d2847]/5 dark:bg-white/10">
          <TypeIcon className="h-4.5 w-4.5 text-[#0d2847]/60 dark:text-white/60" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-[#0d2847] dark:text-white">
            {data?.title ?? "Source"}
          </h2>
          {data && (
            <p className="text-xs text-[#0d2847]/50 dark:text-white/40">
              {data.chunkCount} {data.chunkCount === 1 ? "chunk" : "chunks"} ·{" "}
              {data.charCount.toLocaleString()} chars
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-[#0d2847]/40 dark:text-white/30">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <p className="text-sm font-medium text-[#0d2847] dark:text-white">
              Could not load source content
            </p>
            <p className="text-xs text-[#0d2847]/50 dark:text-white/40">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          </div>
        ) : !data?.content ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <FileText className="h-6 w-6 text-[#0d2847]/30 dark:text-white/20" />
            <p className="text-sm text-[#0d2847]/50 dark:text-white/40">
              {data && data.status !== "completed"
                ? "This source is still processing. Content will appear once it's ready."
                : "No content available for this source."}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-xs text-[#0d2847]/40 dark:text-white/30">
              Hover over the text to highlight the chunk it belongs to.
            </p>
            <div className="text-sm leading-relaxed text-[#0d2847]/90 dark:text-white/80">
              {segments.map((seg) =>
                seg.chunk ? (
                  <div
                    key={seg.key}
                    data-chunk-id={seg.chunk.id}
                    onMouseEnter={() => setHoveredChunkId(seg.chunk!.id)}
                    onMouseLeave={() =>
                      setHoveredChunkId((prev) => (prev === seg.chunk!.id ? null : prev))
                    }
                    className={`relative cursor-pointer whitespace-pre-wrap break-words rounded-lg border px-3 py-2 transition-colors ${
                      hoveredChunkId === seg.chunk.id
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-transparent"
                    }`}
                  >
                    {/* Chunk-number popup */}
                    {hoveredChunkId === seg.chunk.id && (
                      <span className="pointer-events-none absolute -top-2.5 left-3 z-10 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground shadow-md">
                        Chunk #{seg.chunk.chunkIndex + 1}
                      </span>
                    )}
                    {seg.text}
                  </div>
                ) : (
                  <div key={seg.key} className="whitespace-pre-wrap break-words px-3">
                    {seg.text}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
