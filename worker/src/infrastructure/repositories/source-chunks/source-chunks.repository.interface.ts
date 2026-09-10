import { PoolClient } from "pg";
import { SourceChunkRow, SourceChunkContentRow } from "./source-chunks.types.ts";

export interface ISourceChunksRepository {
  createMany(chunks: {
    id: string;
    sourceId: string;
    notebookId: string;
    content: string;
    chunkIndex: number;
    tokenCount: number;
    startOffset: number | null;
    endOffset: number | null;
    embedding: number[];
  }[], client?: PoolClient): Promise<void>;
  deleteBySourceId(sourceId: string, client?: PoolClient): Promise<void>;
  deleteByNotebookId(notebookId: string, client?: PoolClient): Promise<void>;
  searchByEmbedding(notebookId: string, embedding: number[], limit: number): Promise<(SourceChunkRow & { similarity: number })[]>;
  /**
   * Returns all chunks for a source ordered by chunk_index, excluding the heavy
   * embedding vector. Used by the content viewer to map chunks onto the full text.
   */
  findBySourceId(sourceId: string): Promise<SourceChunkContentRow[]>;
}
