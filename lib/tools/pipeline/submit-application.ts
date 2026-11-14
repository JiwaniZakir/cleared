/**
 * submit_application (candidate; write; replays with the
 * same idempotency key return the first result). Stub: slice S5 enables it.
 * One transaction: application, evidence snapshots, statements, optional
 * profile items, audit event, notifications.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { QuestionKeySchema, SourceTypeSchema } from "@/lib/pipeline/vocab";
import {
  HttpUrl,
  notYetEnabled,
  PipelineOutputBaseSchema,
  Uuid,
  writeAnnotations,
  type PipelineOutputBase,
} from "@/lib/tools/pipeline/shared";

/** One evidence item: a saved profile item by id, or a new one. Shared with respond_to_request. */
export const EvidenceInputSchema = z.union([
  z.strictObject({ from_profile: Uuid, requirement_id: Uuid.optional() }),
  z.strictObject({
    source_type: SourceTypeSchema,
    claim: z.string().min(20).max(1200),
    link_url: HttpUrl.optional(),
    requirement_id: Uuid.optional(),
    save_to_profile: z.boolean().default(false),
  }),
]);

const YearMonth = z.string().regex(/^\d{4}-\d{2}$/);

export const SubmitApplicationInputSchema = z.strictObject({
  requisition_id: Uuid,
  idempotency_key: Uuid.describe("Generate one per application attempt; a replay returns the first result."),
  notices_acknowledged: z
    .array(z.strictObject({ kind: z.enum(["privacy_at_collection", "ai_use"]), version: z.string().min(1).max(40) }))
    .length(2),
  ai_evaluation: z.enum(["consent", "decline"]),
  person_confirmed: z.literal(true).describe("The person saw both notices and asked to apply."),
  eligibility_answers: z.array(z.strictObject({ key: QuestionKeySchema, answer: z.string().min(1).max(40) })).max(5),
  evidence: z.array(EvidenceInputSchema).min(1).max(20),
  availability: z.strictObject({ from_month: YearMonth, to_month: YearMonth.optional() }).optional(),
  accommodation_requested: z.boolean().default(false),
});

export const submitApplicationTool: ToolDef<z.infer<typeof SubmitApplicationInputSchema>, PipelineOutputBase> = {
  name: "submit_application",
  title: "Submit an application",
  description:
    "Applies to an open role for the person, after they have seen both notices and chosen AI-assisted or human-only review. Evidence is described without names, contact details or the names of schools and employers unless that is the evidence. Needs a candidate token.",
  enabled: false,
  access: { side: "candidate", write: true },
  maxInputBytes: 40_000,
  annotations: writeAnnotations(true),
  inputSchema: SubmitApplicationInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("submit_application"),
};
