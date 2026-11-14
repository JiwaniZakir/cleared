/**
 * The daily tick: runs every enabled job in a fixed order, each on its own,
 * so one failure does not stop the rest. The summary carries names, counts
 * and statuses only, and the log carries the same: never row contents.
 */
import { log } from "@/lib/log";
import type { Job, JobContext } from "@/lib/jobs/types";
import { outboxDrainJob } from "@/lib/jobs/outbox-drain";
import { judgeQueueJob } from "@/lib/jobs/judge-queue";
import { requestExpiryJob } from "@/lib/jobs/request-expiry";
import { offerExpiryJob } from "@/lib/jobs/offer-expiry";
import { bgPollJob } from "@/lib/jobs/bg-poll";
import { remindersJob } from "@/lib/jobs/reminders";
import { retentionPurgeJob } from "@/lib/jobs/retention-purge";

/** In order: mail first (so later jobs' notifications go out next tick), purge last. */
export const DAILY_JOBS: readonly Job[] = [
  outboxDrainJob,
  judgeQueueJob,
  requestExpiryJob,
  offerExpiryJob,
  bgPollJob,
  remindersJob,
  retentionPurgeJob,
];

export type JobOutcome =
  | { job: string; status: "not_enabled" }
  | { job: string; status: "ok"; processed: number; failed: number }
  | { job: string; status: "error" };

export async function runTick(ctx: JobContext = { now: new Date() }, jobs: readonly Job[] = DAILY_JOBS): Promise<JobOutcome[]> {
  const outcomes: JobOutcome[] = [];
  for (const job of jobs) {
    if (!job.enabled) {
      outcomes.push({ job: job.name, status: "not_enabled" });
      continue;
    }
    try {
      const r = await job.run(ctx);
      outcomes.push({ job: job.name, status: "ok", processed: r.processed, failed: r.failed });
      log.info("cron_job", { job: job.name, processed: r.processed, failed: r.failed });
    } catch (err) {
      outcomes.push({ job: job.name, status: "error" });
      log.error("cron_job_failed", { job: job.name, kind: err instanceof Error ? err.name : "unknown" });
    }
  }
  return outcomes;
}
