/**
 * Expires open candidate requests two days after their due date and puts a
 * task in front of the recruiter; never moves an application.
 * Stub: slice S8.
 */
import { notYetEnabledJob } from "@/lib/jobs/types";

export const requestExpiryJob = notYetEnabledJob("request_expiry", "S8");
