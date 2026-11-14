/**
 * The contract between a pipeline tool that dispatches by kind
 * (record_assessment, record_step, send_request, respond_to_request) and the
 * module that owns each kind. Each owning slice enables its own module, so
 * slices that run in parallel never edit the same file.
 */
import type { Tx } from "@/lib/db/tx";
import type { PersonActor } from "@/lib/pipeline/actor";
import { PipelineError } from "@/lib/pipeline/errors";
import type { WorkOrder } from "@/lib/workorder/schema";

/** What a dispatched part works inside: the open, org-scoped transaction and the acting person. */
export interface PartContext {
  tx: Tx;
  actor: PersonActor;
  orgId: string;
  applicationId: string;
}

export interface PartResult {
  /** Rows written, for the tool's summary. */
  recorded: number;
  /** What is still waiting, and on whom, for the result's work order. */
  workOrder?: WorkOrder;
}

export interface PipelinePart<TInput> {
  /** The input key or step type this part handles. */
  readonly handles: readonly string[];
  /** The slice that fills it in. */
  readonly slice: string;
  readonly enabled: boolean;
  apply(ctx: PartContext, input: TInput): Promise<PartResult>;
}

/** A part whose slice has not landed: the dispatcher reports it as unavailable. */
export function notYetEnabledPart<TInput>(handles: readonly string[], slice: string): PipelinePart<TInput> {
  return {
    handles,
    slice,
    enabled: false,
    async apply() {
      throw new PipelineError("not_found", `${handles.join(", ")} is not available yet.`);
    },
  };
}
