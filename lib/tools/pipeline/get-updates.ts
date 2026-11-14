/**
 * get_updates (both sides; read). Stub: slice S2 enables it.
 * The caller's tasks (computed from state) and notifications; marks returned
 * notifications read.
 */
import { z } from "zod";
import type { ToolDef } from "@/lib/tools/wrap";
import { notYetEnabled, PipelineOutputBaseSchema, READ_ANNOTATIONS, type PipelineOutputBase } from "@/lib/tools/pipeline/shared";

export const GetUpdatesInputSchema = z.strictObject({
  since: z.string().max(200).optional().describe("Opaque cursor: the nextCursor of the previous call."),
  limit: z.number().int().min(1).max(50).default(20),
});

export const getUpdatesTool: ToolDef<z.infer<typeof GetUpdatesInputSchema>, PipelineOutputBase> = {
  name: "get_updates",
  title: "What is waiting on me",
  description:
    "Call at the start of every session. Returns who you are acting for, the tasks waiting on them (each with its own workOrder) and their new notifications. Needs the person's own token.",
  enabled: false,
  access: { side: "any", write: false },
  annotations: READ_ANNOTATIONS,
  inputSchema: GetUpdatesInputSchema,
  outputSchema: PipelineOutputBaseSchema,
  handler: notYetEnabled("get_updates"),
};
