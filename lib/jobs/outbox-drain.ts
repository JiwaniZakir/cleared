/**
 * Drains queued notification rows to email, with retries at 1 min, 5 min,
 * 30 min, 2 h, 6 h and 24 h, then `failed` with an admin task.
 * Stub: slice S2 fills it in.
 */
import { notYetEnabledJob } from "@/lib/jobs/types";

export const outboxDrainJob = notYetEnabledJob("outbox_drain", "S2");
