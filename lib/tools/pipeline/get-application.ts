/**
 * get_application (both sides; read). Stub: slice S5
 * enables it. One tool, two projections: the employer view (role-filtered)
 * and the candidate view, which never carries judgments, grades, ratings or
 * rank. Another org's or another candidate's id is `not_found`.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { notYetEnabled, PipelineOutputBaseSchema, READ_ANNOTATIONS, Uuid, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const GetApplicationInputSchema = z.strictObject({
  application_id: Uuid,
});

export const getApplicationTool: ToolDef<z.infer<typeof GetApplicationInputSchema>, PipelineOutputBase> = {
  name: "get_application",
  title: "Get an application",
  description:
    "One application as your side may see it: for a hiring team, the evidence, judgments, interviews and steps; for a candidate, what they sent, open requests and the outcome. Needs the person's own token.",
  enabled: false,
  access: { side: "any", write: false },
  annotations: READ_ANNOTATIONS,
  inputSchema: GetApplicationInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("get_application"),
};
