import { JobOptions } from "./queue.types.ts";

export interface IQueueService {
  /**
   * Dispatch a job to be processed asynchronously.
   * Fire-and-forget — returns once the job is enqueued, not when it completes.
   * The job itself runs in the standalone `worker` service, not here.
   */
  dispatch<TPayload>(jobName: string, payload: TPayload, options?: JobOptions): Promise<void>;
}
