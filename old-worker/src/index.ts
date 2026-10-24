import { Inngest } from "inngest";
import { config } from "./shared/config/index.ts";
import { aiConfig } from "./shared/config/ai.config.ts";
import { DatabaseService } from "./shared/services/database/database.service.ts";
import { LoggerService } from "./shared/services/logger/logger.service.ts";
import { IdService } from "./shared/services/id/id.service.ts";
import { SemanticChunkingService } from "./shared/services/chunking/semantic-chunking.service.ts";
import { PdfParserService } from "./shared/services/pdf-parser/pdf-parser.service.ts";
import { EmbeddingExternalService } from "./infrastructure/external-services/embedding/embedding.external-service.ts";
import { FirecrawlExternalService } from "./infrastructure/external-services/firecrawl/firecrawl.external-service.ts";
import { CloudinaryExternalService } from "./infrastructure/external-services/cloudinary/cloudinary.external-service.ts";
import { YoutubeExternalService } from "./infrastructure/external-services/youtube/youtube.external-service.ts";
import { OpenRouterExternalService } from "./infrastructure/external-services/llm/openrouter.external-service.ts";
import { createJobRegistry } from "./jobs/registry.ts";
import { createApp } from "./app.ts";

async function bootstrap() {
  // Initialize services (same pattern as server/src/index.ts, but only the
  // subset the job workers actually need — no auth, no retrieval, no tavily).
  const db = DatabaseService.getInstance({ connectionString: config.databaseUrl });
  const logger = LoggerService.getInstance();
  const idService = IdService.getInstance();
  const llmService = OpenRouterExternalService.getInstance(config.openrouterApiKey);
  const chunkingService = new SemanticChunkingService(llmService, logger, aiConfig.chat.defaultModel);
  const pdfParserService = PdfParserService.getInstance();
  const embeddingService = EmbeddingExternalService.getInstance(config.openrouterApiKey, aiConfig.embedding.model);
  const firecrawlService = FirecrawlExternalService.getInstance(config.firecrawlApiKey);
  const cloudinaryService = CloudinaryExternalService.getInstance(config.cloudinary);
  const youtubeService = YoutubeExternalService.getInstance();

  // Inngest client — must use the SAME app id ("notebooklm") as `server`'s
  // QueueService so that events sent from `server` are routed to the
  // functions registered here. signingKey verifies that incoming
  // /api/inngest requests genuinely come from Inngest Cloud — required in
  // production, unused (and safely undefined) with the local dev CLI.
  const inngestClient = new Inngest({ id: "notebooklm", signingKey: config.inngestSigningKey });

  // Register job functions
  const jobFunctions = createJobRegistry(inngestClient, {
    db,
    idService,
    logger,
    chunkingService,
    pdfParserService,
    embeddingService,
    firecrawlService,
    cloudinaryService,
    youtubeService,
    llmService,
  });

  // Connect to database
  await db.connect();

  // Create Express app exposing /api/inngest
  const app = createApp({ inngestClient, functions: jobFunctions });

  // Start server
  app.listen(config.port, () => {
    console.log(`Worker is running on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start worker:", err);
  process.exit(1);
});
