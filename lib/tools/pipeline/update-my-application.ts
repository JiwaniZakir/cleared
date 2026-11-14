/**
 * update_my_application (candidate; write). Stub: slice S5
 * enables withdraw, consent and accommodation; S12 adds the pre-adverse
 * response.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { WithdrawnReasonSchema } from "@/lib/pipeline/vocab";
import { notYetEnabled, PipelineOutputBaseSchema, Uuid, writeAnnotations, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const UpdateMyApplicationActionSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("withdraw"), reason: WithdrawnReasonSchema }),
  z.strictObject({ type: z.literal("withdraw_ai_consent") }),
  z.strictObject({ type: z.literal("give_ai_consent"), notice_version: z.string().min(1).max(40) }),
  z.strictObject({ type: z.literal("request_accommodation") }),
  z.strictObject({ type: z.literal("request_human_review") }),
  z.strictObject({ type: z.literal("respond_to_preadverse"), response: z.enum(["disputes_accuracy", "will_send_information", "no_response"]) }),
]);

export const UpdateMyApplicationInputSchema = z.strictObject({
  application_id: Uuid,
  action: UpdateMyApplicationActionSchema,
});

export const updateMyApplicationTool: ToolDef<z.infer<typeof UpdateMyApplicationInputSchema>, PipelineOutputBase> = {
  name: "update_my_application",
  title: "Change something about my application",
  description:
    "Withdraws an application, withdraws or gives consent to AI-assisted review, asks for an accommodation or a human review, or answers a pre-adverse-action notice. Needs a candidate token.",
  enabled: false,
  access: { side: "candidate", write: true },
  annotations: writeAnnotations(false),
  inputSchema: UpdateMyApplicationInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("update_my_application"),
};
