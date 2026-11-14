/**
 * The work-sample loop on candidate_request. Stub: slice S8 writes the table.
 */
import type { CANDIDATE_REQUEST_STATUSES } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type RequestStatus = (typeof CANDIDATE_REQUEST_STATUSES)[number];
export type WorkSampleEvent = "issued" | "submitted" | "grace_passed" | "extend_deadline" | "cancelled";

export const WORK_SAMPLE_MACHINE: MachineTable<RequestStatus, WorkSampleEvent> = [];
