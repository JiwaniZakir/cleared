import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/speedrun/client", () => ({ getJob: vi.fn() }));
import { getJob } from "@/lib/speedrun/client";
import type { SpeedrunJobApply } from "@/lib/speedrun/types";
import { getRoleRubricTool } from "@/lib/tools/get-role-rubric";
import { readinessBriefTool } from "@/lib/tools/readiness-brief";
import { fitDebriefTool } from "@/lib/tools/fit-debrief";
import { prepareConsentedCardTool } from "@/lib/tools/prepare-consented-card";
import { callTool } from "@/lib/tools/wrap";

// `apply` is in the upstream job detail (every live defense posting checked on
// 2026-11-13 had kind "external", a Greenhouse-style ATS link) but resolveRole
// dropped it, so no tool could say where to apply; and the intro card couldn't
// name the signed statement sent with it.
const ATS_URL = "https://boards.greenhouse.io/acmedefense/jobs/5291814007?gh_jid=5291814007";

function mockJob(apply: SpeedrunJobApply | null) {
  vi.mocked(getJob).mockResolvedValue({
    job: {
      id: "job-1", title: "Flight Software Engineer", company: "Acme Defense", company_slug: "acme-defense",
      company_url: "https://x", url: "https://speedrun-talent-network.com/jobs/job-1", location: "Austin, TX",
      remote: false, function: "engineering", seniority: "mid", comp_min: null, comp_max: null, comp_currency: null,
      comp_period: null, published_at: "2026-01-01T00:00:00Z", stealth: false, tier: "a16z", status: "open",
      apply, description_text: "- Design and build real-time flight software in C++", labels: {},
    },
  });
}

beforeEach(() => vi.mocked(getJob).mockReset());

describe("how to apply is passed through", () => {
  const calls = [
    ["get_role_rubric", () => getRoleRubricTool.handler({ role_id: "job-1" })],
    ["readiness_brief", () => readinessBriefTool.handler({ role_id: "job-1" })],
    ["fit_debrief", () => fitDebriefTool.handler({ role_id: "job-1", loved: [], disliked: [] })],
    ["prepare_consented_card", () => prepareConsentedCardTool.handler({ role_id: "job-1", approved_fields: ["headline"] })],
  ] as const;

  it.each(calls)("%s names the company's own application page when the posting has one", async (_name, run) => {
    mockJob({ kind: "external", url: ATS_URL });
    const result = await run();
    expect(result.howToApply).toEqual({
      listingUrl: "https://speedrun-talent-network.com/jobs/job-1",
      applicationUrl: ATS_URL,
      kind: "external",
      note: expect.stringMatching(/Acme Defense's own application page.*never applies or submits/),
    });
  });

  it.each(calls)("%s falls back to the listing when the posting has no apply link", async (_name, run) => {
    mockJob(null);
    const result = await run();
    expect(result.howToApply.applicationUrl).toBeNull();
    expect(result.howToApply.note).toMatch(/apply from the listing page/);
  });

  it("passes on only a plain web link", async () => {
    mockJob({ kind: "external", url: "javascript:alert(1)" });
    const result = await getRoleRubricTool.handler({ role_id: "job-1" });
    expect(result.howToApply.applicationUrl).toBeNull();
  });
});

describe("the intro card can name its signed statement by key fingerprint only", () => {
  it("adds a fingerprint placeholder and a verify line, and never asks for claims", async () => {
    mockJob(null);
    const result = await prepareConsentedCardTool.handler({
      role_id: "job-1",
      approved_fields: ["headline", "signed_statement_key_fingerprint"],
    });
    const field = result.cardTemplate.fields.find((f) => f.name === "signed_statement_key_fingerprint");
    expect(field?.placeholder).toBe("{{signed_statement_key_fingerprint}}");
    expect(field?.guidance).toMatch(/keyFingerprint/);
    expect(field?.guidance).toMatch(/never the claims, the public key, or the signature/);
    expect(result.cardTemplate.markdown).toContain("**Signed statement (key fingerprint):** {{signed_statement_key_fingerprint}}");
    expect(result.cardTemplate.markdown).toMatch(/verify_signed_attestation: its keyFingerprint should match/);
  });

  it("has no statement line when the user didn't approve one", async () => {
    mockJob(null);
    const result = await prepareConsentedCardTool.handler({ role_id: "job-1", approved_fields: ["headline"] });
    expect(result.cardTemplate.markdown).not.toMatch(/Signed statement|verify_signed_attestation/);
  });

  it("the server takes the field's name only — a value sent alongside is not a card input", async () => {
    mockJob(null);
    const result = await callTool(prepareConsentedCardTool, {
      role_id: "job-1",
      approved_fields: ["signed_statement_key_fingerprint"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(JSON.stringify(result.data)).not.toMatch(/[0-9a-f]{16}(?![0-9a-f])/);
  });
});
