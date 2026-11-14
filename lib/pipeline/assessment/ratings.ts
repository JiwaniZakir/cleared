/**
 * record_assessment → interview_ratings (table interview_rating). Stub: slice S9 fills it in and enables it with the flag
 * in this module. An interviewer writes only their own rows.
 */
import type { z } from "zod";
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RecordAssessmentInputSchema } from "@/lib/tools/pipeline/record-assessment";

export type InterviewRatingsInput = NonNullable<z.infer<typeof RecordAssessmentInputSchema>["interview_ratings"]>;

export const interviewRatings: PipelinePart<InterviewRatingsInput> = notYetEnabledPart(["interview_ratings"], "S9");
