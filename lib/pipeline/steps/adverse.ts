/**
 * record_step adverse-action types: propose_preadverse and
 * propose_final_adverse (gate G3 at confirmation). Stub: slice S12 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { StepOf } from "@/lib/pipeline/steps/types";

export const adverseSteps: PipelinePart<StepOf<"propose_preadverse" | "propose_final_adverse">> = notYetEnabledPart(
  ["propose_preadverse", "propose_final_adverse"],
  "S12",
);
