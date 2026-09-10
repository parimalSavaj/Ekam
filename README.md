# NotebookLM Clone

AI-powered notebook app — upload sources (PDF, text, URL, YouTube), process them in the background, and chat with your documents using RAG.

## Architecture

Three independently deployable services, each with its own `package.json`, `node_modules`, and `.env`:

| Folder | Responsibility | Depends on |
|--------|-----------------|------------|
| `client` | Next.js frontend | `server` (REST API) |
| `server` | REST API — auth, notebooks, sources, chat. Only **sends** Inngest events, never runs them. | Postgres, Inngest (event key) |
| `worker` | Standalone Inngest job runner — source ingestion (PDF/URL/YouTube parsing, chunking, embeddings) and conversation summaries. Exposes only `/api/inngest`. | Postgres, Inngest (signing key) |

`server` and `worker` don't import from each other — no shared package, by design. They only agree on two things: the same Inngest app id (`"notebooklm"`) and the job event contracts in `server/src/shared/contracts/job-contracts.ts` (must match `worker/src/jobs/workers/**/*.types.ts`).

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- API keys: Google OAuth, OpenRouter, Tavily (for `server`); OpenRouter, Firecrawl, Cloudinary (for `worker`)

## Quick Start

### 1. Database (PostgreSQL + pgvector)

```bash
docker compose up -d
```

- Postgres: `localhost:5434`
- pgAdmin: `http://localhost:5050` (admin@admin.com / admin)

### 2. Server

```bash
cd server
cp .env.example .env.local   # fill in your API keys
npm install
npm run db:migrate
npm run dev                   # http://localhost:5000
```

### 3. Worker

```bash
cd worker
cp .env.example .env.local   # fill in your API keys
npm install
npm run dev                   # http://localhost:5001
```

### 4. Client

```bash
cd client
npm install
npm run dev                   # http://localhost:3000
```

### 5. Inngest Dev Server (local dashboard only)

The real Inngest broker (Inngest Cloud) never runs locally — this CLI stands in for it during development, discovering functions from `worker` and routing events sent by `server`.

```bash
cd worker
npm run inngest:dev           # http://localhost:8288 (Inngest dashboard)
```

## Running All Together

> Docker must be running first (`docker compose up -d`).

Open 4 terminals:

| Terminal | Command | Port |
|----------|---------|------|
| 1 | `cd server && npm run dev` | 5000 |
| 2 | `cd worker && npm run dev` | 5001 |
| 3 | `cd client && npm run dev` | 3000 |
| 4 | `cd worker && npm run inngest:dev` | 8288 |

## Environment Variables

**Server** (`server/.env.local`) — see `server/.env.example` for all required vars. Notably `INNGEST_EVENT_KEY` (blank for local dev — the dev CLI accepts unsigned events; required once pointed at real Inngest Cloud).

**Worker** (`worker/.env.local`) — see `worker/.env.example` for all required vars. Notably `INNGEST_SIGNING_KEY` (blank for local dev, same reasoning as above).

**Client** (`client/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Deploying (own infra, not Inngest-hosted)

Inngest Cloud never hosts your code — it's just the event broker + dashboard sitting between `server` and `worker`, both of which you deploy yourself (Railway, Render, a VPS, etc).

1. Deploy `server` and `worker` as two separate services, each with a public HTTPS URL. Both run `npm run build && npm start`.
2. Remove `INNGEST_DEV=1` from `server`'s production env (that flag is dev-only and points the SDK at `localhost:8288`).
3. Create a free app on [Inngest Cloud](https://app.inngest.com) named `notebooklm` (must match the `id` used in both services' `Inngest` client).
4. Copy the **Signing Key** from the Inngest dashboard → set as `INNGEST_SIGNING_KEY` on `worker`'s host.
5. Copy an **Event Key** from the Inngest dashboard → set as `INNGEST_EVENT_KEY` on `server`'s host.
6. In the Inngest dashboard, register `worker`'s public URL as the sync URL: `https://<your-worker-host>/api/inngest`. Inngest Cloud will auto-discover the registered functions from there.
