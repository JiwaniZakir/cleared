/**
 * Background-check states. Stub: slice S12 writes the table.
 */
import type { BG_CHECK_STATUSES } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type BgCheckStatus = (typeof BG_CHECK_STATUSES)[number];
export type BgEvent =
  | "order_background_check"
  | "invitation_completed"
  | "invitation_expired"
  | "report_created"
  | "report_completed"
  | "report_suspended"
  | "report_canceled"
  | "report_disputed";

export const BACKGROUND_MACHINE: MachineTable<BgCheckStatus, BgEvent> = [];
