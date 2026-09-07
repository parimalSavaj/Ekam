-- Migration: add-source-chunk-offsets
-- Created at: 2026-08-26T12:00:00.000Z

-- Add character-offset columns to source_chunks so the UI can map each chunk
-- back to an exact range within the full source content (source_contents.content).
-- These are the pre-overlap, pre-trim segment boundaries into the stored content:
--   content.slice(start_offset, end_offset) === the chunk's original text span.
-- Nullable because rows created before this migration have no recorded offsets.
ALTER TABLE source_chunks
  ADD COLUMN IF NOT EXISTS start_offset INTEGER,
  ADD COLUMN IF NOT EXISTS end_offset INTEGER;
