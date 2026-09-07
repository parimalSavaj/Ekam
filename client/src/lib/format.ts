import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

/**
 * Formatting helpers so screens can show real, readable metadata
 * (relative times, compact counts, file sizes) instead of raw values.
 */

/** "2 days ago", "5 min ago". Falls back to an em dash for missing dates. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return `${formatDistanceToNowStrict(date, { addSuffix: false })} ago`;
}

/** Absolute date for tooltips, e.g. "12 Mar 2026, 14:08". */
export function absoluteDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = parseISO(value);
  if (!isValid(date)) return "Unknown";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Thousands-separated integer, e.g. 8400 -> "8,400". */
export function formatCount(value: number): string {
  return value.toLocaleString();
}

/** Human file size, e.g. 1536000 -> "1.5 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const size = bytes / 1024 ** exponent;
  return `${size.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Pluralises a noun against a count, e.g. (1, "source") -> "1 source". */
export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
