/**
 * record_assessment → grade_reviews. Stub: slice S8
 * fills it in (work-sample grading and review).
 */
import type { z } from "zod";
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RecordAssessmentInputSchema } from "@/lib/tools/pipeline/record-assessment";

export type GradeReviewsInput = NonNullable<z.infer<typeof RecordAssessmentInputSchema>["grade_reviews"]>;

export const gradeReviews: PipelinePart<GradeReviewsInput> = notYetEnabledPart(["grade_reviews"], "S8");
