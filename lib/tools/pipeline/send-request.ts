/**
 * send_request (employer, recruiter or decider; write).
 * Stub: slices S8 (more evidence) and S9 (interview slots) enable its kinds.
 * There is no free-text field: the candidate sees fixed templates, which is
 * how a criminal-history, medical or SF-86-style question cannot be sent
 * through the product before an offer.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { InterviewKindSchema } from "@/lib/pipeline/vocab";
import {
  IsoDateTime,
  notYetEnabled,
  PipelineOutputBaseSchema,
  Uuid,
  writeAnnotations,
  type PipelineOutputBase,
} from "@/lib/tools/pipeline/shared";

export const SendRequestKindSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("more_evidence"),
    requirement_ids: z.array(Uuid).min(1).max(10),
    due_in_days: z.number().int().min(2).max(14),
  }),
  z.strictObject({
    kind: z.literal("interview_slots"),
    round: z.number().int().min(1).max(3),
    interview_kind: InterviewKindSchema,
    duration_min: z.union([z.literal(30), z.literal(45), z.literal(60)]),
    slots: z.array(IsoDateTime).min(1).max(5),
    interviewer_member_ids: z.array(Uuid).min(1).max(6),
  }),
]);

export const SendRequestInputSchema = z.strictObject({
  application_ids: z.array(Uuid).min(1).max(50),
  request: SendRequestKindSchema,
});

export const sendRequestTool: ToolDef<z.infer<typeof SendRequestInputSchema>, PipelineOutputBase> = {
  name: "send_request",
  title: "Ask candidates for more",
  description:
    "Asks one or more applicants for more evidence on named requirements, or offers them interview times. The candidate sees a fixed message naming the requirements or the times; there is no free text. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: true },
  annotations: writeAnnotations(false),
  inputSchema: SendRequestInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("send_request"),
};
