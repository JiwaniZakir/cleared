/**
 * record_step checklist (gates G2, G5, G6). Stub: slice S13 fills it in.
 * Only the item's owner role may change its status and outcome.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { StepOf } from "@/lib/pipeline/steps/types";

export const checklistSteps: PipelinePart<StepOf<"checklist">> = notYetEnabledPart(["checklist"], "S13");
