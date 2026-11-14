/**
 * record_step background-check types: order_background_check
 * (gate G1) and propose_bg_proceed. Stub: slice S12 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { StepOf } from "@/lib/pipeline/steps/types";

export const backgroundSteps: PipelinePart<StepOf<"order_background_check" | "propose_bg_proceed">> = notYetEnabledPart(
  ["order_background_check", "propose_bg_proceed"],
  "S12",
);
