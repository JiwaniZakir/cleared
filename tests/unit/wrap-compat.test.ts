/**
 * S1: the changes to callTool leave public tools exactly as they were.
 * Two-argument callTool is unchanged; every registered tool is public by
 * default; no pipeline stub is registered. Plus the new paths a pipeline tool
 * takes: the access check before the handler, per-tool size limits, and
 * pipeline errors carrying a work order.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callTool, DEFAULT_MAX_INPUT_BYTES, resolveAccess, type ToolCallContext, type ToolDef } from "@/lib/tools/wrap";
import { TOOL_REGISTRY, getToolByName } from "@/lib/tools/registry";
import { PIPELINE_TOOLS, enabledPipelineTools } from "@/lib/tools/pipeline";
import { gateBlocked, PipelineError } from "@/lib/pipeline/errors";
import type { Principal } from "@/lib/pipeline/actor";
import { WorkOrderSchema } from "@/lib/workorder/schema";

const EchoInput = z.object({ message: z.string().max(100_000) });
const EchoOutput = z.object({ echoed: z.string() });
type Echo = ToolDef<z.infer<typeof EchoInput>, z.infer<typeof EchoOutput>>;

function echo(overrides: Partial<Echo> = {}): Echo & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    name: "echo",
    title: "Echo",
    description: "test-only tool",
    inputSchema: EchoInput,
    outputSchema: EchoOutput,
    handler: async (...args: unknown[]) => {
      calls.push(args);
      return { echoed: (args[0] as { message: string }).message };
    },
    ...overrides,
    calls,
  } as Echo & { calls: unknown[][] };
}

const ID = "0b9f2c1e-6a4d-4c35-9e8f-1f2a3b4c5d6e";
const candidate: Principal = { accountId: ID, tokenId: ID, side: "candidate", scopes: ["pipeline:read", "pipeline:write"] };
const employerReadOnly: Principal = { accountId: ID, tokenId: ID, side: "employer", orgId: ID, scopes: ["pipeline:read"] };

const PIPELINE_NAMES = [
  "get_updates",
  "get_application",
  "get_application_form",
  "submit_application",
  "respond_to_request",
  "update_my_application",
  "set_up_role",
  "rank_candidates",
  "record_assessment",
  "send_request",
  "propose_decision",
  "record_step",
];

describe("public tools are unchanged", () => {
  it("two-argument callTool returns what it always did, and the handler gets one argument", async () => {
    const tool = echo();
    expect(await callTool(tool, { message: "hello" })).toEqual({ ok: true, data: { echoed: "hello", ignoredInputKeys: [] } });
    expect(tool.calls).toEqual([[{ message: "hello" }]]);
  });

  it("the same errors as before: guard, zod and the 20,000-byte default limit", async () => {
    const tool = echo();
    const pii = await callTool(tool, { message: "my ssn is 123-45-6789" });
    expect(pii.ok === false && pii.error).toEqual({ code: "pii_cui_rejected", message: expect.any(String) });
    const bad = await callTool(tool, { message: 42 });
    expect(bad.ok === false && bad.error.code).toBe("invalid_input");
    const big = await callTool(tool, { message: "x".repeat(DEFAULT_MAX_INPUT_BYTES) });
    expect(big.ok === false && big.error).toEqual({ code: "invalid_input", message: expect.stringContaining("limit is 20000 bytes") });
    expect(tool.calls).toEqual([]);
  });

  it("a public tool ignores a context and needs no principal", async () => {
    const tool = echo();
    const r = await callTool(tool, { message: "hi" }, {});
    expect(r).toEqual({ ok: true, data: { echoed: "hi", ignoredInputKeys: [] } });
  });

  it("every registered tool is public by default and declares no access of its own", () => {
    for (const def of TOOL_REGISTRY) {
      expect(def.access, def.name).toBeUndefined();
      expect(resolveAccess(def), def.name).toBe("public");
      expect(def.maxInputBytes, def.name).toBeUndefined();
    }
  });

  it("the registry is the sixteen existing tools: no pipeline stub is registered", () => {
    expect(TOOL_REGISTRY).toHaveLength(16);
    const names = TOOL_REGISTRY.map((t) => t.name);
    for (const name of PIPELINE_NAMES) {
      expect(names, name).not.toContain(name);
      expect(getToolByName(name), name).toBeUndefined();
    }
  });
});

describe("the twelve pipeline stubs", () => {
  it("exist for tools 14-25 of §4.1, all disabled", () => {
    expect(PIPELINE_TOOLS.map((t) => t.name)).toEqual(PIPELINE_NAMES);
    for (const def of PIPELINE_TOOLS) expect(def.enabled, def.name).toBe(false);
    expect(enabledPipelineTools()).toEqual([]);
  });

  it("each declares non-public access and refuses unknown input keys (§4.2)", async () => {
    for (const def of PIPELINE_TOOLS) {
      expect(resolveAccess(def), def.name).not.toBe("public");
      const r = await callTool(def, { not_a_key: true }, { principal: def.access !== "public" && def.access?.side === "employer" ? { ...candidate, side: "employer", orgId: ID } : candidate });
      expect(r.ok === false && r.error.code, def.name).toBe("invalid_input");
    }
  });

  it("the size limits of §4.2: 40,000 bytes for submit_application, 80,000 for respond_to_request", () => {
    const byName = Object.fromEntries(PIPELINE_TOOLS.map((t) => [t.name, t]));
    expect(byName.submit_application.maxInputBytes).toBe(40_000);
    expect(byName.respond_to_request.maxInputBytes).toBe(80_000);
  });

  it("annotations are true to behaviour: reads are read-only, writes are not", () => {
    for (const def of PIPELINE_TOOLS) {
      const writes = def.access !== "public" && def.access?.write;
      if (writes) expect(def.annotations?.readOnlyHint, def.name).toBe(false);
      expect(def.annotations?.openWorldHint, def.name).toBe(false);
    }
  });

  it("a stub called directly, with a valid principal and input, says it is not available yet", async () => {
    const def = PIPELINE_TOOLS.find((t) => t.name === "get_updates")!;
    const r = await callTool(def, {}, { principal: candidate });
    expect(r.ok === false && r.error).toEqual({ code: "not_found", message: "get_updates is not available yet." });
  });
});

describe("access check before the handler (§3.5)", () => {
  const writeTool = () => echo({ access: { side: "candidate", write: true } });

  it("no principal: unauthenticated with a work order, and the handler never runs", async () => {
    const tool = writeTool();
    const r = await callTool(tool, { message: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("unauthenticated");
      expect(r.error.message).toMatch(/none was sent/);
      expect(WorkOrderSchema.safeParse(r.error.workOrder).success).toBe(true);
      expect(r.error.workOrder?.steps[0].url).toBe("/account/tokens");
    }
    expect(tool.calls).toEqual([]);
  });

  it("names the token problem: revoked, expired, unknown", async () => {
    for (const [problem, text] of [
      ["revoked", /revoked/],
      ["expired", /expired/],
      ["unknown", /not recognised/],
    ] as const) {
      const r = await callTool(writeTool(), { message: "x" }, { principal: null, tokenProblem: problem });
      expect(r.ok === false && r.error.code).toBe("unauthenticated");
      expect(r.ok === false && r.error.message).toMatch(text);
    }
  });

  it("wrong side: forbidden", async () => {
    const tool = echo({ access: { side: "employer", write: false } });
    const r = await callTool(tool, { message: "x" }, { principal: candidate });
    expect(r.ok === false && r.error.code).toBe("forbidden");
    expect(tool.calls).toEqual([]);
  });

  it("a read-only token on a write tool: forbidden; on a read tool: allowed", async () => {
    const w = await callTool(echo({ access: { side: "employer", write: true } }), { message: "x" }, { principal: employerReadOnly });
    expect(w.ok === false && w.error.code).toBe("forbidden");
    const r = await callTool(echo({ access: { side: "employer", write: false } }), { message: "x" }, { principal: employerReadOnly });
    expect(r.ok).toBe(true);
  });

  it("side 'any' accepts either side's token", async () => {
    for (const principal of [candidate, { ...employerReadOnly }]) {
      const r = await callTool(echo({ access: { side: "any", write: false } }), { message: "x" }, { principal });
      expect(r.ok).toBe(true);
    }
  });

  it("an allowed call hands the handler the context", async () => {
    const tool = writeTool();
    const ctx: ToolCallContext = { principal: candidate, requestId: "req-1" };
    await callTool(tool, { message: "x" }, ctx);
    expect(tool.calls).toEqual([[{ message: "x" }, ctx]]);
  });
});

describe("per-tool size limits and pipeline errors", () => {
  it("a tool's own maxInputBytes replaces the default", async () => {
    // Ordinary words: a long run of one letter would look like base64 to the guard.
    const text = (bytes: number) => "test words ".repeat(Math.ceil(bytes / 11)).slice(0, bytes);
    const roomy = echo({ maxInputBytes: 40_000 });
    expect((await callTool(roomy, { message: text(30_000) })).ok).toBe(true);
    const tight = await callTool(echo(), { message: text(30_000) });
    expect(tight.ok === false && tight.error.message).toMatch(/limit is 20000 bytes/);
    const over = await callTool(roomy, { message: text(41_000) });
    expect(over.ok === false && over.error.message).toMatch(/limit is 40000 bytes/);
  });

  it("a PipelineError from the handler becomes its code, message and work order", async () => {
    const wo = { summary: "Waiting on the offer", steps: [{ who: "named_person" as const, role: "recruiter", do: "Record that the written offer went out" }] };
    const tool = echo({
      handler: async () => {
        throw gateBlocked("G1", "No background check before a recorded written conditional offer.", wo);
      },
    });
    const r = await callTool(tool, { message: "x" });
    expect(r).toEqual({ ok: false, error: { code: "gate_blocked", message: "G1: No background check before a recorded written conditional offer.", workOrder: wo } });
  });

  it("a PipelineError without a work order carries none", async () => {
    const tool = echo({
      handler: async () => {
        throw new PipelineError("not_found", "That application was not found.");
      },
    });
    expect(await callTool(tool, { message: "x" })).toEqual({ ok: false, error: { code: "not_found", message: "That application was not found." } });
  });
});
