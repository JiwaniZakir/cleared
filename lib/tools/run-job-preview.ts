import { z } from "zod";
import { resolveRole, SPEEDRUN_SOURCE, RoleIdSchema, roleImpliesClearance } from "@/lib/tools/role-shared";
import { scenesFor, type RoleFamily } from "@/data/job-preview-scenes";
import { findRule } from "@/lib/rules-data";
import { DISCLAIMERS } from "@/lib/disclaimers";
import { SourceRefSchema, type SourceRef, type ToolDef } from "@/lib/tools/wrap";

const InputSchema = z.object({
  role_id: RoleIdSchema,
  // Explicit error message: a numeric literal union's default error
  // ("Invalid input") doesn't name the allowed values the way a string
  // z.enum's does elsewhere in this file.
  minutes: z.union([z.literal(20), z.literal(30)], { error: "minutes must be one of 20 or 30" }),
});

const SceneOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  setup: z.string(),
  choices: z.array(z.object({ id: z.string(), label: z.string() })),
  // Deliberately NOT included per choice up front — see instructionsForAgent.
  // Keyed by choice id so the agent reveals it only after the user decides.
  // Was `whatRealTeamsReportByChoice`, which claimed reports no source backs:
  // these are consequences cleared wrote.
  possibleOutcomeByChoice: z.record(z.string(), z.string()),
  requiresStatedRationale: z.boolean(),
  debriefPrompts: z.array(z.string()),
});

const OutputSchema = z.object({
  roleTitle: z.string(),
  company: z.string(),
  minutes: z.number(),
  instructionsForAgent: z.string(),
  scenes: z.array(SceneOutputSchema),
  aggregateDebriefPrompt: z.string(),
  outcomesNote: z.string(),
  /** Why these scenes: whether the posting states or implies a clearance. */
  sceneSelection: z.object({ clearanceScenes: z.boolean(), reason: z.string() }),
  polygraphNote: z.string(),
  itarSafetyNote: z.string(),
  sources: z.array(SourceRefSchema),
  disclaimer: z.string(),
});

// The DOI, not a personal-site upload of the PDF.
const EARNEST_2011: SourceRef = {
  title: "Earnest, Allen & Landis (2011) — Mechanisms linking realistic job previews with turnover: a meta-analytic path analysis, Personnel Psychology 64(4)",
  url: "https://doi.org/10.1111/j.1744-6570.2011.01230.x",
  lastVerified: "2026-11-13",
};

/** By title alone — the one field every posting has. Software is the default,
 *  matching most roles on the network. */
function roleFamily(title: string): RoleFamily {
  if (/\b(?:manufactur\w*|mechanical|electrical|hardware|production|assembly|machin\w*|technician|test (?:engineer|technician)|quality|propulsion|structures|composites|rf\b|avionics|integration and test|i&t|supply chain engineer)\b/i.test(title)) {
    return "hardware";
  }
  if (/\b(?:sales|business development|\bbd\b|account|finance|accounting|legal|counsel|recruit\w*|talent|people|hr\b|marketing|operations|program manager|procurement|contracts?|supply chain|strategy|chief of staff)\b/i.test(title)) {
    return "business";
  }
  return "software";
}

export const runJobPreviewTool: ToolDef<z.infer<typeof InputSchema>, z.infer<typeof OutputSchema>> = {
  name: "run_job_preview",
  title: "Run a first-week job preview",
  description:
    "Returns a complete 4-or-6-scene 'first week' realistic job preview script for the agent to run interactively with the user, one scene at a time — standup priorities, an ambiguous spec, (30-min only) an ethics tradeoff, an ITAR moment, and then, chosen from the posting's own signals: a clearance-wait week and (30-min only) SCIF/travel-reporting life when the posting states or implies a clearance, or an access-wait week and (30-min only) a moved deadline when it doesn't. Each choice's outcome is a plausible consequence written by cleared, not survey data. Scenes are played straight, not softened — realistic-job-preview research shows honest downsides don't meaningfully reduce acceptance; see sources[].",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async ({ role_id, minutes }) => {
    const role = await resolveRole(role_id);
    const family = roleFamily(role.title);
    const clearanceScenes = roleImpliesClearance(role.signals);
    const chosen = scenesFor(minutes, clearanceScenes);

    const scenes = chosen.map((scene) => ({
      id: scene.id,
      title: scene.title,
      setup: scene.setup(role.title, role.company, family),
      choices: scene.choices.map((c) => ({ id: c.id, label: c.label })),
      possibleOutcomeByChoice: Object.fromEntries(scene.choices.map((c) => [c.id, c.possibleOutcome])),
      requiresStatedRationale: scene.requiresStatedRationale,
      debriefPrompts: scene.debriefPrompts,
    }));

    // An outcome that states a rule carries that rule's sources.
    const sourcesByUrl = new Map<string, SourceRef>([[SPEEDRUN_SOURCE.url, SPEEDRUN_SOURCE]]);
    sourcesByUrl.set(EARNEST_2011.url, EARNEST_2011);
    for (const ruleId of new Set(chosen.flatMap((scene) => scene.choices.map((c) => c.citesRule)))) {
      if (!ruleId) continue;
      for (const source of findRule(ruleId)?.sources ?? []) sourcesByUrl.set(source.url, source);
    }

    return {
      roleTitle: role.title,
      company: role.company,
      minutes,
      instructionsForAgent:
        "Run this as a conversation, one scene at a time, not as a quiz dump. For each scene: show the setup and the choice labels only (withhold possibleOutcomeByChoice), let the user actually pick one, THEN reveal that choice's possibleOutcomeByChoice — as a plausible consequence, not as what real teams report — then ask the scene's debriefPrompts conversationally. If requiresStatedRationale is true, ask the user to state their one-sentence rationale before revealing the outcome. Never score or rank a choice as right/wrong — every choice has a real, differentiated consequence; the point is realistic texture, not a test. After the last scene, ask aggregateDebriefPrompt once.",
      scenes,
      aggregateDebriefPrompt:
        "Across everything you just saw — including the parts that weren't flattering — did this feel like an honest picture of the job? That question matters more than whether you're still interested.",
      outcomesNote:
        "Each outcome is a plausible consequence written by cleared to give the scene realistic texture. It is not survey data or a report from real teams. Where an outcome states a rule, it names the explain_rule topic, and that rule's sources are in sources[].",
      sceneSelection: {
        clearanceScenes,
        reason: clearanceScenes
          ? "The posting states or implies a security clearance, so the preview includes the clearance-wait week" + (minutes === 30 ? " and SCIF life." : ".")
          : "The posting states no clearance and implies none (no clearance level, polygraph, SCIF, or government-classified wording), so the preview uses an access-wait week" + (minutes === 30 ? " and a moved deadline instead of the clearance-wait and SCIF scenes." : " instead of the clearance-wait week."),
      },
      polygraphNote:
        "A polygraph may be part of some agencies'/programs' processes. This preview describes that fact; it never simulates or role-plays an actual polygraph exam.",
      itarSafetyNote: DISCLAIMERS.itarSafeTrial,
      sources: [...sourcesByUrl.values()],
      disclaimer: DISCLAIMERS.itarSafeTrial,
    };
  },
};
