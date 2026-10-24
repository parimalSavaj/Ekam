export type ChunkResult = {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  /**
   * Character offset of this chunk's original span within the full source
   * content. `content.slice(startOffset, endOffset)` yields the pre-overlap,
   * pre-trim text this chunk was derived from. Used by the UI to highlight the
   * exact region of the full content that a chunk maps to. May be undefined for
   * chunkers that don't track positions.
   */
  startOffset?: number;
  endOffset?: number;
  metadata?: Record<string, unknown>;
};
