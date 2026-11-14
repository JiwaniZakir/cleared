/**
 * More-evidence requests (send_request kind more_evidence;
 * respond_to_request kind more_evidence). Stub: slice S8 fills it in.
 * The candidate sees a fixed template naming the requirements; there is no
 * employer-written text.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RespondAnswer, SendRequestKind } from "@/lib/pipeline/requests/types";

export const sendMoreEvidence: PipelinePart<Extract<SendRequestKind, { kind: "more_evidence" }>> = notYetEnabledPart(["more_evidence"], "S8");
export const answerMoreEvidence: PipelinePart<Extract<RespondAnswer, { kind: "more_evidence" }>> = notYetEnabledPart(["more_evidence"], "S8");
