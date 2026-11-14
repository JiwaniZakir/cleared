/**
 * Refusals from the pipeline. Service functions throw a
 * PipelineError; callTool (lib/tools/wrap.ts) turns it into the tool's error
 * result `{ code, message, workOrder }`, and the web pages show the message.
 *
 * - unauthenticated / forbidden: decided by callTool before a handler runs
 *   (no valid token; wrong side or scope), and by services for roles.
 * - not_found: also for another org's ids and another candidate's ids, so
 *   ids are never an existence oracle.
 * - conflict: the state machine has no such transition, or a duplicate.
 * - gate_blocked: a legal or process gate is not met; `gate` names it.
 * - rate_limited: over the per-token limit; the work order says when to retry.
 */
import type { WorkOrder } from "@/lib/workorder/schema";

export const PIPELINE_ERROR_CODES = ["unauthenticated", "forbidden", "not_found", "conflict", "gate_blocked", "rate_limited"] as const;
export type PipelineErrorCode = (typeof PIPELINE_ERROR_CODES)[number];

/** The design's legal and process gates. */
export const GATES = ["G1", "G1b", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10"] as const;
export type Gate = (typeof GATES)[number];

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly workOrder?: WorkOrder;
  readonly gate?: Gate;

  constructor(code: PipelineErrorCode, message: string, opts: { workOrder?: WorkOrder; gate?: Gate } = {}) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.workOrder = opts.workOrder;
    this.gate = opts.gate;
  }
}

/** The one not-found message, the same whether the row is missing or belongs to someone else. */
export function notFound(what = "That record"): PipelineError {
  return new PipelineError("not_found", `${what} was not found.`);
}

export function forbidden(message = "Your account does not have the role this needs.", workOrder?: WorkOrder): PipelineError {
  return new PipelineError("forbidden", message, { workOrder });
}

export function conflict(message: string, workOrder?: WorkOrder): PipelineError {
  return new PipelineError("conflict", message, { workOrder });
}

export function gateBlocked(gate: Gate, message: string, workOrder?: WorkOrder): PipelineError {
  return new PipelineError("gate_blocked", `${gate}: ${message}`, { gate, workOrder });
}
