/**
 * Picks up judgment and grade rows still `queued` five minutes after they
 * were written, for runs lost from `after()`. Stub: slice S6.
 */
import { notYetEnabledJob } from "@/lib/jobs/types";

export const judgeQueueJob = notYetEnabledJob("judge_queue", "S6");
