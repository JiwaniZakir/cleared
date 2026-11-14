/**
 * Adverse-action states. Stub: slice S12 writes the table.
 */
import type { ADVERSE_ACTION_STATUSES } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type AdverseStatus = (typeof ADVERSE_ACTION_STATUSES)[number];
export type AdverseEvent =
  | "propose_preadverse"
  | "confirmed_preadverse"
  | "candidate_disputes"
  | "propose_final_adverse"
  | "confirmed_final"
  | "decider_proceeds";

export const ADVERSE_MACHINE: MachineTable<AdverseStatus, AdverseEvent> = [];
