import express, { Express } from "express";
import cors from "cors";
import { serve } from "inngest/express";
import { Inngest } from "inngest";

interface AppDependencies {
  inngestClient: Inngest;
  functions: Array<unknown>;
}

/**
 * Minimal Express app for the standalone Inngest worker.
 * Exposes ONLY the /api/inngest endpoint — no auth, no feature routes,
 * no CORS restrictions beyond what Inngest itself requires.
 *
 * Note: signature verification (INNGEST_SIGNING_KEY) is configured on the
 * `Inngest` client itself (see index.ts), not here — `serve()` only needs
 * the client and the function list.
 */
export function createApp({ inngestClient, functions }: AppDependencies): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Inngest serve endpoint — Inngest Cloud (or the local dev CLI) calls this
  // URL to discover and invoke registered functions.
  app.use(
    "/api/inngest",
    serve({
      client: inngestClient,
      functions: functions as Parameters<typeof serve>[0]["functions"],
    }) as express.RequestHandler
  );

  return app;
}
