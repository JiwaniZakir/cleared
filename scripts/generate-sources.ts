#!/usr/bin/env tsx
/**
 * Generates the data/rules.json + data/timelines.json (+ data/pipeline-steps.json) portion of SOURCES.md
 * directly from those files, so it can never drift from what the product
 * actually cites (tests/unit/data-integrity.test.ts's "every URL cited in
 * rules.json/timelines.json appears in SOURCES.md" check depends on this
 * staying in sync — re-run this script after editing either data file).
 * Run: pnpm tsx scripts/generate-sources.ts > /tmp/generated-sources-section.md
 * then merge into SOURCES.md's "From data/rules.json and data/timelines.json"
 * section by hand (the rest of SOURCES.md is curated prose, not generated).
 */
import rulesJson from "../data/rules.json";
import timelinesJson from "../data/timelines.json";
import pipelineStepsJson from "../data/pipeline-steps.json";

type SourceRef = { title: string; url: string; lastVerified?: string };

function printSource(s: SourceRef, indent = "") {
  console.log(`${indent}- [${s.title}](${s.url})${s.lastVerified ? ` — verified ${s.lastVerified}` : ""}`);
}

console.log(`_Generated from \`data/rules.json\` (lastVerified ${rulesJson.lastVerified}), \`data/timelines.json\` (lastVerified ${timelinesJson.lastVerified}) and \`data/pipeline-steps.json\` (checked ${pipelineStepsJson.checked}) by \`scripts/generate-sources.ts\`. Do not hand-edit this section — edit the data files and regenerate._\n`);

console.log("### ITAR & export control, eligibility, clearance process, sponsorship, reciprocity, continuous vetting, verification tech, pre-employment\n");
for (const rule of rulesJson.rules) {
  console.log(`**${rule.title}** (\`${rule.id}\`, ${rule.category})`);
  for (const s of rule.sources) printSource(s, "  ");
  console.log();
}

console.log("### Clearance investigation timelines\n");
console.log("**Secret clearance investigation**");
printSource(timelinesJson.investigations.secret.source, "  ");
console.log("\n**Top Secret clearance investigation**");
printSource(timelinesJson.investigations.ts.source, "  ");
console.log();
for (const m of timelinesJson.modifiers) {
  console.log(`**Modifier: ${m.id.replace(/_/g, " ")}**`);
  printSource(m.source, "  ");
  for (const s of m.additionalSources ?? []) printSource(s, "  ");
  console.log();
}

// The recruiter guide (/docs/recruiter) links each step to its law;
// those sources live in data/pipeline-steps.json.
console.log("### Recruiter guide: the 38 pipeline steps (`data/pipeline-steps.json`)\n");
for (const [key, s] of Object.entries(pipelineStepsJson.sources)) {
  const steps = pipelineStepsJson.steps.filter((step) => step.basis.some((b) => b.source === key)).map((step) => step.n);
  console.log(`- [${s.title}](${s.url}) — verified ${s.checked}${steps.length ? ` — ${steps.length === 1 ? "step" : "steps"} ${steps.join(", ")}` : ""}`);
}
console.log();
