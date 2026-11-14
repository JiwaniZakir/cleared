/**
 * The six "first week" job-preview scenes (run_job_preview).
 * Authored, static content — not derived from any specific job posting, by
 * design: these are general realities of early defense-tech work, unlike
 * build_trial_assessment which MUST derive from the specific posting.
 * Setup text may reference the role/company for light personalization.
 *
 * Design grounded in realistic-job-preview and work-sample research:
 * - downsides are played straight, not softened — RJP evidence shows
 *   honest previews don't meaningfully reduce acceptance (r = .02).
 * - every scene offers genuine choices with differentiated, plausible
 *   consequences — never a disguised single "correct" path.
 * - the debrief asks what-happened, an honesty check, a role-clarity check,
 *   and a never-scored values reflection.
 * - the ITAR scene requires an actual decision + stated rationale (the
 *   same behavioral-sample shape as the trial assessment) and must never
 *   generate or request real technical data; the clearance-wait and SCIF
 *   scenes are written as lived-in logistics, not abstract policy text.
 *
 * Each choice's consequence used to be labelled
 * "what real teams report" and phrased as reports from people ("most
 * engineers report…", "several describe…"), with no survey or study behind
 * them. They are now `possibleOutcome`: plausible consequences written by
 * cleared, phrased as such, with no claim about what anyone reported.
 * Where an outcome states a rule, it names the explain_rule topic
 * (`citesRule`), and run_job_preview adds that rule's sources to sources[].
 * The clearance-wait and SCIF scenes now appear only for roles whose posting
 * states or implies a clearance; other roles get an access-wait week and a
 * moved-date scene in their place, so the scene counts stay 4 and 6.
 */

export interface SceneChoice {
  id: string;
  label: string;
  /** Written by cleared: a plausible consequence, not a report or a statistic. */
  possibleOutcome: string;
  /** The explain_rule topic behind a rule this outcome states, if any. */
  citesRule?: string;
}

/** A Senior Manufacturing Engineer once got a standup about a "telemetry
 *  ingest fix". Scene 1's competing priorities, scene 2's spec and the
 *  moved-date scene's milestone come from the role's family; every other
 *  scene fits any role. */
export type RoleFamily = "software" | "hardware" | "business";

const COMPETING_PRIORITIES: Record<RoleFamily, string> = {
  software: "the telemetry ingest fix AND the demo",
  hardware: "the fixture rework on the line AND the first-article inspection report",
  business: "the supplier quote comparison AND the customer briefing deck",
};

/** Scene 2 used to say "a new feature" for any title containing
 *  "engineer", manufacturing engineers included. */
const SPEC_SUBJECT: Record<RoleFamily, string> = {
  software: "a new feature",
  hardware: "a new test fixture",
  business: "a new deliverable",
};

const MOVED_MILESTONE: Record<RoleFamily, string> = {
  software: "demo",
  hardware: "test event",
  business: "program review",
};

/** Which roles a scene is for. "clearance" scenes need a posting that states
 *  or implies a clearance; "no_clearance" scenes take their place otherwise. */
export type SceneAudience = "any" | "clearance" | "no_clearance";

export interface JobPreviewScene {
  id: string;
  title: string;
  includedInShortVersion: boolean; // the 4 scenes shown at minutes=20
  audience: SceneAudience;
  setup: (roleTitle: string, company: string, family: RoleFamily) => string;
  choices: SceneChoice[];
  requiresStatedRationale: boolean;
  debriefPrompts: string[];
}

const STANDARD_DEBRIEF = (scene: string) => [
  `What did you choose, and what would you do differently now, for this ${scene}?`,
  "Honesty check: did this feel like an accurate picture, including the parts that weren't flattering?",
  "Role clarity check: what's still unclear to you about this part of the job?",
];

export const JOB_PREVIEW_SCENES: JobPreviewScene[] = [
  {
    id: "standup_priority",
    title: "The vague standup priority",
    includedInShortVersion: true,
    audience: "any",
    setup: (roleTitle, company, family) =>
      `It's your third day as a ${roleTitle} at ${company}. In standup, your lead says: "We need ${COMPETING_PRIORITIES[family]} for Thursday — whichever you get to first." Nobody says which one actually matters more, and your lead is already halfway out the door to another meeting.`,
    choices: [
      {
        id: "ask_now",
        label: "Stop your lead for 60 seconds and ask directly which one is actually blocking something.",
        possibleOutcome:
          "You get a one-sentence answer and know which task blocks something. A lead juggling several meetings may not sequence a new hire's work unprompted, so a short, direct question is a reasonable ask. The cost is a minute, and maybe a curt answer from someone in a hurry; you have the information either way.",
      },
      {
        id: "pick_yourself",
        label: "Make a judgment call yourself based on what seems more urgent, and flag your reasoning in Slack afterward.",
        possibleOutcome:
          "This can work, and writing your reasoning down gives someone the chance to correct you early. In your first week you may not yet know which system sits on a customer's critical path, so a wrong guess is possible; if the flag goes out early, the cost of one is rework you can still recover before Thursday.",
      },
      {
        id: "do_both_partially",
        label: "Try to make visible progress on both at once.",
        possibleOutcome:
          "Splitting focus between two real tasks under a deadline risks neither being done by Thursday, and two half-finished tasks are harder to explain than one finished task and an honest \"not yet\" on the other.",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: STANDARD_DEBRIEF("ambiguous-priority situation"),
  },
  {
    id: "ambiguous_spec",
    title: "The ambiguous spec",
    includedInShortVersion: true,
    audience: "any",
    setup: (_roleTitle, _company, family) =>
      `You're handed a one-paragraph spec for ${SPEC_SUBJECT[family]}. It describes the "what" in two sentences and says nothing about edge cases, failure modes, or who the actual internal customer is.`,
    choices: [
      {
        id: "write_doc",
        label: "Write a short doc naming your assumptions and send it for a 10-minute review before building anything.",
        possibleOutcome:
          "Writing your assumptions down costs about an hour and gives someone a cheap chance to correct them before you build; it often surfaces who the real internal customer is. On a team too busy to review promptly, it can cost you a day of waiting.",
      },
      {
        id: "build_and_show",
        label: "Build your best interpretation and show it, treating the demo itself as the question.",
        possibleOutcome:
          "Showing a working interpretation can be the fastest route to a real answer on a team that prefers demos to documents. If your reading is far off, you have spent real time on the wrong thing, and a defense spec can hide a compliance or safety constraint the prose doesn't mention.",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: STANDARD_DEBRIEF("ambiguous spec"),
  },
  {
    id: "ethics_tradeoff",
    title: "The weapons-adjacent tradeoff",
    includedInShortVersion: false,
    audience: "any",
    setup: () =>
      `A design review surfaces a real tradeoff: a targeting-adjacent system can be made meaningfully more reliable, but that also makes it more effective at its lethal purpose. Someone in the room asks, half-joking, half-not: "are we actually okay with this?" The room looks at you, the newest person, along with everyone else.`,
    choices: [
      {
        id: "name_it_directly",
        label: "Say plainly that you think the question deserves a real answer, not a joke, and ask how the team actually thinks about it.",
        possibleOutcome:
          "You give the team a chance to say how it thinks about this, and how the room responds tells you something about the team: a considered answer is a good sign; a question that gets waved off is worth noticing.",
      },
      {
        id: "defer_quietly",
        label: "Let the moment pass and focus on the technical merits — it's not really your call this early.",
        possibleOutcome:
          "Nobody is likely to fault a new hire for letting the moment pass. If the discomfort stays with you after you've thought it over, treat it as a real signal about fit, not something you're supposed to grow out of.",
      },
      {
        id: "raise_privately_later",
        label: "Say nothing in the room, but bring it up one-on-one with your manager afterward.",
        possibleOutcome:
          "A one-on-one can get you a more candid answer than a room allows, and it is the more comfortable route for a new hire. The tradeoff: the rest of the team doesn't get to hear the conversation.",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: [
      "What did you choose, and why — what does that choice say about where your own line is?",
      "Honesty check: did this scene feel like a real depiction of the kind of moment this work actually involves, rather than a sanitized version of it?",
      "This is a values reflection, never scored: is this a tradeoff you're comfortable sitting with on an ongoing basis, not just once?",
    ],
  },
  {
    id: "itar_moment",
    title: "The ITAR moment",
    includedInShortVersion: true,
    audience: "any",
    setup: (roleTitle, company) =>
      `A contractor on a joint project with ${company} — someone sharp, friendly, and clearly good at their job — mentions in passing that they're not a U.S. person, then asks you to send over "the drawing" for a subsystem you're both working around, just to move faster. You're the one with the file.`,
    choices: [
      {
        id: "decline_and_explain",
        label:
          "Decline to send it, and explain that it's likely ITAR-controlled technical data you can't share with a foreign person without a specific license — then offer to loop in your FSO or export-control lead to see what IS shareable.",
        possibleOutcome:
          "This is the answer export-control training teaches: controlled technical data goes to a foreign person only with authorization (explain_rule \"itar-us-person\"), and your export-control lead can tell you what is shareable. The awkwardness lasts a moment; a contractor who works in this field has probably heard the answer before.",
        citesRule: "itar-us-person",
      },
      {
        id: "send_it_to_be_helpful",
        label: "Send it — it seems like a small, low-stakes drawing, and you don't want to slow the project down over paperwork.",
        possibleOutcome:
          "This is the scenario export-control training exists to prevent. Releasing controlled technical data to a foreign person is treated as an export, and doing it without authorization is a violation however small or informal it felt (explain_rule \"deemed-export\" and \"itar-us-person\"). Wanting to be helpful is not a defence.",
        citesRule: "deemed-export",
      },
      {
        id: "ask_someone_else_first",
        label: "Tell the contractor you'll check and get back to them, then ask your lead or FSO before doing anything.",
        possibleOutcome:
          "Also safe, and the natural default before you have had export-control training. The only cost is a short delay for the contractor, which is small next to the alternative.",
      },
    ],
    requiresStatedRationale: true,
    debriefPrompts: [
      "What did you decide, and what's your one-sentence rationale for why?",
      "Honesty check: did this feel like a realistic version of the kind of moment ITAR actually comes up in day-to-day, rather than an abstract compliance lecture?",
      "Role clarity check: do you know who your FSO or export-control contact would actually be in a role like this, and would you know to ask?",
    ],
  },
  {
    id: "clearance_wait_week",
    title: "The clearance-wait week",
    includedInShortVersion: true,
    audience: "clearance",
    setup: (roleTitle, company) =>
      `Suppose this role needs the clearance its posting mentions, and your investigation is still open. For now, you're not read into the program ${company}'s team is building toward — so this week as a ${roleTitle} looks like: unclassified documentation cleanup, a training module, and sitting in on one meeting where half the room is talking around something you can tell they can't fully explain to you yet.`,
    choices: [
      {
        id: "use_it_well",
        label: "Treat it as genuinely useful ramp-up time — documentation and training are real, if unglamorous, ways to learn the codebase and the org.",
        possibleOutcome:
          "Documentation and training are real, if unglamorous, ways to learn the systems and the organization, and a team's docs are often behind — so the work can matter more than it feels like at the time.",
      },
      {
        id: "push_for_more",
        label: "Ask your manager directly whether there's any unclassified work closer to the team's actual mission you could pick up instead.",
        possibleOutcome:
          "A team that has planned for this may have an unclassified workstream ready for people waiting on a clearance. If it hasn't, the honest answer may be \"not yet\" — which is useful to know early.",
      },
      {
        id: "quietly_disengage",
        label: "Coast through the week and wait for the investigation to clear before really engaging.",
        possibleOutcome:
          "Investigations can take months rather than weeks (estimate_timeline and explain_rule \"dcsa-timeliness\" give the current published averages), so coasting can waste a long stretch you could have used to learn the job.",
        citesRule: "dcsa-timeliness",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: STANDARD_DEBRIEF("clearance-wait period"),
  },
  {
    id: "access_wait_week",
    title: "The access-wait week",
    includedInShortVersion: true,
    audience: "no_clearance",
    setup: (roleTitle, company) =>
      `It's your first week as a ${roleTitle} at ${company}. Your laptop works, but access to the systems and data your team actually works in is waiting on account tickets and required training modules, and your teammates are busy with their own deadlines.`,
    choices: [
      {
        id: "learn_around_it",
        label: "Use the time: do the required training, read everything you can already reach, and ask to shadow a teammate's work.",
        possibleOutcome:
          "When access arrives you already know the vocabulary and the people. Some of what you read may turn out to be out of date once you see the real systems, which is a small cost.",
      },
      {
        id: "chase_the_tickets",
        label: "Ask your manager to escalate the tickets and to name one teammate you can pair with until access lands.",
        possibleOutcome:
          "A manager may be able to unblock access faster than the ticket queue, and a named partner gives you someone to ask. It spends a little of your manager's attention in week one, which is part of what onboarding is for.",
      },
      {
        id: "wait_it_out",
        label: "Wait for access before really engaging.",
        possibleOutcome:
          "A quiet first week is easy to lose: when access arrives you start with little context while the team may expect you to be partly up to speed.",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: STANDARD_DEBRIEF("access-wait week"),
  },
  {
    id: "scif_life",
    title: "SCIF life: no phone, and the travel form",
    includedInShortVersion: false,
    audience: "clearance",
    setup: () =>
      `Today you're badging into a SCIF for the first time. Your phone stays in a locker at the door — no exceptions, all day. Separately, your security office reminds you that your upcoming personal trip abroad needs a foreign-travel report filed beforehand, even though it's just a family vacation.`,
    choices: [
      {
        id: "plan_around_it",
        label: "Rework your day around being unreachable (tell family/partner in advance, batch personal messages before badging in) and file the travel report promptly, even though it feels like overkill for a vacation.",
        possibleOutcome:
          "Telling family in advance and batching messages before you badge in makes the no-phone rule manageable; much of the adjustment falls on the people who expect quick replies from you. Filed promptly, the travel report becomes a routine form.",
      },
      {
        id: "resent_it",
        label: "Find the no-phone rule and the travel-reporting requirement intrusive, and say so.",
        possibleOutcome:
          "A strong reaction in the first days is normal. If it doesn't fade, that is a real signal that SCIF-heavy work may not suit you long-term — and either outcome is fine, not a personal failing.",
      },
      {
        id: "skip_quietly",
        label: "File the travel report late or incompletely since it's \"just a vacation.\"",
        possibleOutcome:
          "A bad idea: your security office told you the report is required, and under continuous vetting, records including foreign travel are checked automatically, and between checks a cleared person is expected to self-report qualifying events (explain_rule \"continuous-vetting\"). An unreported trip found later, even an innocent one, creates exactly the problem that process is built to flag.",
        citesRule: "continuous-vetting",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: [
      "What did you choose, and how do you think you'd actually feel about this after a few months of it, not just today?",
      "Honesty check: did this feel like real day-to-day texture rather than abstract policy text?",
      "Role clarity check: is there anything about SCIF life or travel reporting you'd want to ask a current employee about directly?",
    ],
  },
  {
    id: "moved_date",
    title: "The date that moved",
    includedInShortVersion: false,
    audience: "no_clearance",
    setup: (_roleTitle, company, family) =>
      `Two weeks in, ${company} learns that a customer ${MOVED_MILESTONE[family]} has moved up by a week. Your lead asks what you can still deliver by the new date.`,
    choices: [
      {
        id: "rescope_openly",
        label: "Say what fits by the new date, what doesn't, and what you would drop.",
        possibleOutcome:
          "Naming the tradeoff early lets your lead re-plan with real information. It can feel like admitting weakness in your second week; it isn't.",
      },
      {
        id: "absorb_quietly",
        label: "Say yes to everything and plan to work late to fit it in.",
        possibleOutcome:
          "It might work once. Done quietly, it hides the real schedule from the people planning it, and the next slip arrives with no warning to anyone.",
      },
      {
        id: "ask_for_help",
        label: "Ask whether someone else can take one piece of it.",
        possibleOutcome:
          "Splitting the work can save the date if the piece is separable; if it isn't, the handover can cost more time than it saves.",
      },
    ],
    requiresStatedRationale: false,
    debriefPrompts: STANDARD_DEBRIEF("schedule change"),
  },
];

/** The scenes a role gets: clearance scenes only where its posting states or
 *  implies a clearance, their stand-ins otherwise. */
export function scenesFor(minutes: 20 | 30, impliesClearance: boolean): JobPreviewScene[] {
  return JOB_PREVIEW_SCENES.filter(
    (s) =>
      (minutes === 30 || s.includedInShortVersion) &&
      (s.audience === "any" || s.audience === (impliesClearance ? "clearance" : "no_clearance")),
  );
}

export const SHORT_VERSION_SCENE_COUNT = scenesFor(20, true).length;
export const FULL_VERSION_SCENE_COUNT = scenesFor(30, true).length;
