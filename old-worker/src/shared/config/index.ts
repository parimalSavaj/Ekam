import dotenv from "dotenv";
import { z } from "zod/v4";

dotenv.config({ path: ".env.local" });

const envSchema = z.object({
  PORT: z.string().default("5001"),
  DATABASE_URL: z.string(),
  OPENROUTER_API_KEY: z.string(),
  FIRECRAWL_API_KEY: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  CLOUDINARY_UPLOAD_PRESET: z.string(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

export const config = {
  port: Number(parsed.data.PORT),
  databaseUrl: parsed.data.DATABASE_URL,
  openrouterApiKey: parsed.data.OPENROUTER_API_KEY,
  firecrawlApiKey: parsed.data.FIRECRAWL_API_KEY,
  cloudinary: {
    cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
    apiKey: parsed.data.CLOUDINARY_API_KEY,
    apiSecret: parsed.data.CLOUDINARY_API_SECRET,
    uploadPreset: parsed.data.CLOUDINARY_UPLOAD_PRESET,
  },
  inngestSigningKey: parsed.data.INNGEST_SIGNING_KEY,
} as const;
