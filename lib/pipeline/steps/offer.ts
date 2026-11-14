/**
 * record_step offer types: offer_details, offer_extended (the
 * written conditional offer), offer_esign_completed, propose_offer_rescind.
 * Stub: slice S11 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { StepOf } from "@/lib/pipeline/steps/types";

export const offerSteps: PipelinePart<StepOf<"offer_details" | "offer_extended" | "offer_esign_completed" | "propose_offer_rescind">> =
  notYetEnabledPart(["offer_details", "offer_extended", "offer_esign_completed", "propose_offer_rescind"], "S11");
