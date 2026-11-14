import { describe, it, expect } from "vitest";
import { explainRuleTool } from "@/lib/tools/explain-rule";
import { RULES } from "@/lib/rules-data";
import { assertNoPiiCui } from "@/lib/guard/pii";

describe("explain_rule", () => {
  it("finds a rule by its exact id", async () => {
    const result = await explainRuleTool.handler({ topic: "itar-us-person" });
    expect(result.found).toBe(true);
    expect(result.topic?.id).toBe("itar-us-person");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("is case-insensitive and tolerates partial matches on id", async () => {
    const result = await explainRuleTool.handler({ topic: "ITAR-US-PERSON" });
    expect(result.found).toBe(true);
    expect(result.topic?.id).toBe("itar-us-person");
  });

  it("returns found:false plus the full topic list for an unknown topic — never a dead end", async () => {
    const result = await explainRuleTool.handler({ topic: "not_a_real_topic_xyz" });
    expect(result.found).toBe(false);
    expect(result.availableTopics?.length).toBe(RULES.length);
    expect(result.sources).toEqual([]);
  });

  it("every real rule id in the dataset is actually reachable through the tool (regression: catches a guard/matching bug silently blocking one, as once happened to nbis-diss)", async () => {
    for (const rule of RULES) {
      const result = await explainRuleTool.handler({ topic: rule.id });
      expect(result.found, `topic "${rule.id}" should be reachable`).toBe(true);
      expect(result.topic?.id).toBe(rule.id);
    }
  });

  it("every real rule's own title is also reachable (another real phrasing a user/agent would try)", async () => {
    for (const rule of RULES) {
      const result = await explainRuleTool.handler({ topic: rule.title });
      expect(result.found, `title "${rule.title}" should be reachable`).toBe(true);
    }
  });

  it("always includes the not-legal-advice disclaimer, found or not", async () => {
    const found = await explainRuleTool.handler({ topic: "sead4" });
    const notFound = await explainRuleTool.handler({ topic: "nonexistent" });
    expect(found.disclaimer.toLowerCase()).toContain("not legal advice");
    expect(notFound.disclaimer.toLowerCase()).toContain("not legal advice");
  });

  it("rejects an empty or over-length topic at the schema level", async () => {
    expect(explainRuleTool.inputSchema.safeParse({ topic: "" }).success).toBe(false);
    expect(explainRuleTool.inputSchema.safeParse({ topic: "x".repeat(61) }).success).toBe(false);
  });

  // Regression: the input schema's own description names "reciprocity" and
  // "continuous_vetting" as example topic keywords, but neither resolved —
  // "reciprocity" is a *category* value, not a rule id (the real id is
  // "sead7"), and "continuous_vetting" (underscore) didn't match the real id
  // "continuous-vetting" (dash). This list is kept manually in sync with
  // InputSchema's own `.describe()` text above (not parsed from it) — if the
  // description's examples change, update this list to match.
  it("every example keyword named in the tool's own input description actually resolves", async () => {
    const exampleKeywords = ["itar", "fcl", "reciprocity", "interim", "sf86", "continuous_vetting"];
    for (const keyword of exampleKeywords) {
      const result = await explainRuleTool.handler({ topic: keyword });
      expect(result.found, `example keyword "${keyword}" (from the tool's own description) should resolve`).toBe(
        true,
      );
    }
  });

  it("a bare category guess does not resolve when it's genuinely ambiguous (several rules share it)", async () => {
    const result = await explainRuleTool.handler({ topic: "clearance-process" });
    expect(result.found).toBe(false);
  });

  // Regression: "green_card", "lpr", and "permanent resident clearance" all
  // missed every rule because matching was exact-keyword over id/title/category
  // only. They now resolve to clearance-citizenship, not itar-us-person: a
  // green card holder asking about their status needs both answers — ITAR yes,
  // clearance no — and itar-us-person alone used to tell them the clearance
  // rule didn't apply to them.
  it.each(["green_card", "green card", "lpr", "permanent resident clearance", "LAWFUL PERMANENT RESIDENT"])(
    "resolves the natural-language synonym %s to clearance-citizenship via its keywords list",
    async (topic) => {
      const result = await explainRuleTool.handler({ topic });
      expect(result.found).toBe(true);
      expect(result.topic?.id).toBe("clearance-citizenship");
    },
  );

  // Regression: no tool explained that DoD clearance *eligibility* for
  // non-citizens (an LAA) is a separate, stricter regime than ITAR's "U.S.
  // person" test.
  it.each(["laa-non-citizen", "LAA", "limited access authorization", "non-citizen clearance"])(
    "resolves %s to the new laa-non-citizen rule",
    async (topic) => {
      const result = await explainRuleTool.handler({ topic });
      expect(result.found).toBe(true);
      expect(result.topic?.id).toBe("laa-non-citizen");
    },
  );

  // Regression: "permanent_resident" (underscore, no "clearance" suffix) and
  // the plain "permanent resident" still missed itar-us-person even after an
  // earlier keyword fix added several OTHER close variants.
  it.each(["permanent_resident", "permanent resident", "PERMANENT_RESIDENT"])(
    "resolves the natural-language synonym %s to clearance-citizenship via its keywords list",
    async (topic) => {
      const result = await explainRuleTool.handler({ topic });
      expect(result.found).toBe(true);
      expect(result.topic?.id).toBe("clearance-citizenship");
    },
  );

  it("itar-us-person's own content points a reader toward the separate, stricter LAA rule", async () => {
    const result = await explainRuleTool.handler({ topic: "itar-us-person" });
    expect(result.found).toBe(true);
    const fullText = JSON.stringify(result.topic);
    expect(fullText).toContain("laa-non-citizen");
  });
});

// S15a: a live walk-through asked explain_rule for the pre-employment steps and
// found nothing for background check, FCRA, I-9, E-Verify, reference check,
// offer letter, NDA or export license. Each new topic must now be found by the
// words a recruiter would actually type, and those words must get past the PII
// guard that runs on every tool input.
describe("explain_rule: pre-employment topics a recruiter asks about", () => {
  const RECRUITER_WORDS: Record<string, string[]> = {
    "fcra-background-check": ["background check", "Background Checks", "FCRA", "fair credit reporting act", "consumer report", "reference check", "FCRA disclosure", "fcra-background-check"],
    "fcra-adverse-action": ["adverse action", "pre-adverse action notice", "pre-adverse", "rescind offer", "summary of rights", "Adverse Action After a Background Check"],
    "fair-chance-timing": ["ban the box", "fair chance act", "fair-chance", "criminal history", "conviction record", "individualized assessment"],
    "form-i9": ["I-9", "i9", "Form I-9", "employment eligibility verification", "I-9 deadline", "section 2"],
    "e-verify": ["E-Verify", "everify", "e verify", "tentative nonconfirmation", "FAR 52.222-54", "STEM OPT E-Verify"],
    "offer-contingencies": ["offer letter", "conditional offer", "contingent offer", "offer contingencies", "accepted the offer in writing"],
    "confidentiality-invention-assignment": ["NDA", "PIIA", "confidentiality agreement", "invention assignment", "DTSA notice", "non-disclosure agreement"],
    "export-determination-after-offer": ["export license", "export licence", "export determination", "U.S. person determination", "restricted party screening", "consolidated screening list"],
  };

  it("adds exactly the eight topics the design lists, all present in the dataset", () => {
    const ids = RULES.map((r) => r.id);
    for (const id of Object.keys(RECRUITER_WORDS)) expect(ids, id).toContain(id);
  });

  it.each(Object.entries(RECRUITER_WORDS).flatMap(([id, words]) => words.map((w) => [w, id] as const)))(
    "%s → %s",
    async (topic, id) => {
      expect(explainRuleTool.inputSchema.safeParse({ topic }).success, `"${topic}" must fit the input schema`).toBe(true);
      expect(() => assertNoPiiCui({ topic }), `"${topic}" must pass the PII guard`).not.toThrow();
      const result = await explainRuleTool.handler({ topic });
      expect(result.found).toBe(true);
      expect(result.topic?.id).toBe(id);
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.disclaimer.toLowerCase()).toContain("not legal advice");
    },
  );

  it("each new topic's sources were checked on the day they were written, and none is a secondary write-up", () => {
    for (const id of Object.keys(RECRUITER_WORDS)) {
      const rule = RULES.find((r) => r.id === id)!;
      for (const s of rule.sources) {
        expect(s.lastVerified, `${id}: ${s.title}`).toBe("2026-11-13");
        expect(s.url, `${id}: ${s.url}`).toMatch(/(\.gov|law\.cornell\.edu|california\.public\.law|acquisition\.gov)\//);
      }
    }
  });

  it("the words that still have no topic return the full list, never a dead end", async () => {
    // "drug test" stays out: neither the DFARS clause nor the California rule's
    // text could be confirmed.
    const result = await explainRuleTool.handler({ topic: "drug test" });
    expect(result.found).toBe(false);
    expect(result.availableTopics?.map((t) => t.id)).toEqual(expect.arrayContaining(Object.keys(RECRUITER_WORDS)));
  });

  it("existing lookups still resolve to the same rules after the additions", async () => {
    for (const [topic, id] of [
      ["itar", "itar-us-person"],
      ["interim", "interim-clearance"],
      ["reciprocity", "sead7"],
      ["deemed export", "deemed-export"],
      ["green card", "clearance-citizenship"],
    ] as const) {
      expect((await explainRuleTool.handler({ topic })).topic?.id, topic).toBe(id);
    }
  });
});
