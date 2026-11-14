/**
 * record_step (employer; write; role per step type). Stub.
 * Its handler dispatches each step type to its own module, so the slices
 * that own them never edit this file together:
 *   offer_details, offer_extended, offer_esign_completed, propose_offer_rescind → lib/pipeline/steps/offer.ts (S11)
 *   record_start, interview_status, extend_deadline                         → lib/pipeline/steps/start.ts (S11)
 *   order_background_check, propose_bg_proceed                              → lib/pipeline/steps/bg.ts (S12)
 *   propose_preadverse, propose_final_adverse                               → lib/pipeline/steps/adverse.ts (S12)
 *   checklist                                                               → lib/pipeline/steps/checklist.ts (S13)
 * S11 enables the dispatcher in this file; S12 and S13 enable their modules.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { ChecklistKindSchema, ChecklistStatusSchema, OfferContingencySchema } from "@/lib/pipeline/vocab";
import {
  IsoDate,
  IsoDateTime,
  notYetEnabled,
  PipelineOutputBaseSchema,
  Uuid,
  writeAnnotations,
  type PipelineOutputBase,
} from "@/lib/tools/pipeline/shared";

/** Closed reason codes for the background-check, adverse-action and rescission proposals. */
export const STEP_REASON_CODES = ["background_check_review", "background_check_adverse", "contingency_not_met", "candidate_request", "role_eliminated"] as const;
const StepReasons = z.array(z.enum(STEP_REASON_CODES)).max(4);

export const RecordStepSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("offer_details"),
    start_date: IsoDate,
    expires_on: IsoDate,
    contingencies: z.array(OfferContingencySchema).max(6),
  }),
  z.strictObject({ type: z.literal("offer_extended"), sent_via: z.enum(["esign", "email", "in_person"]), sent_on: IsoDate }),
  z.strictObject({ type: z.literal("offer_esign_completed"), completed_on: IsoDate }),
  z.strictObject({ type: z.literal("order_background_check"), package: z.string().min(1).max(60) }),
  z.strictObject({ type: z.literal("propose_bg_proceed"), reason_codes: StepReasons }),
  z.strictObject({ type: z.literal("propose_preadverse"), reason_codes: StepReasons }),
  z.strictObject({ type: z.literal("propose_final_adverse"), reason_codes: StepReasons }),
  z.strictObject({
    type: z.literal("propose_offer_rescind"),
    reason_codes: StepReasons.min(1),
    contingency: OfferContingencySchema.optional(),
  }),
  z.strictObject({
    type: z.literal("checklist"),
    item: ChecklistKindSchema,
    status: ChecklistStatusSchema,
    outcome: z.string().min(1).max(40).optional(),
    done_on: IsoDate.optional(),
  }),
  z.strictObject({ type: z.literal("interview_status"), interview_id: Uuid, status: z.enum(["cancelled", "no_show"]) }),
  z.strictObject({ type: z.literal("extend_deadline"), request_id: Uuid, until: IsoDateTime }),
  z.strictObject({ type: z.literal("record_start"), started_on: IsoDate }),
]);

export const RecordStepInputSchema = z.strictObject({
  application_id: Uuid,
  step: RecordStepSchema,
});

export const recordStepTool: ToolDef<z.infer<typeof RecordStepInputSchema>, PipelineOutputBase> = {
  name: "record_step",
  title: "Record a step after the decision",
  description:
    "Records offer details and that the written offer went out, orders the background check, proposes background-check and adverse-action steps for the decider to confirm, updates pre-start checklist items, interview status, deadlines and the start date. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: true },
  annotations: writeAnnotations(false),
  inputSchema: RecordStepInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("record_step"),
};
