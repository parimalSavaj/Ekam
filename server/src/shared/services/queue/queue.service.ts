import { Inngest } from "inngest";
import { config } from "../../config/index.ts";
import { IQueueService } from "./queue.service.interface.ts";
import { JobOptions } from "./queue.types.ts";

/**
 * Queue service implementation backed by Inngest.
 * Inngest uses an event-driven model — dispatching sends an event, and the
 * standalone `worker` service (see /worker) reacts to it by running the
 * matching registered function. This service is send-only: `server` never
 * defines or runs Inngest functions itself.
 */
export class QueueService implements IQueueService {
  private static instance: QueueService;
  private readonly client: Inngest;

  private constructor() {
    // Must use the SAME app id as the `worker` service's Inngest client so
    // events sent here are routed to the functions registered over there.
    // eventKey is required in production (Inngest Cloud) to authenticate
    // sent events; omitted locally where the dev CLI accepts unsigned events.
    this.client = new Inngest({ id: "notebooklm", eventKey: config.inngestEventKey });
  }

  static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  async dispatch<TPayload>(jobName: string, payload: TPayload, _options?: JobOptions): Promise<void> {
    await this.client.send({
      name: jobName,
      data: payload as Record<string, unknown>,
    });
  }
}
