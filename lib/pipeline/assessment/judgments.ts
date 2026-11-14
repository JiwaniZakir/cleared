/**
 * record_assessment → judgment_overrides. Stub:
 * slice S6 fills it in. A person's own judgment is a new row with
 * judge_kind = human that supersedes the active one, which stays.
 */
import type { z } from "zod";
import { notYetEnabledPart, type PipelinePart } from "@/lib/pipeline/module";
import type { RecordAssessmentInputSchema } from "@/lib/tools/pipeline/record-assessment";

export type JudgmentOverridesInput = NonNullable<z.infer<typeof RecordAssessmentInputSchema>["judgment_overrides"]>;

export const judgmentOverrides: PipelinePart<JudgmentOverridesInput> = notYetEnabledPart(["judgment_overrides"], "S6");
