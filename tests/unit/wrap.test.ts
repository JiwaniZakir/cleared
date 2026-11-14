import { describe, it, expect } from "vitest";
import { z } from "zod";
import { callTool, SourceRefSchema, type ToolDef, type SourceRef } from "@/lib/tools/wrap";
import { SpeedrunApiError } from "@/lib/speedrun/client";
import { GitHubApiError } from "@/lib/github/client";
import { GitLabApiError } from "@/lib/gitlab/client";
import { CosignApiError } from "@/lib/cosign/client";

const EchoInput = z.object({ message: z.string().max(100) });
const EchoOutput = z.object({ echoed: z.string(), sources: z.array(SourceRefSchema) });

const echoTool: ToolDef<z.infer<typeof EchoInput>, z.infer<typeof EchoOutput>> = {
  name: "echo",
  title: "Echo",
  description: "test-only tool",
  inputSchema: EchoInput,
  outputSchema: EchoOutput,
  handler: async ({ message }) => ({ echoed: message, sources: [] }),
};

const throwingTool: ToolDef<z.infer<typeof EchoInput>, z.infer<typeof EchoOutput>> = {
  ...echoTool,
  name: "throwing",
  handler: async () => {
    throw new Error("boom");
  },
};

const badOutputTool: ToolDef<z.infer<typeof EchoInput>, z.infer<typeof EchoOutput>> = {
  ...echoTool,
  name: "bad-output",
  // @ts-expect-error intentionally wrong shape to exercise output validation
  handler: async () => ({ notEchoed: "oops" }),
};

describe("callTool pipeline", () => {
  it("round-trips valid input through handler to validated output", async () => {
    const result = await callTool(echoTool, { message: "hello" });
    expect(result).toEqual({ ok: true, data: { echoed: "hello", sources: [], ignoredInputKeys: [] } });
  });

  it("rejects PII in input before the handler ever runs (invalid-shape handler input would otherwise throw)", async () => {
    const result = await callTool(echoTool, { message: "my ssn is 123-45-6789" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("pii_cui_rejected");
      expect(result.error.message).not.toContain("123-45-6789");
    }
  });

  it("rejects input that fails zod validation with a friendly message", async () => {
    const result = await callTool(echoTool, { message: 42 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_input");
  });

  it("rejects oversized input", async () => {
    const result = await callTool(echoTool, { message: "x".repeat(50_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_input");
  });

  it("converts a thrown handler error into an internal_error result, not an unhandled rejection", async () => {
    const result = await callTool(throwingTool, { message: "hi" });
    expect(result).toEqual({
      ok: false,
      error: { code: "internal_error", message: expect.stringContaining("Something went wrong") },
    });
  });

  it("catches a handler that returns output violating its own outputSchema", async () => {
    const result = await callTool(badOutputTool, { message: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("internal_error");
  });

  // Regression: a 404 from any SpeedrunApiError/GitHubApiError used ONE
  // generic, job-posting-flavored message ("may have been filled or removed
  // since you last searched") regardless of entity type -- nonsensical for a
  // company slug or a GitHub username. Each error class's own userMessage (set
  // at the specific throw site that knows what was being looked up) must now be
  // preferred over that generic fallback.
  it("prefers a SpeedrunApiError's own userMessage over the generic 404 fallback", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "speedrun-404",
      handler: async () => {
        throw new SpeedrunApiError("no company with that slug", 404, "not_found", "Entity-specific not-found text.");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: "Entity-specific not-found text." } });
  });

  it("prefers a GitHubApiError's own userMessage over the generic 404 fallback", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "github-404",
      handler: async () => {
        throw new GitHubApiError("GitHub user not found", 404, "Entity-specific GitHub not-found text.");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: "Entity-specific GitHub not-found text." } });
  });

  // Regression: GitLabApiError was added for verify_evidence's GitLab path but
  // never added to this file's own instanceof check, so a nonexistent GitLab
  // username fell through to the fully generic "Something went wrong... please
  // try again" -- misleading, since retrying the identical username will always
  // 404 again.
  it("prefers a GitLabApiError's own userMessage over the generic 404 fallback", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "gitlab-404",
      handler: async () => {
        throw new GitLabApiError("GitLab user not found", 404, "Entity-specific GitLab not-found text.");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: "Entity-specific GitLab not-found text." } });
  });

  // Regression: same class of gap as above, for CosignApiError
  // (verify_evidence's Cosign path).
  it("prefers a CosignApiError's own userMessage over the generic 404 fallback", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "cosign-404",
      handler: async () => {
        throw new CosignApiError("Cosign path not found", 404, "Entity-specific Cosign not-found text.");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: "Entity-specific Cosign not-found text." } });
  });

  it("falls back to the generic 404 message when an error class doesn't set its own userMessage", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "speedrun-404-no-override",
      handler: async () => {
        throw new SpeedrunApiError("not found", 404, "not_found");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain("may have been filled or removed");
  });

  it("a non-404 upstream error still gets the generic upstream_error message, never a userMessage meant for 404s", async () => {
    const tool: ToolDef<{ message: string }, { echoed: string; sources: SourceRef[] }> = {
      ...echoTool,
      name: "speedrun-500",
      handler: async () => {
        throw new SpeedrunApiError("server error", 500, "upstream_error");
      },
    };
    const result = await callTool(tool, { message: "hi" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_error");
      expect(result.error.message).toContain("temporarily unavailable");
    }
  });

  it("scans nested object fields for PII, not just top-level strings", async () => {
    const NestedInput = z.object({ nested: z.object({ note: z.string() }) });
    const nestedTool: ToolDef<{ nested: { note: string } }, { ok: boolean; sources: SourceRef[] }> = {
      name: "nested",
      title: "Nested",
      description: "test",
      inputSchema: NestedInput,
      outputSchema: z.object({ ok: z.boolean(), sources: z.array(SourceRefSchema) }),
      handler: async () => ({ ok: true, sources: [] }),
    };
    const result = await callTool(nestedTool, { nested: { note: "DOB: 01/01/1999" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("pii_cui_rejected");
  });
});

// Unknown keys were once stripped without a word, so an agent that sent a
// submission or a candidate reference to a tool that can't take it got a normal
// answer and no hint. The call is still accepted; every result now lists what
// was ignored.
describe("callTool lists the input keys it ignored", () => {
  const Nested = z.object({ role_id: z.string(), claims: z.object({ level: z.string() }), items: z.array(z.object({ a: z.string() })) });
  const nestedTool: ToolDef<z.infer<typeof Nested>, { ok: boolean }> = {
    name: "nested",
    title: "Nested",
    description: "test-only tool",
    inputSchema: Nested,
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async () => ({ ok: true }),
  };

  it("accepts the call and names every unknown key, nested ones included, in input order", async () => {
    const result = await callTool(nestedTool, {
      role_id: "r1",
      submission: "see attached",
      claims: { level: "secret", extra: true },
      items: [{ a: "x" }, { a: "y", note: "z" }],
      candidate_ref: "c-17",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.ignoredInputKeys).toEqual(["submission", "claims.extra", "items[1].note", "candidate_ref"]);
  });

  it("is an empty list when every key was used", async () => {
    const result = await callTool(nestedTool, { role_id: "r1", claims: { level: "secret" }, items: [] });
    expect(result.ok && result.data.ignoredInputKeys).toEqual([]);
  });

  it("still runs the personal-data guard on the whole raw input, unknown keys and their values included", async () => {
    const byValue = await callTool(nestedTool, { role_id: "r1", claims: { level: "s" }, items: [], note: "my ssn is 123-45-6789" });
    expect(byValue.ok).toBe(false);
    if (!byValue.ok) expect(byValue.error.code).toBe("pii_cui_rejected");
    const byKey = await callTool(nestedTool, { role_id: "r1", claims: { level: "s" }, items: [], "123-45-6789": "x" });
    expect(byKey.ok).toBe(false);
  });

  it("lists undeclared top-level keys for a schema that passes unknown keys through", async () => {
    const Loose = z.object({ role_id: z.string() }).passthrough();
    const looseTool: ToolDef<z.infer<typeof Loose>, { ok: boolean }> = {
      name: "loose",
      title: "Loose",
      description: "test-only tool",
      inputSchema: Loose,
      outputSchema: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: true }),
    };
    const result = await callTool(looseTool, { role_id: "r1", submission: "x" });
    expect(result.ok && result.data.ignoredInputKeys).toEqual(["submission"]);
  });

  it("every registered tool advertises ignoredInputKeys in the output schema clients see", async () => {
    const { TOOL_REGISTRY } = await import("@/lib/tools/registry");
    const { advertisedOutputSchema } = await import("@/lib/tools/wrap");
    for (const def of TOOL_REGISTRY) {
      const json = z.toJSONSchema(advertisedOutputSchema(def.outputSchema), { io: "output" }) as { properties?: Record<string, unknown> };
      expect(json.properties, def.name).toHaveProperty("ignoredInputKeys");
    }
  });
});
