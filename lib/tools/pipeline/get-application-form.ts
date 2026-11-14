/**
 * get_application_form (candidate; read). Stub: slice S4 enables it.
 * Requirements, the eligibility questions a posting states (in wording drawn
 * from the law on citizenship questions), both notices in full, and the
 * candidate's own reusable profile evidence.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { notYetEnabled, PipelineOutputBaseSchema, READ_ANNOTATIONS, Uuid, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const GetApplicationFormInputSchema = z.union([
  z.strictObject({ requisition_id: Uuid }),
  z.strictObject({ role_id: z.string().min(1).max(100).describe("The speedrun posting id (roles[].id from search_defense_roles).") }),
]);

export const getApplicationFormTool: ToolDef<z.infer<typeof GetApplicationFormInputSchema>, PipelineOutputBase> = {
  name: "get_application_form",
  title: "Get the application form for a role",
  description:
    "Everything needed to apply to a role through cleared: its requirements, the eligibility questions the posting states, the privacy and AI-use notices to show the person in full, and their own saved evidence. Needs a candidate token.",
  enabled: false,
  access: { side: "candidate", write: false },
  annotations: READ_ANNOTATIONS,
  inputSchema: GetApplicationFormInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("get_application_form"),
};
