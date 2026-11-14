/**
 * Interview slots (send_request kind interview_slots;
 * respond_to_request kinds interview_slot and none_of_these_slots). Stub:
 * slice S9 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RespondAnswer, SendRequestKind } from "@/lib/pipeline/requests/types";

export const sendInterviewSlots: PipelinePart<Extract<SendRequestKind, { kind: "interview_slots" }>> = notYetEnabledPart(["interview_slots"], "S9");
export const answerInterviewSlot: PipelinePart<Extract<RespondAnswer, { kind: "interview_slot" | "none_of_these_slots" }>> = notYetEnabledPart(
  ["interview_slot", "none_of_these_slots"],
  "S9",
);
