import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PIPELINE_STEPS, PIPELINE_STAGES, PIPELINE_GATES, PIPELINE_SOURCES, PIPELINE_TERMS } from "@/lib/pipeline-steps-data";

// /docs/recruiter is generated from data/pipeline-steps.json. These checks
// render the guide body and confirm it says what the data says, links every
// source with its checked date, and takes its "not built yet" notes from
// lib/pipeline-availability.ts alone.

async function render() {
  const { RecruiterGuide } = await import("@/components/recruiter-guide");
  return renderToStaticMarkup(React.createElement(RecruiterGuide));
}

const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/pipeline-availability");
});

describe("the recruiter guide", () => {
  it("shows every stage, every step and every gate from the data", async () => {
    const html = decode(await render());
    for (const stage of PIPELINE_STAGES) {
      expect(html, stage.id).toContain(`id="${stage.id}"`);
      expect(html).toContain(stage.whatHappens);
    }
    for (const step of PIPELINE_STEPS) {
      expect(html, `step ${step.n}`).toContain(`id="${step.id}"`);
      expect(html).toContain(step.title);
      expect(html).toContain(step.productDoes);
    }
    for (const gate of PIPELINE_GATES) expect(html, gate.id).toContain(gate.rule);
  });

  it("links every source it cites, each with its checked date", async () => {
    const html = decode(await render());
    const cited = new Set<string>([
      ...PIPELINE_STEPS.flatMap((s) => s.basis.map((b) => b.source)),
      ...PIPELINE_GATES.flatMap((g) => g.basis.map((b) => b.source)),
      ...PIPELINE_TERMS.flatMap((t) => (t.source ? [t.source] : [])),
    ]);
    expect(cited.size).toBeGreaterThan(20);
    for (const id of cited) {
      const source = PIPELINE_SOURCES[id];
      expect(html, id).toContain(`href="${source.url}"`);
    }
    expect(html).toMatch(/\(checked 2026-11-1\d\)/);
    // Every link to a source is followed by its date.
    const links = html.match(/<a href="https:[^"]+"[^>]*>[^<]*<\/a><span[^>]*>[^<]*<\/span>/g) ?? [];
    expect(links.length).toBeGreaterThan(30);
    for (const link of links) expect(link).toMatch(/\(checked \d{4}-\d{2}-\d{2}\)/);
  });

  it("defines each term before the first stage that uses it, and says it is not legal advice", async () => {
    const html = decode(await render());
    const firstStage = html.indexOf(`id="${PIPELINE_STAGES[0].id}"`);
    for (const term of PIPELINE_TERMS) {
      const at = html.indexOf(`>${term.term}</dt>`);
      expect(at, term.term).toBeGreaterThan(-1);
      expect(at, term.term).toBeLessThan(firstStage);
    }
    expect(html).toContain("not legal advice");
  });

  it("marks what is not built yet while the pipeline is unbuilt", async () => {
    const html = await render();
    expect(html).toContain("Not built yet");
    expect(html).toContain("designed but not built yet");
  });

  it("drops every not-built note once the one availability list names every slice", async () => {
    const all = new Set([...PIPELINE_STEPS.flatMap((s) => s.slices), ...PIPELINE_GATES.flatMap((g) => g.slices)]);
    vi.doMock("@/lib/pipeline-availability", async (importActual) => {
      const actual = await importActual<typeof import("@/lib/pipeline-availability")>();
      return { ...actual, isBuilt: (slices: readonly string[]) => slices.every((s) => all.has(s)) };
    });
    const html = await render();
    expect(html).not.toContain("Not built yet");
    expect(html).not.toContain("designed but not built yet");
    expect(html).not.toContain("until then, follow it yourself");
  });
});
