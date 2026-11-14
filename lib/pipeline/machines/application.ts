/**
 * Application stages. Stub: slice S10 writes the full table.
 * Until then no transition exists, so every stage change is refused.
 */
import type { Stage } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type ApplicationEvent =
  | "submit_application"
  | "queued"
  | "judged"
  | "judging_overdue"
  | "confirmed_advance"
  | "confirmed_not_selected"
  | "grades_reviewed_advance"
  | "interviews_completed"
  | "confirmed_make_offer"
  | "offer_accepted"
  | "offer_declined_or_expired"
  | "confirmed_offer_rescind"
  | "pre_employment_complete"
  | "record_start"
  | "withdraw";

export const APPLICATION_MACHINE: MachineTable<Stage, ApplicationEvent> = [];
