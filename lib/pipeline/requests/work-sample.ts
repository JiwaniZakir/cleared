/**
 * Work-sample requests: issued by the system when an application
 * enters `work_sample`, answered with respond_to_request kind work_sample or
 * extension. Stub: slice S8 fills it in.
 */
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RespondAnswer } from "@/lib/pipeline/requests/types";

export const answerWorkSample: PipelinePart<Extract<RespondAnswer, { kind: "work_sample" }>> = notYetEnabledPart(["work_sample"], "S8");
export const askForExtension: PipelinePart<Extract<RespondAnswer, { kind: "extension" }>> = notYetEnabledPart(["extension"], "S8");
