/**
 * The retention purge: per org, requisitions past `purge_after`
 * with no active legal hold, children deleted bottom-up, audit events through
 * purge_audit_events() (the only path the append-only trigger allows); and the
 * short-lived rows (email tokens 24 h after expiry, processed webhooks after
 * 90 days, notification bodies 90 days after sending). Stub: slice S14.
 */
import { notYetEnabledJob } from "@/lib/jobs/types";

export const retentionPurgeJob = notYetEnabledJob("retention_purge", "S14");
