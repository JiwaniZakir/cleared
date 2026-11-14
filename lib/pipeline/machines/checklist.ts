/**
 * Pre-employment and day-one checklist items. Stub: slice S13 writes the table.
 */
import type { CHECKLIST_STATUSES } from "@/lib/pipeline/vocab";
import type { MachineTable } from "@/lib/pipeline/machines/types";

export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];
export type ChecklistEvent = "created" | "update" | "not_applicable";

export const CHECKLIST_MACHINE: MachineTable<ChecklistStatus, ChecklistEvent> = [];
