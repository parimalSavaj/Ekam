"use client";

import { useMemo, useState } from "react";
import { useSourceContent } from "@/hooks/use-sources";
import { SourceChunk } from "@/lib/api";
import { SourceTypeIcon } from "./source-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";

interface SourceContentViewProps {
  notebookId: string;
  sourceId: string;
  onBack: () => void;
}

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

export function SourceContentView({
  notebookId,
  sourceId,
  onBack,
}: SourceContentViewProps) {
  const { data, isLoading, isError, error } = useSourceContent(notebookId, sourceId);
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null);

  // Read these into locals so the memo dependencies match exactly what the
  // callback reads (optional-chained deps confuse the compiler's inference).
  const content = data?.content ?? null;
  const chunks = data?.chunks;

  const segments = useMemo(() => {
    if (!content) return [];
    return buildSegments(content, chunks ?? []);
  }, [content, chunks]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b px-6 py-3.5">
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            onClick={onBack}
            aria-label="Back to all sources"
          >
            <ArrowLeft />
          </TooltipTrigger>
          <TooltipContent>Back to all sources</TooltipContent>
        </Tooltip>

        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground">
          {data ? (
            <SourceTypeIcon type={data.type} className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-heading text-base font-semibold tracking-tight">
            {data?.title ?? "Source"}
          </h2>
          {data && (
            <p className="text-xs text-muted-foreground">
              {data.chunkCount} {data.chunkCount === 1 ? "chunk" : "chunks"} ·{" "}
              {data.charCount.toLocaleString()} chars
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="mx-auto max-w-3xl space-y-3">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-11 rounded-xl bg-destructive/10 text-destructive"
              >
                <AlertCircle className="size-5" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                Could not load source content
              </EmptyTitle>
              <EmptyDescription>
                {error instanceof Error ? error.message : "Something went wrong"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !data?.content ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-11 rounded-xl">
                <FileText className="size-5" />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                {data && data.status !== "completed"
                  ? "Still processing"
                  : "No content available"}
              </EmptyTitle>
              <EmptyDescription>
                {data && data.status !== "completed"
                  ? "This source is still being processed. Content will appear once it's ready."
                  : "There's no readable content stored for this source."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-xs text-muted-foreground">
              Hover over the text to highlight the chunk it belongs to.
            </p>

            <div className="text-sm leading-relaxed text-foreground/90">
              {segments.map((seg) =>
                seg.chunk ? (
                  <div
                    key={seg.key}
                    data-chunk-id={seg.chunk.id}
                    onMouseEnter={() => setHoveredChunkId(seg.chunk!.id)}
                    onMouseLeave={() =>
                      setHoveredChunkId((prev) =>
                        prev === seg.chunk!.id ? null : prev
                      )
                    }
                    className={cn(
                      "relative cursor-pointer rounded-lg border px-3 py-2 whitespace-pre-wrap break-words transition-colors",
                      hoveredChunkId === seg.chunk.id
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-transparent"
                    )}
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
                  <div
                    key={seg.key}
                    className="px-3 whitespace-pre-wrap break-words"
                  >
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
