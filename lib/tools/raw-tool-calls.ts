import { AsyncLocalStorage } from "node:async_hooks";

/**
 * On the MCP transport the SDK validates `tools/call` arguments against the
 * tool's zod schema — which strips unknown keys — before our handler runs,
 * so `callTool` would only ever see the stripped input. The route
 * reads the raw arguments of each `tools/call` in the request body and keeps
 * them here for the length of that request, keyed by JSON-RPC id; the tool
 * callback hands them to `callTool` in place of the stripped copy.
 */
export interface RawToolCall {
  name: string;
  arguments: unknown;
}
export const rawToolCalls = new AsyncLocalStorage<Map<string, RawToolCall>>();

export function rawToolCallKey(id: unknown): string {
  return `${typeof id}:${String(id)}`;
}

/** Raw `tools/call` arguments from a JSON-RPC body (a message or a batch), by id. */
export function collectRawToolCalls(body: unknown): Map<string, RawToolCall> {
  const calls = new Map<string, RawToolCall>();
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!isPlainObject(message) || message.method !== "tools/call" || message.id === undefined) continue;
    const params = message.params;
    if (!isPlainObject(params) || typeof params.name !== "string") continue;
    calls.set(rawToolCallKey(message.id), { name: params.name, arguments: params.arguments ?? {} });
  }
  return calls;
}

/** The raw arguments for this request id and tool, if the route captured them. */
export function rawArgumentsFor(id: unknown, toolName: string): { found: true; value: unknown } | { found: false } {
  const call = rawToolCalls.getStore()?.get(rawToolCallKey(id));
  return call && call.name === toolName ? { found: true, value: call.arguments } : { found: false };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
