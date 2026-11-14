/**
 * Shared pieces of the twelve pipeline tools. Slice S1 creates every tool
 * as a disabled stub (`enabled: false`) with its designed input schema, so
 * later slices fill in their own file and nothing shared changes. A disabled
 * tool is never registered on either transport (lib/tools/pipeline/index.ts,
 * lib/tools/registry.ts).
 */
import { z } from "zod";
import { PipelineError } from "@/lib/pipeline/errors";
import type { ToolCallContext, ToolDef } from "@/lib/tools/wrap";
import { WorkOrderSchema } from "@/lib/workorder/schema";

export const Uuid = z.uuid();
export const IsoDate = z.iso.date();
export const IsoDateTime = z.iso.datetime({ offset: true });
export const HttpUrl = z.url({ protocol: /^https?$/ });

/** Reads are read-only; writes say so, never destructive, never open-world. */
export const READ_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false } as const;
export function writeAnnotations(idempotent: boolean) {
  return { readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false } as const;
}

/**
 * The output every pipeline result shares: a work order, the AI-use
 * line when any AI output is in the result, and `ignoredInputKeys` (added by
 * callTool). Each slice replaces a stub's output schema with the full one.
 */
export const PipelineOutputBaseSchema = z.object({
  workOrder: WorkOrderSchema,
  disclosure: z.string().optional(),
});
export type PipelineOutputBase = z.infer<typeof PipelineOutputBaseSchema>;

/** The handler of a tool whose slice has not landed. Unreachable through the registry. */
export function notYetEnabled(name: string): (input: unknown, ctx?: ToolCallContext) => Promise<PipelineOutputBase> {
  return async () => {
    throw new PipelineError("not_found", `${name} is not available yet.`);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same reason as TOOL_REGISTRY: heterogeneous tool definitions
export type AnyToolDef = ToolDef<any, any>;
