/**
 * A background job run by the daily cron (app/api/cron/tick/route.ts) as the
 * backstop for work normally done in `after()`. On Vercel Hobby the
 * cron runs once a day; no gate depends on it, because gates are
 * checked at transition time.
 *
 * A job that touches employer data loops over orgs and uses withOrgTx for
 * each one; it never reads across orgs.
 */
export interface JobContext {
  now: Date;
}

export interface JobResult {
  processed: number;
  failed: number;
}

export interface Job {
  readonly name: string;
  /** The slice that fills it in. */
  readonly slice: string;
  readonly enabled: boolean;
  run(ctx: JobContext): Promise<JobResult>;
}

/** A job whose slice has not landed. `runTick` skips it without calling `run`. */
export function notYetEnabledJob(name: string, slice: string): Job {
  return {
    name,
    slice,
    enabled: false,
    async run() {
      return { processed: 0, failed: 0 };
    },
  };
}
