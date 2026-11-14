/**
 * respond_to_request (candidate; write). Stub: slices S8
 * (work samples, more evidence, extensions) and S9 (interview slots) enable
 * its kinds.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { EvidenceInputSchema } from "@/lib/tools/pipeline/submit-application";
import {
  HttpUrl,
  IsoDateTime,
  notYetEnabled,
  PipelineOutputBaseSchema,
  Uuid,
  writeAnnotations,
  type PipelineOutputBase,
} from "@/lib/tools/pipeline/shared";

export const RespondAnswerSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("work_sample"),
    body: z.string().min(1).max(50_000),
    link_url: HttpUrl.optional(),
    attest_no_controlled_or_personal_data: z.literal(true),
  }),
  z.strictObject({ kind: z.literal("more_evidence"), evidence: z.array(EvidenceInputSchema).min(1).max(10) }),
  z.strictObject({ kind: z.literal("interview_slot"), slot: IsoDateTime }),
  z.strictObject({ kind: z.literal("none_of_these_slots") }),
  z.strictObject({ kind: z.literal("extension"), days: z.number().int().min(1).max(7) }),
]);

export const RespondToRequestInputSchema = z.strictObject({
  request_id: Uuid,
  answer: RespondAnswerSchema,
});

export const respondToRequestTool: ToolDef<z.infer<typeof RespondToRequestInputSchema>, PipelineOutputBase> = {
  name: "respond_to_request",
  title: "Answer a request from a hiring team",
  description:
    "Answers one open request: a work sample, more evidence, an interview time, none of the offered times, or a request for more time. Needs a candidate token.",
  enabled: false,
  access: { side: "candidate", write: true },
  maxInputBytes: 80_000,
  annotations: writeAnnotations(false),
  inputSchema: RespondToRequestInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("respond_to_request"),
};
