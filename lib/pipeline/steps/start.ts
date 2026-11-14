/**
 * record_step types around the start: record_start,
 * interview_status, extend_deadline. Stub: slice S11 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { StepOf } from "@/lib/pipeline/steps/types";

export const startSteps: PipelinePart<StepOf<"record_start" | "interview_status" | "extend_deadline">> = notYetEnabledPart(
  ["record_start", "interview_status", "extend_deadline"],
  "S11",
);
