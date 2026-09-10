import { ISourcesRepository } from "../../../infrastructure/repositories/sources/sources.repository.interface.ts";
import { ISourceContentsRepository } from "../../../infrastructure/repositories/source-contents/source-contents.repository.interface.ts";
import { ISourceChunksRepository } from "../../../infrastructure/repositories/source-chunks/source-chunks.repository.interface.ts";
import { INotebooksRepository } from "../../../infrastructure/repositories/notebooks/notebooks.repository.interface.ts";
import { IEmbeddingService } from "../../../infrastructure/external-services/embedding/embedding.external-service.interface.ts";
import { IFirecrawlService } from "../../../infrastructure/external-services/firecrawl/firecrawl.external-service.interface.ts";
import { ICloudinaryService } from "../../../infrastructure/external-services/cloudinary/cloudinary.external-service.interface.ts";
import { IYoutubeService } from "../../../infrastructure/external-services/youtube/youtube.external-service.interface.ts";
import { IChunkingService } from "../../../shared/services/chunking/chunking.service.interface.ts";
import { IPdfParserService } from "../../../shared/services/pdf-parser/pdf-parser.service.interface.ts";
import { IDatabaseService } from "../../../shared/services/database/database.service.interface.ts";
import { IIdService } from "../../../shared/services/id/id.service.interface.ts";
import { ILoggerService } from "../../../shared/services/logger/logger.service.interface.ts";
import { NonRetryableError } from "../../../shared/core/job-errors.ts";
import { SourceType } from "../../../domain/enums/source-type.enum.ts";
import { ProcessSourcePayload, ProcessSourceResult } from "./process-source.types.ts";

export class ProcessSourceWorker {
  constructor(
    private readonly sourcesRepository: ISourcesRepository,
    private readonly sourceContentsRepository: ISourceContentsRepository,
    private readonly sourceChunksRepository: ISourceChunksRepository,
    private readonly notebooksRepository: INotebooksRepository,
    private readonly embeddingService: IEmbeddingService,
    private readonly firecrawlService: IFirecrawlService,
    private readonly cloudinaryService: ICloudinaryService,
    private readonly youtubeService: IYoutubeService,
    private readonly chunkingService: IChunkingService,
    private readonly pdfParserService: IPdfParserService,
    private readonly db: IDatabaseService,
    private readonly idService: IIdService,
    private readonly logger: ILoggerService
  ) {}

  async execute(payload: ProcessSourcePayload): Promise<ProcessSourceResult> {
    const { sourceId, notebookId, type, content, url, fileBase64, originalFilename } = payload;

    this.logger.info("Process source job started", { sourceId, notebookId, type });

    // 1. Load fresh source and mark as processing
    const source = await this.sourcesRepository.findById(sourceId);
    if (!source) {
      throw new NonRetryableError(`Source ${sourceId} not found — may have been deleted`);
    }

    source.markProcessing();
    await this.sourcesRepository.update(source);

    // Everything from content extraction through persistence is wrapped so that
    // ANY failure (extraction, chunking, embedding, or the DB transaction)
    // reliably transitions the source to FAILED in the DB. Without this, a
    // failure before the transaction would leave the source stuck in PROCESSING
    // forever, because the job registry only logs and re-throws.
    try {
      // 2. Extract content based on source type
      const extractedContent = await this.extractContent(sourceId, notebookId, type, content, url, fileBase64, originalFilename);

      // 3. Chunk the content
      // NOTE: SemanticChunkingService.chunk() returns a Promise at runtime (async
      // facade behind the sync IChunkingService interface). The original
      // ChunkingService is sync. `await` handles both correctly — it resolves the
      // Promise, and is a harmless no-op for a plain array.
      const chunks = await this.chunkingService.chunk(extractedContent);

      // 4. Generate embeddings (if there are chunks)
      let embeddings: number[][] = [];
      if (chunks.length > 0) {
        const chunkTexts = chunks.map((c) => c.content);
        embeddings = await this.embeddingService.generateEmbeddings(chunkTexts);
      }

      // 5. Store everything in a transaction (content + chunks + mark completed + increment count)
      const contentId = this.idService.generate();
      const chunkRecords = chunks.map((chunk, index) => ({
        id: this.idService.generate(),
        sourceId,
        notebookId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        startOffset: chunk.startOffset ?? null,
        endOffset: chunk.endOffset ?? null,
        embedding: embeddings[index],
      }));

      await this.persistResults(contentId, sourceId, notebookId, extractedContent, chunkRecords, source, chunks.length);

      this.logger.info("Process source job completed", {
        sourceId,
        notebookId,
        type,
        chunkCount: chunks.length,
        charCount: extractedContent.length,
      });

      return { sourceId, chunkCount: chunks.length, charCount: extractedContent.length };
    } catch (error) {
      await this.markSourceFailed(source, error);
      throw error;
    }
  }

  /**
   * Persists content, chunks, completion status and notebook counter inside a
   * single DB transaction. On failure it rolls back and re-throws so the caller
   * can transition the source to FAILED — it does NOT mark failed itself, to
   * keep failure handling in one place.
   */
  private async persistResults(
    contentId: string,
    sourceId: string,
    notebookId: string,
    extractedContent: string,
    chunkRecords: Array<{
      id: string;
      sourceId: string;
      notebookId: string;
      content: string;
      chunkIndex: number;
      tokenCount: number;
      startOffset: number | null;
      endOffset: number | null;
      embedding: number[];
    }>,
    source: Awaited<ReturnType<ISourcesRepository["findById"]>>,
    chunkCount: number
  ): Promise<void> {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      // Store full content
      await this.sourceContentsRepository.create(contentId, sourceId, extractedContent, client);

      // Store chunks with embeddings
      if (chunkRecords.length > 0) {
        await this.sourceChunksRepository.createMany(chunkRecords, client);
      }

      // Mark source as completed
      source!.markCompleted({ chunkCount, charCount: extractedContent.length });
      await this.sourcesRepository.update(source!, client);

      // Increment notebook active source count
      await this.notebooksRepository.incrementActiveSourceCount(notebookId, client);

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error("Process source transaction rollback failed", {
          sourceId,
          notebookId,
          error: (rollbackError as Error).message,
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Transitions the source to FAILED and persists it on a fresh (non-transactional)
   * connection. Any error while marking failed is logged and swallowed so it can
   * never mask the original processing error.
   */
  private async markSourceFailed(
    source: NonNullable<Awaited<ReturnType<ISourcesRepository["findById"]>>>,
    originalError: unknown
  ): Promise<void> {
    this.logger.error("Process source job failed — marking source as FAILED", {
      sourceId: source.id,
      error: (originalError as Error).message,
    });

    try {
      source.markFailed((originalError as Error).message ?? "Source processing failed");
      await this.sourcesRepository.update(source);
    } catch (updateError) {
      this.logger.error("Failed to persist FAILED status for source", {
        sourceId: source.id,
        error: (updateError as Error).message,
      });
    }
  }

  private async extractContent(
    sourceId: string,
    notebookId: string,
    type: SourceType,
    content?: string,
    url?: string,
    fileBase64?: string,
    originalFilename?: string
  ): Promise<string> {
    switch (type) {
      case SourceType.TEXT:
      case SourceType.MARKDOWN: {
        if (!content) {
          throw new NonRetryableError(`Source ${sourceId} has type ${type} but no content provided`);
        }
        return content;
      }

      case SourceType.URL: {
        if (!url) {
          throw new NonRetryableError(`Source ${sourceId} has type URL but no url provided`);
        }
        this.logger.info("Scraping URL with Firecrawl", { sourceId, url });
        const scrapeResult = await this.firecrawlService.scrapeUrl(url);
        if (!scrapeResult.markdown || scrapeResult.markdown.trim().length === 0) {
          throw new NonRetryableError("Firecrawl returned empty content for the URL");
        }
        return scrapeResult.markdown;
      }

      case SourceType.YOUTUBE: {
        if (!url) {
          throw new NonRetryableError(`Source ${sourceId} has type YOUTUBE but no url provided`);
        }
        this.logger.info("Fetching YouTube transcript", { sourceId, url });
        const transcriptResult = await this.youtubeService.getTranscript(url);

        if (!transcriptResult.text || transcriptResult.text.trim().length === 0) {
          throw new NonRetryableError("YouTube transcript is empty for this video");
        }

        // Update source metadata with video info
        const source = await this.sourcesRepository.findById(sourceId);
        if (source) {
          source.updateMetadata({
            videoId: transcriptResult.videoId,
            videoUrl: transcriptResult.url,
            videoTitle: transcriptResult.title,
          });
          await this.sourcesRepository.update(source);
        }

        this.logger.info("YouTube transcript fetched", {
          sourceId,
          videoId: transcriptResult.videoId,
          charCount: transcriptResult.text.length,
        });

        return transcriptResult.text;
      }

      case SourceType.PDF: {
        if (!fileBase64) {
          throw new NonRetryableError(`Source ${sourceId} has type PDF but no fileBase64 provided`);
        }
        const fileBuffer = Buffer.from(fileBase64, "base64");

        // Upload to Cloudinary
        const uploadResult = await this.cloudinaryService.uploadPdf(
          fileBuffer,
          originalFilename ?? "document.pdf",
          notebookId
        );

        // Update source metadata with Cloudinary info
        const source = await this.sourcesRepository.findById(sourceId);
        if (!source) {
          throw new NonRetryableError(`Source ${sourceId} not found during PDF processing`);
        }

        source.updateMetadata({
          cloudinaryPublicId: uploadResult.publicId,
          cloudinaryUrl: uploadResult.secureUrl,
          originalFilename: uploadResult.originalFilename,
          fileFormat: uploadResult.format,
          fileBytes: uploadResult.bytes,
        });
        await this.sourcesRepository.update(source);

        this.logger.info("PDF uploaded to Cloudinary", { sourceId, publicId: uploadResult.publicId });

        // Extract text from PDF
        const parseResult = await this.pdfParserService.extractText(fileBuffer);
        this.logger.info("PDF text extracted", { sourceId, totalPages: parseResult.totalPages });
        return parseResult.text;
      }

      default:
        throw new NonRetryableError(`Unsupported source type: ${type}`);
    }
  }
}
