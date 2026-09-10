/**
 * Wire-format contracts for jobs dispatched to the standalone `worker`
 * service via Inngest. `server` never executes these jobs — it only sends
 * events — so it doesn't need the job implementation, just the event name
 * and payload shape both sides must agree on.
 *
 * IMPORTANT: These constants/types must stay in sync with their counterparts
 * in `worker/src/jobs/workers/**\/*.types.ts`. There is no shared package by
 * design (server and worker are fully independent deployables) — if you
 * change a payload shape here, update the matching file in `worker` too.
 */
import { SourceType } from "../../domain/enums/source-type.enum.ts";

export const PROCESS_SOURCE_JOB = "source/process" as const;

export type ProcessSourcePayload = {
  sourceId: string;
  notebookId: string;
  type: SourceType;
  content?: string;
  url?: string;
  fileBase64?: string;
  originalFilename?: string;
};

export const SUMMARIZE_CONVERSATION_JOB = "conversation/summarize" as const;

export type SummarizeConversationPayload = {
  conversationId: string;
};
