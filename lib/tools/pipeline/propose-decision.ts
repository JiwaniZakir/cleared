/**
 * propose_decision (employer, recruiter or decider; write).
 * Stub: slice S10 enables it. Creates proposals only: nothing changes until
 * the named person confirms each one on the web.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { DecisionReasonCodeSchema } from "@/lib/pipeline/vocab";
import { notYetEnabled, PipelineOutputBaseSchema, Uuid, writeAnnotations, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const ProposeDecisionInputSchema = z.strictObject({
  decisions: z
    .array(
      z.strictObject({
        application_id: Uuid,
        outcome: z.enum(["advance", "not_selected", "make_offer"]),
        reason_codes: z.array(DecisionReasonCodeSchema).min(1).max(4),
        requirement_ids: z.array(Uuid).max(30).optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
  confirmer_member_id: Uuid.optional(),
});

export const proposeDecisionTool: ToolDef<z.infer<typeof ProposeDecisionInputSchema>, PipelineOutputBase> = {
  name: "propose_decision",
  title: "Propose decisions for a person to confirm",
  description:
    "Proposes advancing, not selecting, or making an offer to one or more applicants. Nothing happens until the named person opens the confirmation page, reads the evidence and confirms each one. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: true },
  annotations: writeAnnotations(false),
  inputSchema: ProposeDecisionInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("propose_decision"),
};
