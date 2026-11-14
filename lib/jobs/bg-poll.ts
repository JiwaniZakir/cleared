/**
 * Polls the provider for any `report_pending` check with no event for two
 * days. Stub: slice S12.
 */
import { notYetEnabledJob } from "@/lib/jobs/types";

export const bgPollJob = notYetEnabledJob("bg_poll", "S12");
