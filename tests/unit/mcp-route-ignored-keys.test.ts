// @vitest-environment node
import { describe, it, expect } from "vitest";
import { POST } from "@/app/mcp/route";

// Through the real MCP route: the SDK strips unknown keys before the tool
// callback runs, so this checks the route hands callTool the raw arguments and
// the result names what was ignored. explain_rule needs no network, so this
// runs in the unit suite.
async function rpc(body: unknown) {
  const response = await POST(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify(body),
    }),
  );
  const text = await response.text();
  // Streamable HTTP may answer as SSE: take the last data line.
  const json = text.trim().startsWith("{") ? text : text.split("\n").filter((l) => l.startsWith("data: ")).at(-1)!.slice(6);
  return JSON.parse(json);
}

const INIT = {
  jsonrpc: "2.0",
  id: 0,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "unit", version: "1" } },
};

describe("MCP route: tools/call results list ignored input keys", () => {
  it("names a stray key the SDK would have dropped silently", async () => {
    await rpc(INIT);
    const reply = await rpc({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "explain_rule", arguments: { topic: "itar", submission: "my work sample", candidate_ref: "c-17" } },
    });
    expect(reply.result.isError).toBeFalsy();
    expect(reply.result.structuredContent.found).toBe(true);
    expect(reply.result.structuredContent.ignoredInputKeys).toEqual(["submission", "candidate_ref"]);
  });

  it("is empty for a clean call, and the stray key's value never comes back", async () => {
    const clean = await rpc({ jsonrpc: "2.0", id: "a", method: "tools/call", params: { name: "explain_rule", arguments: { topic: "itar" } } });
    expect(clean.result.structuredContent.ignoredInputKeys).toEqual([]);
    const stray = await rpc({
      jsonrpc: "2.0",
      id: "b",
      method: "tools/call",
      params: { name: "explain_rule", arguments: { topic: "itar", note: "unique-marker-xyz" } },
    });
    expect(JSON.stringify(stray.result)).not.toContain("unique-marker-xyz");
  });

  it("lists ignoredInputKeys in every tool's advertised output schema", async () => {
    const reply = await rpc({ jsonrpc: "2.0", id: 9, method: "tools/list", params: {} });
    for (const tool of reply.result.tools) {
      expect(tool.outputSchema?.properties, tool.name).toHaveProperty("ignoredInputKeys");
    }
  });
});
