import { ISourcesRepository } from "../../../infrastructure/repositories/sources/sources.repository.interface.ts";
import { ISourceContentsRepository } from "../../../infrastructure/repositories/source-contents/source-contents.repository.interface.ts";
import { ISourceChunksRepository } from "../../../infrastructure/repositories/source-chunks/source-chunks.repository.interface.ts";
import { INotebooksRepository } from "../../../infrastructure/repositories/notebooks/notebooks.repository.interface.ts";
import { ILoggerService } from "../../../shared/services/logger/logger.service.interface.ts";
import { NotFoundError, ForbiddenError } from "../../../shared/core/api-error.ts";
import {
  GetSourceContentRequestDto,
  GetSourceContentResponseDto,
} from "./dtos/get-source-content.dto.ts";

/**
 * Returns a source's full stored content together with its chunks (each with
 * character offsets into that content). Powers the content viewer's
 * hover-to-highlight feature on the client.
 */
export class GetSourceContentUseCase {
  constructor(
    private readonly sourcesRepository: ISourcesRepository,
    private readonly sourceContentsRepository: ISourceContentsRepository,
    private readonly sourceChunksRepository: ISourceChunksRepository,
    private readonly notebooksRepository: INotebooksRepository,
    private readonly logger: ILoggerService
  ) {}

  async execute(dto: GetSourceContentRequestDto): Promise<GetSourceContentResponseDto> {
    this.logger.info("Getting source content", { sourceId: dto.id, userId: dto.userId });

    // Validate notebook ownership
    const notebook = await this.notebooksRepository.findByIdAndUserId(dto.notebookId, dto.userId);
    if (!notebook) {
      throw new NotFoundError("Notebook not found");
    }

    const source = await this.sourcesRepository.findById(dto.id);
    if (!source) {
      throw new NotFoundError("Source not found");
    }

    // Verify source belongs to this notebook and user
    if (source.notebookId !== dto.notebookId || source.userId !== dto.userId) {
      throw new ForbiddenError("Access denied");
    }

    const [contentRow, chunkRows] = await Promise.all([
      this.sourceContentsRepository.findBySourceId(dto.id),
      this.sourceChunksRepository.findBySourceId(dto.id),
    ]);

    return GetSourceContentResponseDto.toResponse(source, contentRow?.content ?? null, chunkRows);
  }
}
