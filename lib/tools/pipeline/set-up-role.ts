/**
 * set_up_role (employer, recruiter or decider; write;
 * idempotent per posting). Stub: slice S4 enables it. Opens a requisition
 * from a live speedrun posting of the org's own company, or changes one.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { AccessClassSchema, REQUIREMENT_PRIORITIES } from "@/lib/pipeline/vocab";
import { IsoDate, notYetEnabled, PipelineOutputBaseSchema, Uuid, writeAnnotations, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const SetUpRoleChangesSchema = z.strictObject({
  requirements: z
    .array(z.strictObject({ id: Uuid, priority: z.enum(REQUIREMENT_PRIORITIES), weight: z.number().int().min(0).max(5) }))
    .max(60)
    .optional(),
  plan: z
    .strictObject({
      use_work_sample: z.boolean(),
      work_sample_minutes: z.union([z.literal(60), z.literal(90), z.literal(180)]),
      interview_rounds: z.number().int().min(1).max(3),
      interview_minutes: z.union([z.literal(30), z.literal(45), z.literal(60)]),
    })
    .optional(),
  work_location: z
    .strictObject({ country: z.literal("US"), state: z.string().regex(/^[A-Z]{2}$/), city: z.string().min(1).max(80).optional() })
    .optional(),
  approve_work_sample_rubric: z.literal(true).optional(),
  confirm_access_class: AccessClassSchema.optional(),
  ai_notice_posted_on: IsoDate.optional(),
  status: z.enum(["open", "paused", "closed"]).optional(),
});

export const SetUpRoleInputSchema = z.union([
  z.strictObject({ role_id: z.string().min(1).max(100).describe("The speedrun posting id (roles[].id from search_defense_roles).") }),
  z.strictObject({ requisition_id: Uuid, changes: SetUpRoleChangesSchema }),
]);

export const setUpRoleTool: ToolDef<z.infer<typeof SetUpRoleInputSchema>, PipelineOutputBase> = {
  name: "set_up_role",
  title: "Open or configure a role",
  description:
    "Opens a role for applications from a live speedrun posting of your own company, or changes one: requirement priorities and weights, the plan, the work location, rubric approval, the access class (security officer or export lead), the AI-notice date and the status. Needs an employer token.",
  enabled: false,
  access: { side: "employer", write: true },
  annotations: writeAnnotations(true),
  inputSchema: SetUpRoleInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("set_up_role"),
};
