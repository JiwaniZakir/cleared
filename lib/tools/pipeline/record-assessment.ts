/**
 * record_assessment (employer; write; each part checks its
 * own role). Stub. Its handler dispatches each part to its own module, so the
 * slices that own them never edit this file together:
 *   judgment_overrides → lib/pipeline/assessment/judgments.ts (S6 enables, and edits this file)
 *   grade_reviews      → lib/pipeline/assessment/grades.ts    (S8)
 *   interview_ratings  → lib/pipeline/assessment/ratings.ts   (S9, enabled by a flag in its module)
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { GradeBandSchema, JudgmentLevelSchema, OverrideReasonSchema, RatingLevelSchema } from "@/lib/pipeline/vocab";
import { notYetEnabled, PipelineOutputBaseSchema, Uuid, writeAnnotations, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const RecordAssessmentInputSchema = z.strictObject({
  application_id: Uuid,
  judgment_overrides: z
    .array(z.strictObject({ requirement_id: Uuid, level: JudgmentLevelSchema, reason: OverrideReasonSchema }))
    .min(1)
    .max(30)
    .optional(),
  grade_reviews: z
    .array(
      z.strictObject({
        criterion_key: z.string().min(1).max(60),
        action: z.enum(["accept", "override"]),
        band: GradeBandSchema.optional(),
        reason: OverrideReasonSchema.optional(),
      }),
    )
    .min(1)
    .max(6)
    .optional(),
  interview_ratings: z
    .strictObject({
      interview_id: Uuid,
      ratings: z
        .array(z.strictObject({ question_key: z.string().min(1).max(60), level: RatingLevelSchema, note: z.string().max(500).optional() }))
        .min(1)
        .max(20),
    })
    .optional(),
});

export const recordAssessmentTool: ToolDef<z.infer<typeof RecordAssessmentInputSchema>, PipelineOutputBase> = {
  name: "record_assessment",
  title: "Record a person's assessment",
  description:
    "Records a person's own judgment where they disagree with the AI's label, their review of work-sample grades, or their interview ratings. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: true },
  annotations: writeAnnotations(false),
  inputSchema: RecordAssessmentInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("record_assessment"),
};
