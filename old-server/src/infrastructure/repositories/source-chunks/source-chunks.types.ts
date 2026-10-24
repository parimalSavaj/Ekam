export type SourceChunkRow = {
  id: string;
  source_id: string;
  notebook_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  start_offset: number | null;
  end_offset: number | null;
  embedding: string;
  created_at: Date;
};

/**
 * A source_chunks row without the heavy `embedding` vector — used when reading
 * chunks for display (e.g. the content viewer's hover-to-highlight).
 */
export type SourceChunkContentRow = {
  id: string;
  source_id: string;
  notebook_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  start_offset: number | null;
  end_offset: number | null;
  created_at: Date;
};
