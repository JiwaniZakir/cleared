import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PIPELINE_STEPS,
  PIPELINE_STAGES,
  PIPELINE_GATES,
  PIPELINE_SOURCES,
  STEP_CLASSES,
  WHY_PERSON,
  stepsInStage,
} from "@/lib/pipeline-steps-data";
import { RULES } from "@/lib/rules-data";
import { BUILT_SLICES, isBuilt } from "@/lib/pipeline-availability";

// S15a: data/pipeline-steps.json is the project's step table as data. These
// checks run on the data alone.

describe("data/pipeline-steps.json: steps, classes and who must act", () => {
  it("has 38 steps, numbered 1 to 38 in order, with unique ids", () => {
    expect(PIPELINE_STEPS.map((s) => s.n)).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
    const ids = PIPELINE_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(38);
  });

  it("has the step table's totals: 10 agent, 9 prepare-and-sign, 17 named role, 2 government only", () => {
    const counts = Object.fromEntries(STEP_CLASSES.map((c) => [c, PIPELINE_STEPS.filter((s) => s.class === c).length]));
    expect(counts).toEqual({ AGENT: 10, "PREP+SIGN": 9, "NAMED ROLE": 17, "GOV ONLY": 2 });
  });

  it("names a role wherever the step table names one who must act, and none where it says the agent does it", () => {
    for (const step of PIPELINE_STEPS) {
      if (step.whoMustAct === "—") expect(step.namedRole, `step ${step.n}`).toBeNull();
      else expect(step.namedRole, `step ${step.n}`).toBeTruthy();
    }
  });

  it("says why a person must act for every step an agent cannot do alone", () => {
    for (const step of PIPELINE_STEPS.filter((s) => s.class !== "AGENT")) {
      expect(step.whyPerson, `step ${step.n}`).not.toBeNull();
      expect(Object.keys(WHY_PERSON), `step ${step.n}`).toContain(step.whyPerson);
    }
  });

  it("maps the four designated functions to the right product roles", () => {
    const roles = (n: number) => PIPELINE_STEPS[n - 1].productRoles;
    for (const n of [2, 26, 27, 29]) expect(roles(n), `FSO step ${n}`).toContain("security_officer");
    for (const n of [22, 24]) expect(roles(n), `export step ${n}`).toContain("export_lead");
    for (const n of [13, 19, 20, 21]) expect(roles(n), `decider step ${n}`).toEqual(["decider"]);
    expect(roles(17)).toEqual(["candidate"]);
  });
});

describe("data/pipeline-steps.json: sources, topics, stages and gates", () => {
  it("every law cited resolves to a source with a checked date, and every step either cites one or says why not", () => {
    for (const step of PIPELINE_STEPS) {
      for (const basis of step.basis) expect(PIPELINE_SOURCES[basis.source], `step ${step.n}: ${basis.source}`).toBeDefined();
      if (step.basis.length === 0) expect(step.basisNote, `step ${step.n} has no source and no note`).toBeTruthy();
    }
    for (const [key, source] of Object.entries(PIPELINE_SOURCES)) {
      expect(source.url, key).toMatch(/^https:\/\//);
      expect(source.checked, key).toMatch(/^2026-11-1[1-3]$/);
    }
  });

  it("every source the guide links is listed in SOURCES.md", () => {
    const sourcesMd = fs.readFileSync(path.join(process.cwd(), "SOURCES.md"), "utf8");
    const missing = Object.values(PIPELINE_SOURCES).filter((s) => !sourcesMd.includes(s.url)).map((s) => s.url);
    expect(missing).toEqual([]);
  });

  it("every explain_rule topic named exists, and each new pre-employment topic is used by at least one step", () => {
    const ruleIds = new Set(RULES.map((r) => r.id));
    for (const step of PIPELINE_STEPS) if (step.ruleTopic) expect(ruleIds, `step ${step.n}`).toContain(step.ruleTopic);
    const used = new Set(PIPELINE_STEPS.map((s) => s.ruleTopic));
    for (const id of ["fcra-background-check", "fcra-adverse-action", "fair-chance-timing", "form-i9", "e-verify", "offer-contingencies", "confidentiality-invention-assignment", "export-determination-after-offer"]) {
      expect(used, id).toContain(id);
    }
  });

  it("stages cover the 38 steps in order, with no gaps or overlaps", () => {
    const covered = PIPELINE_STAGES.flatMap((st) => stepsInStage(st.id).map((s) => s.n));
    expect(covered).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
    for (const st of PIPELINE_STAGES) {
      const ns = stepsInStage(st.id).map((s) => s.n);
      expect(ns[0], st.id).toBe(st.firstStep);
      expect(ns.at(-1), st.id).toBe(st.lastStep);
    }
  });

  it("carries the gates: no check before the offer, no clearance step before written acceptance, the adverse-action wait, named people", () => {
    const byId = new Map(PIPELINE_GATES.map((g) => [g.id, g]));
    expect(byId.get("G1")).toMatchObject({ notBefore: 14, steps: [16] });
    expect(byId.get("G2")).toMatchObject({ notBefore: 14, steps: [26, 27] });
    expect(byId.get("G3")).toMatchObject({ notBefore: 20, steps: [21] });
    expect(byId.get("G4")?.steps).toEqual(expect.arrayContaining([13, 19, 20, 21]));
    for (const gate of PIPELINE_GATES) {
      if (gate.notBefore !== null) expect(gate.steps, gate.id).not.toContain(gate.notBefore);
      for (const b of gate.basis) expect(PIPELINE_SOURCES[b.source], `${gate.id}: ${b.source}`).toBeDefined();
    }
  });

  it("names only real build slices, and today only S15a is marked built", () => {
    const known = new Set(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15a", "S15b", "S16"]);
    for (const step of PIPELINE_STEPS) for (const s of step.slices) expect(known, `step ${step.n}`).toContain(s);
    for (const gate of PIPELINE_GATES) for (const s of gate.slices) expect(known, gate.id).toContain(s);
    expect([...BUILT_SLICES]).toEqual(["S15a"]);
    expect(isBuilt(["S15a"])).toBe(true);
    expect(isBuilt(["S4", "S15a"])).toBe(false);
  });
});
