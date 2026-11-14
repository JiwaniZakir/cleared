#!/usr/bin/env tsx
/**
 * Generates docs/reference/tools.mdx from the tool registry, so the tools
 * reference cannot drift from the code.
 *
 * Every tool in TOOL_REGISTRY gets its title, description, read-only or write
 * annotation, an inputs table and an outputs table taken from its zod schemas,
 * and one example input. Each example is parsed against the tool's own input
 * schema and run through the personal-data guard before anything is written,
 * so a stale or unsafe example fails the script. Two tools that read only
 * local data (explain_rule, estimate_timeline) also get a real result, run
 * through callTool. The twelve pipeline tools are listed from
 * lib/tools/pipeline with their access and enabled state.
 *
 * Run:   pnpm docs:tools           (writes the file)
 *        pnpm docs:tools --check   (exits 1 if the file is out of date)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { TOOL_REGISTRY } from "@/lib/tools/registry";
import { PIPELINE_TOOLS } from "@/lib/tools/pipeline";
import { callTool, resolveAccess, type ToolDef } from "@/lib/tools/wrap";
import { assertNoPiiCui } from "@/lib/guard/pii";
import { MCP_URL, SITE_URL } from "@/lib/constants";

const OUT = join(process.cwd(), "docs", "reference", "tools.mdx");

/** A role id read from the public Talent Network on 2026-11-13 (tests/unit/fixtures/speedrun-posting-ids.ts). Postings close; use an id from your own search. */
const ROLE_ID = "95161f4b-23e9-3dc4-8125-ae550dc06f3b";

const EXAMPLES: Record<string, unknown> = {
  search_defense_roles: { query: "autonomy", level: ["new_grad", "junior"], itar_only: true, limit: 5 },
  get_role_rubric: { role_id: ROLE_ID },
  explain_rule: { topic: "clearance-citizenship" },
  estimate_timeline: { target_level: "secret", current_status: "none", employer_has_fcl: "yes", citizenship_status: "us_citizen" },
  readiness_brief: { role_id: ROLE_ID },
  get_company_profile: { company_slug: "anduril" },
  build_trial_assessment: { role_id: ROLE_ID, minutes: 90 },
  run_job_preview: { role_id: ROLE_ID, minutes: 30 },
  fit_debrief: { role_id: ROLE_ID, loved: ["hands_on_hardware", "mission_driven_focus"], disliked: ["scif_lifestyle"] },
  verify_evidence: { github_username_or_url: "octocat" },
  prepare_consented_card: { role_id: ROLE_ID, approved_fields: ["headline", "highlights", "github_username"] },
  prepare_signed_attestation: {
    claims: { citizenship_status_self_reported: "us_citizen" },
    issued_at: "2026-11-13T17:00:00Z",
    signed_payload: "<the exact JSON string your agent signed>",
    signature_base64: "<Ed25519 signature, base64>",
    public_key_base64: "<SPKI public key, base64>",
  },
  verify_signed_attestation: {
    signed_payload: "<signedPayload from the credential>",
    signature_base64: "<signature from the credential>",
    public_key_base64: "<public key from the credential>",
  },
  contribute_anonymous_signal: { role_id: ROLE_ID, contribution: { clearance_level: "none", years_experience_bucket: "0-2" } },
  get_aggregated_signal: { company_slug: "anduril" },
  generate_interview_guide: { role_id: ROLE_ID, minutes: 60 },
};

/** Tools whose example is a shape, not a value that would pass (a real signature cannot be shown). */
const SHAPE_ONLY = new Set(["prepare_signed_attestation", "verify_signed_attestation"]);
/** Tools that read only local data, so their real output can be shown without a network call. */
const RUN_LOCALLY = new Set(["explain_rule", "estimate_timeline"]);

const GROUPS: { title: string; intro: string; tools: string[] }[] = [
  {
    title: "Find roles and check them",
    intro: "Start here. `search_defense_roles` returns the `role_id` and `company_slug` the other tools take.",
    tools: ["search_defense_roles", "get_role_rubric", "explain_rule", "estimate_timeline", "readiness_brief", "get_company_profile"],
  },
  {
    title: "Try the work",
    intro: "Built only from the public posting, so nothing export-controlled goes in or comes out.",
    tools: ["build_trial_assessment", "run_job_preview", "fit_debrief"],
  },
  {
    title: "Share evidence you choose",
    intro: "You choose what to share. `prepare_consented_card` takes only the names of the fields you approve, and your agent fills in the values locally. `verify_evidence` looks up a public username you give it. The attestation tools wrap or check a status claim your own agent signs; the private key never leaves your agent.",
    tools: ["verify_evidence", "prepare_consented_card", "prepare_signed_attestation", "verify_signed_attestation"],
  },
  {
    title: "Anonymous interest pool",
    intro: "The one tool that writes. Call it only after the person agrees, every time.",
    tools: ["contribute_anonymous_signal", "get_aggregated_signal"],
  },
  {
    title: "For hiring teams",
    intro: "Built from the posting alone. Nothing here scores a person.",
    tools: ["generate_interview_guide"],
  },
];

/** Escapes text for MDX prose and table cells (also renders as plain Markdown on GitHub). */
function mdx(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/\|/g, "\\|")
    .replace(/\s*\n\s*/g, " ");
}

type JsonSchema = {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  default?: unknown;
  maxLength?: number;
};

function typeOf(s: JsonSchema): string {
  if (s.enum) return s.enum.map((v) => `\`${String(v)}\``).join(", ");
  if (s.const !== undefined) return `\`${String(s.const)}\``;
  if (s.anyOf) return s.anyOf.map(typeOf).join(" or ");
  if (s.type === "array") {
    const inner = s.items ? typeOf(s.items) : "any";
    return s.items?.enum ? `array of: ${inner}` : `array of ${inner}`;
  }
  if (Array.isArray(s.type)) return s.type.join(" or ");
  return s.type ?? "object";
}

function toSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  return z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonSchema;
}

function inputsTable(def: ToolDef): string {
  const js = toSchema(def.inputSchema, "input");
  const props = Object.entries(js.properties ?? {});
  if (props.length === 0) return "This tool takes no input.\n";
  const rows = props.map(([name, s]) => {
    const required = (js.required ?? []).includes(name) ? "yes" : "no";
    const notes = [s.description, s.default !== undefined ? `Default \`${JSON.stringify(s.default)}\`.` : undefined]
      .filter(Boolean)
      .join(" ");
    return `| \`${name}\` | ${mdx(typeOf(s))} | ${required} | ${mdx(notes)} |`;
  });
  return ["| Input | Type | Required | Notes |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
}

function outputsTable(def: ToolDef): string {
  const js = toSchema(def.outputSchema, "output");
  const rows = Object.entries(js.properties ?? {}).map(([name, s]) => `| \`${name}\` | ${mdx(typeOf(s))} | ${mdx(s.description ?? "")} |`);
  rows.push(
    "| `ignoredInputKeys` | array of string | Input keys this tool does not take, dropped unused and not stored. |",
  );
  return ["| Output field | Type | Notes |", "| --- | --- | --- |", ...rows].join("\n") + "\n";
}

function annotationLine(def: ToolDef): string {
  const a = def.annotations ?? { readOnlyHint: true };
  return a.readOnlyHint
    ? "Read-only: it reads or computes and changes nothing."
    : "Writes: it adds a record to a shared store. Some agents run read-only tools without asking, so this one is marked as a write.";
}

function trimForDocs(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 2).map(trimForDocs);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, trimForDocs(v)]));
  }
  if (typeof value === "string" && value.length > 220) return `${value.slice(0, 217)}...`;
  return value;
}

async function exampleBlock(def: ToolDef): Promise<string> {
  const example = EXAMPLES[def.name];
  if (example === undefined) throw new Error(`No example for ${def.name}. Add one to EXAMPLES.`);
  if (!SHAPE_ONLY.has(def.name)) {
    const parsed = def.inputSchema.safeParse(example);
    if (!parsed.success) throw new Error(`Example for ${def.name} does not match its input schema: ${parsed.error.message}`);
    assertNoPiiCui(example);
  }
  let block = `Example input${SHAPE_ONLY.has(def.name) ? " (shape only: a real signature cannot be shown)" : ""}:\n\n\`\`\`json\n${JSON.stringify(example, null, 2)}\n\`\`\`\n`;
  if (RUN_LOCALLY.has(def.name)) {
    const result = await callTool(def, example);
    if (!result.ok) throw new Error(`Example for ${def.name} failed: ${result.error.message}`);
    block += `\nResult, generated from the code by this script (long arrays cut to two items, long strings shortened):\n\n\`\`\`json\n${JSON.stringify(trimForDocs(result.data), null, 2)}\n\`\`\`\n`;
  }
  return block;
}

async function render(): Promise<string> {
  const byName = new Map(TOOL_REGISTRY.map((t) => [t.name, t]));
  const grouped = new Set(GROUPS.flatMap((g) => g.tools));
  const missing = TOOL_REGISTRY.filter((t) => !grouped.has(t.name)).map((t) => t.name);
  if (missing.length > 0) throw new Error(`Registered tools missing from GROUPS: ${missing.join(", ")}`);

  const out: string[] = [];
  out.push(
    "---",
    'title: "Tools reference"',
    `description: "Every public tool the connector exposes: what it is for, its inputs and outputs, and an example. Generated from lib/tools/registry.ts."`,
    "---",
    "",
    "This page is generated from `lib/tools/registry.ts` by `scripts/generate-tool-docs.ts`. To change it, change the tool and run `pnpm docs:tools`.",
    "",
    `The connector exposes ${TOOL_REGISTRY.length} public tools at \`${MCP_URL}\`. They need no account and no token.`,
    "",
    "Every tool call goes through the same pipeline: a size limit, the personal-data guard, schema validation, the tool, and an output check. Every result that states a fact carries `sources`, and most carry a `disclaimer`. Errors come back as a tool result with `isError: true` and a plain message, never a stack trace.",
    "",
    `To call a tool without an agent, \`POST\` its input as JSON to \`/api/tools/<name>\`. The playground at [/try](${SITE_URL}/try) does exactly that.`,
    "",
  );

  for (const group of GROUPS) {
    out.push(`## ${group.title}`, "", group.intro, "");
    for (const name of group.tools) {
      const def = byName.get(name);
      if (!def) throw new Error(`GROUPS names ${name}, which is not registered.`);
      out.push(`### \`${def.name}\``, "", `**${mdx(def.title)}.** ${mdx(def.description)}`, "", annotationLine(def), "");
      out.push(inputsTable(def), outputsTable(def), await exampleBlock(def));
    }
  }

  out.push(
    "## Pipeline tools (not built yet)",
    "",
    `These ${PIPELINE_TOOLS.length} tools are designed, not built. Each exists in \`lib/tools/pipeline/\` only as a stub: an input schema, \`enabled: false\`, and a handler that refuses. The registry leaves them out, so neither endpoint serves them and no client can call them. When built, each will need a personal access token for the right side. See the [Roadmap](/roadmap).`,
    "",
    "| Tool | Side | Needs write scope | Enabled |",
    "| --- | --- | --- | --- |",
    ...PIPELINE_TOOLS.map((t) => {
      const access = resolveAccess(t);
      const side = access === "public" ? "public" : access.side === "any" ? "both" : access.side;
      const writes = access === "public" ? "no" : access.write ? "yes" : "no";
      return `| \`${t.name}\` | ${side} | ${writes} | ${t.enabled === false ? "no" : "yes"} |`;
    }),
    "",
  );
  return out.join("\n");
}

async function main() {
  const text = await render();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      // Missing file counts as out of date.
    }
    if (current !== text) {
      console.error("docs/reference/tools.mdx is out of date. Run: pnpm docs:tools");
      process.exit(1);
    }
    console.log("docs/reference/tools.mdx is up to date.");
    return;
  }
  writeFileSync(OUT, text);
  console.log(`Wrote ${OUT} (${TOOL_REGISTRY.length} public tools, ${PIPELINE_TOOLS.length} pipeline stubs).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
