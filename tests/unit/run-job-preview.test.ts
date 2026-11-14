import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/speedrun/client", () => ({ getJob: vi.fn() }));
import { getJob } from "@/lib/speedrun/client";
import { runJobPreviewTool } from "@/lib/tools/run-job-preview";
import { JOB_PREVIEW_SCENES, SHORT_VERSION_SCENE_COUNT, FULL_VERSION_SCENE_COUNT } from "@/data/job-preview-scenes";
import { findRule } from "@/lib/rules-data";

function mockJob(descriptionText = "No requirements stated.", title = "Engineer") {
  vi.mocked(getJob).mockResolvedValueOnce({
    job: {
      id: "job-1",
      title,
      company: "Acme Defense",
      company_slug: "acme-defense",
      company_url: "https://x",
      url: "https://x",
      location: null,
      remote: false,
      function: "engineering",
      seniority: "mid",
      comp_min: null,
      comp_max: null,
      comp_currency: null,
      comp_period: null,
      published_at: "2026-01-01T00:00:00Z",
      stealth: false,
      tier: "a16z",
      status: "open",
      apply: null,
      description_text: descriptionText,
      labels: {},
    },
  });
}

describe("run_job_preview", () => {
  it("returns exactly the short-version scene count at minutes=20, and the full count at minutes=30", async () => {
    mockJob();
    const short = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 20 });
    expect(short.scenes).toHaveLength(SHORT_VERSION_SCENE_COUNT);

    mockJob();
    const full = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    expect(full.scenes).toHaveLength(FULL_VERSION_SCENE_COUNT);
    expect(SHORT_VERSION_SCENE_COUNT).toBe(4);
    expect(FULL_VERSION_SCENE_COUNT).toBe(6);
  });

  it("includes the ITAR moment scene in both versions, flagged as requiring a stated rationale", async () => {
    mockJob();
    const short = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 20 });
    const itarScene = short.scenes.find((s) => s.id === "itar_moment");
    expect(itarScene).toBeDefined();
    expect(itarScene!.requiresStatedRationale).toBe(true);
  });

  it("never pre-reveals outcomes alongside choice labels (instructs the agent to withhold them until after the user picks)", async () => {
    mockJob();
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    expect(result.instructionsForAgent).toMatch(/withhold/i);
    for (const scene of result.scenes) {
      for (const choice of scene.choices) {
        // The choice label itself must not leak its own consequence text.
        expect(choice).not.toHaveProperty("possibleOutcome");
      }
      expect(Object.keys(scene.possibleOutcomeByChoice).sort()).toEqual(
        scene.choices.map((c) => c.id).sort(),
      );
    }
  });

  it("every scene has at least 2 differentiated choices (never a disguised single-path quiz)", () => {
    for (const scene of JOB_PREVIEW_SCENES) {
      expect(scene.choices.length).toBeGreaterThanOrEqual(2);
      const consequences = scene.choices.map((c) => c.possibleOutcome);
      expect(new Set(consequences).size).toBe(consequences.length);
    }
  });

  it("every scene's debrief includes an honesty-check prompt (the one evidence-backed mediator)", () => {
    for (const scene of JOB_PREVIEW_SCENES) {
      expect(scene.debriefPrompts.some((p) => /honest/i.test(p))).toBe(true);
    }
  });

  it("describes a polygraph but never simulates one", async () => {
    mockJob();
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    expect(result.polygraphNote).toMatch(/never simulates/i);
  });

  // Regression: an invalid `minutes` value produced a bare "Invalid input" with
  // no indication of what values ARE valid, unlike this product's string-enum
  // fields elsewhere, which name their allowed options.
  it("names the allowed values when minutes is invalid", () => {
    const result = runJobPreviewTool.inputSchema.safeParse({ role_id: "job-1", minutes: 45 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /20 or 30/.test(i.message))).toBe(true);
    }
  });
});

// Live, a Saronic posting whose only signal was us_person_required got "you're
// not read into the program…".
describe("run_job_preview chooses clearance scenes from the role's own signals", () => {
  const US_PERSON_ONLY = "Must be a U.S. Person due to ITAR requirements.\n- Build autonomy software for surface vessels.";
  const STATES_SECRET = "Active Secret clearance required.\n- Build autonomy software for surface vessels.";
  const IMPLIES_CLEARANCE = "You will support DoD customers on government programs.\n- Build autonomy software.";

  it.each([20, 30] as const)("a U.S.-person-only posting gets no clearance-wait or SCIF scene (%i minutes)", async (minutes) => {
    mockJob(US_PERSON_ONLY);
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes });
    const ids = result.scenes.map((s) => s.id);
    expect(ids).not.toContain("clearance_wait_week");
    expect(ids).not.toContain("scif_life");
    expect(ids).toContain("access_wait_week");
    if (minutes === 30) expect(ids).toContain("moved_date");
    expect(result.scenes).toHaveLength(minutes === 20 ? 4 : 6);
    expect(JSON.stringify(result.scenes)).not.toMatch(/read into the program|investigation is still open|SCIF/i);
    expect(result.sceneSelection.clearanceScenes).toBe(false);
  });

  it.each([
    ["states a clearance", STATES_SECRET],
    ["implies one (government/DoD work)", IMPLIES_CLEARANCE],
  ])("a posting that %s gets the clearance-wait week and SCIF life", async (_label, text) => {
    mockJob(text);
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    const ids = result.scenes.map((s) => s.id);
    expect(ids).toContain("clearance_wait_week");
    expect(ids).toContain("scif_life");
    expect(ids).not.toContain("access_wait_week");
    expect(result.sceneSelection.clearanceScenes).toBe(true);
  });

  it("no outcome claims what real teams or people report; the output says outcomes are authored", async () => {
    for (const scene of JOB_PREVIEW_SCENES) {
      for (const choice of scene.choices) {
        expect(choice.possibleOutcome, `${scene.id}/${choice.id}`).not.toMatch(
          /\b(?:people|engineers|teams|most|several|many|a few|a minority|widely|consistently|commonly)\b[^.]{0,60}\b(?:report(?:s|ed)?|describe[ds]?|say|said|warn|regret|note)\b/i,
        );
        expect(choice.possibleOutcome).not.toMatch(/real teams report/i);
      }
    }
    mockJob();
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    expect(result.outcomesNote).toMatch(/written by cleared/i);
    expect(result.outcomesNote).toMatch(/not survey data/i);
    expect(result.instructionsForAgent).not.toMatch(/whatRealTeamsReport/);
  });

  it("an outcome that states a rule carries that rule's sources", async () => {
    mockJob(STATES_SECRET);
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 30 });
    const urls = result.sources.map((s) => s.url);
    for (const ruleId of ["itar-us-person", "deemed-export", "dcsa-timeliness", "continuous-vetting"]) {
      for (const source of findRule(ruleId)!.sources) expect(urls, ruleId).toContain(source.url);
    }
    for (const scene of JOB_PREVIEW_SCENES) {
      for (const choice of scene.choices) {
        if (choice.citesRule) expect(findRule(choice.citesRule)?.id, choice.citesRule).toBe(choice.citesRule);
      }
    }
  });
});

// Scene 2 once said "a new feature" for any title containing "engineer".
describe("run_job_preview scene 2 fits the role's family", () => {
  it.each([
    ["Senior Manufacturing Engineer", "a new test fixture"],
    ["Software Engineer, Autonomy", "a new feature"],
    ["Program Manager", "a new deliverable"],
  ])("%s gets %j", async (title, subject) => {
    mockJob("No requirements stated.", title);
    const result = await runJobPreviewTool.handler({ role_id: "job-1", minutes: 20 });
    const spec = result.scenes.find((s) => s.id === "ambiguous_spec")!;
    expect(spec.setup).toContain(`spec for ${subject}.`);
  });
});

// Found by the E2E suite: a new choice label starting "Finish the required
// training…" matched the player's own "Finish" button.
it("no choice label contains the scene player's own button names", () => {
  for (const scene of JOB_PREVIEW_SCENES) {
    for (const choice of scene.choices) {
      expect(choice.label, `${scene.id}/${choice.id}`).not.toMatch(/finish|next scene|reveal outcome|\bprevious\b/i);
    }
  }
});
