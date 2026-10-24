import { Request } from "express";
import { SourceChunkContentRow } from "../../../../infrastructure/repositories/source-chunks/source-chunks.types.ts";

export class GetSourceContentRequestDto {
  id: string;
  notebookId: string;
  userId: string;

  private constructor(props: { id: string; notebookId: string; userId: string }) {
    this.id = props.id;
    this.notebookId = props.notebookId;
    this.userId = props.userId;
  }

  static fromRequest(req: Request): GetSourceContentRequestDto {
    return new GetSourceContentRequestDto({
      id: req.params.id as string,
      notebookId: req.params.notebookId as string,
      userId: req.user!.id,
    });
  }
}

export interface SourceChunkDto {
  id: string;
  chunkIndex: number;
  content: string;
  /**
   * Character offsets into `content` (the full source text). When present,
   * `content.slice(startOffset, endOffset)` is the exact span this chunk maps
   * to. Null for chunks created before offset tracking existed.
   */
  startOffset: number | null;
  endOffset: number | null;
}

export class GetSourceContentResponseDto {
  id: string;
  title: string;
  type: string;
  status: string;
  charCount: number;
  chunkCount: number;
  content: string | null;
  chunks: SourceChunkDto[];

  private constructor(props: {
    id: string;
    title: string;
    type: string;
    status: string;
    charCount: number;
    chunkCount: number;
    content: string | null;
    chunks: SourceChunkDto[];
  }) {
    this.id = props.id;
    this.title = props.title;
    this.type = props.type;
    this.status = props.status;
    this.charCount = props.charCount;
    this.chunkCount = props.chunkCount;
    this.content = props.content;
    this.chunks = props.chunks;
  }

  static toResponse(
    source: {
      id: string;
      title: string;
      type: string;
      status: string;
      charCount: number;
      chunkCount: number;
    },
    content: string | null,
    chunkRows: SourceChunkContentRow[]
  ): GetSourceContentResponseDto {
    return new GetSourceContentResponseDto({
      id: source.id,
      title: source.title,
      type: source.type,
      status: source.status,
      charCount: source.charCount,
      chunkCount: source.chunkCount,
      content,
      chunks: chunkRows.map((row) => ({
        id: row.id,
        chunkIndex: row.chunk_index,
        content: row.content,
        startOffset: row.start_offset,
        endOffset: row.end_offset,
      })),
    });
  }
}
