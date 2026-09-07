import type { Source } from "@/lib/api";

/**
 * Single source of truth for how a source's type and processing status are
 * described. Previously these maps were duplicated across source-item,
 * all-sources-view, and source-content-view, which let them drift apart.
 *
 * Icon rendering lives in `components/notebook/source-icons.tsx` — keeping
 * components out of this module avoids resolving a component from a lookup
 * table during render.
 */

export const sourceTypeLabels: Record<Source["type"], string> = {
  text: "Text",
  markdown: "Markdown",
  pdf: "PDF",
  url: "Website",
  youtube: "YouTube",
};

export type SourceStatusMeta = {
  label: string;
  /** Tinted pill styling for badge-style status display. */
  badgeClassName: string;
};

export const sourceStatusMeta: Record<Source["status"], SourceStatusMeta> = {
  pending: {
    label: "Pending",
    badgeClassName: "bg-warning/12 text-warning",
  },
  processing: {
    label: "Processing",
    badgeClassName: "bg-info/12 text-info",
  },
  completed: {
    label: "Ready",
    badgeClassName: "bg-success/12 text-success",
  },
  failed: {
    label: "Failed",
    badgeClassName: "bg-destructive/12 text-destructive",
  },
};

export function getSourceStatusMeta(status: Source["status"]): SourceStatusMeta {
  return sourceStatusMeta[status] ?? sourceStatusMeta.pending;
}

/** Human-readable summary line for a source, e.g. "12 chunks · 8,400 chars". */
export function formatSourceStats(source: Source, compact = false): string {
  if (source.status !== "completed") {
    return getSourceStatusMeta(source.status).label;
  }
  const chunks = `${source.chunkCount} ${source.chunkCount === 1 ? "chunk" : "chunks"}`;
  if (compact) return chunks;
  return `${chunks} · ${source.charCount.toLocaleString()} chars`;
}
