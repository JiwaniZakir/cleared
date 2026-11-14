/**
 * rank_candidates (employer, recruiter or decider; read,
 * writes a snapshot). Stub: slice S7 enables it. Orders applicants within
 * each stage with exact arithmetic and per-position explanations; nobody is
 * hidden, filtered out or rejected by the ordering.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { notYetEnabled, PipelineOutputBaseSchema, Uuid, writeAnnotations, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

const Weight = z.number().int().min(0).max(5);

export const RankCandidatesInputSchema = z.strictObject({
  requisition_id: Uuid,
  weights: z
    .strictObject({
      requirements: z.record(Uuid, Weight).optional(),
      components: z.strictObject({ requirements: Weight, work_sample: Weight, interview: Weight }).partial().optional(),
    })
    .optional(),
  save_weights: z.boolean().optional(),
  include_closed: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
});

export const rankCandidatesTool: ToolDef<z.infer<typeof RankCandidatesInputSchema>, PipelineOutputBase> = {
  name: "rank_candidates",
  title: "Order a role's applicants",
  description:
    "Orders a role's applicants within each stage from the evidence judgments, work-sample grades and interview ratings, with the reasons for each position. Reweight to preview a different order. A person decides; nobody is rejected by the order. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: false },
  // It records a snapshot of what the person was shown, so it is not read-only (flags true to behaviour).
  annotations: writeAnnotations(false),
  inputSchema: RankCandidatesInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("rank_candidates"),
};
