/**
 * Every word on the page, in one place: headlines in Title Case with full stops, body text in sentence case.
 * Nothing on the page or on the phone's screen is written anywhere else.
 */
import pool from "@/data/pool.json";
import { PRODUCT } from "./product";

export const BUTTON = "Copy the Message";
export const COPIED = "Copied";

/**
 * Where a headline has the agent's own name in it: it rolls between Muse and Grok Bot, each with its mark
 * (components/AgentName.tsx). There are exactly three such headlines: the hero, stop 02 and the close.
 * Where nothing may move, and to a screen reader, it reads "Grok Bot or Muse".
 */
export const AGENT = "{app}";
export const AGENT_OR = "or";
/** A rolling line as plain words, for a label or a title that cannot roll. */
export const spoken = (line: string) => line.replace(AGENT, `Grok Bot ${AGENT_OR} Muse`);

export const HERO = {
  eyebrow: "For students and new graduates",
  /** "Get Hired for Defense Through Your Muse." The middle word is set in the prism. */
  title: ["Get Hired for ", "Defense", ` Through Your ${AGENT}.`] as const,
  /** What to do with the message, in three steps. It names the chosen app; it does not roll. */
  second: `Send ${AGENT} this message. It checks each role's visa and clearance rules, then sends only what you approve.`,
  /** Under the message's field (hero and close): what the MCP server is, in plain words, and what to do with it. It names the chosen app too. */
  caption: `The MCP server is the link that adds ${PRODUCT.name} to your ${AGENT}. Paste the message once.`,
  runsInside: "Runs inside",
};

export const BRIDGE = {
  title: "Four Checks Before Anything Is Sent.",
  /** Under the title: what the picture shows. */
  line: "Agents check immigration first, then export control, clearance and fit. You approve what goes.",
  /** Over the phone: "You, in Grok Bot" or "You, in Muse". */
  you: "You, in",
  /** Under cleared's mark, over the checks. */
  layer: "Agents run every check",
  /** The four checks, in the order a student meets them, and what each one finds for five roles and a student on OPT. */
  checks: ["Immigration and visa", "Export control", "Clearance eligibility", "Vetting"] as const,
  /** The checks say what each posting asks for, never what you may legally do. */
  verdicts: ["You said OPT. 5 checked.", "2 ask for a U.S. person", "3 don't ask for a clearance", "You practice the role's first week. Then one real task."] as const,
  /** Beside the roles as they leave your phone, and where three arrive. */
  train: "5 roles",
  sent: "3 sent",
  /** Before the three arrive, on the phone: the agent asks, you approve, then they go. */
  ask: "Week and task done. 3 are ready. Send them?",
  send: "Send",
  approved: "Sent. You approved.",
  /** Beside the two roles that stay at Export control: the role's own requirement closes them. */
  held: "OPT holders are not U.S. persons",
  /** In view at the checks: what they do, and what they do not. */
  limits: "Checks compare postings with what you said. No status is verified. Not legal advice.",
  source: "Source",
  /** The far end: the largest label on the page, and once, what these companies are. */
  companies: "speedrun defense companies",
  listings: "Names and open-role counts from the a16z speedrun Talent Network's public listings.",
  /** Where the three cross to the companies: set large for that beat, with who decides under it. */
  direct: "Direct line. No application form.",
  /** At stop 05 the label only: the full sentence is said once, on the bridge. */
  directLabel: "Direct line.",
  /** At stop 05, in view while the application runs the line: what happens to it, in the abstract. No company, provider or model is named. */
  backend: ["Into the company's hiring pipeline", "Agents read your evidence against each requirement", "A person on the hiring team decides"] as const,
  /** Who receives an application, and who decides: published exactly as written. */
  decides: "Applications go straight to the hiring teams of companies in the a16z speedrun Talent Network. A person at each company decides.",
};

/** The pool at the far end: the companies with open defense and space roles on the speedrun Talent Network's public listing. */
export const POOL = {
  date: pool.date,
  roles: pool.roles,
  companies: pool.companies,
  count: `${pool.companies.length} companies · ${pool.roles.toLocaleString("en-US")} open roles`,
};

export type Advantage = {
  id: string;
  index: string;
  /** Beside the count: which part of the bridge this stop is. Not every stop has one. */
  eyebrow?: string;
  title: string;
  /** Under the title, on the card. */
  opener: string;
  /** The card's remaining lines: only in the open sheet. */
  lines: readonly string[];
};

/** The five stops along the bridge by day, in the order a student meets them. */
export const ADVANTAGES: readonly Advantage[] = [
  {
    id: "connector",
    index: "01",
    title: "One Connector.",
    opener: `No new app. One message adds ${PRODUCT.name} to the agent you already use.`,
    lines: [`The MCP server is the link that adds ${PRODUCT.name} to your agent. Paste the message in your agent's chat and it connects.`, "You add it once.", "Roles come from the a16z speedrun Talent Network. Defense and space."],
  },
  {
    id: "rules",
    index: "02",
    eyebrow: "Three legal checks",
    title: "Immigration Rules, Checked First.",
    opener: "Your agent checks each role's stated requirements against the visa or citizenship you tell it. For export-controlled work, F\u20111/OPT, H\u20111B, J\u20111, TN, O\u20111 and L\u20111 holders are not U.S. persons.",
    lines: [
      "For export-controlled work, a U.S. person is a citizen, green-card holder, refugee or asylee.",
      "A security clearance requires citizenship.",
      "Not legal advice. It goes by what you tell it and verifies no status or clearance.",
    ],
  },
  {
    id: "week",
    index: "03",
    eyebrow: "Vetting, part one",
    title: "The First Week, Simulated.",
    opener: "Before you apply, your agent runs you through scenes from the role's first week.",
    // True to the job-preview tool (lib/tools/run-job-preview.ts): 4 or 6 scenes, one chosen from the posting's own signals.
    lines: ["Four to six short scenes, one at a time, in your chat.", "One follows the posting: a week waiting on a clearance, or on access.", "You see what the work is like before you apply."],
  },
  {
    id: "task",
    index: "04",
    eyebrow: "Vetting, part two",
    title: "One Real Task.",
    opener: "For a role you want, you get a short, real task built from its posting.",
    lines: ["The scoring is shown before you start.", "You see how you would fit.", "If you apply, the company sees how you work."],
  },
  {
    id: "resume",
    index: "05",
    title: `Your ${AGENT} Is Your Live Resume.`,
    opener: "No forms. No resume to upload. It writes the application from what it already knows.",
    lines: [
      "It shows you what it will send.",
      "It sends when you say yes.",
      // What happens next, in full.
      "Approved, your application goes straight into the hiring pipeline of the company that posted the role. No form, no careers page.",
      "There, agents read your evidence against each of the role's stated requirements.",
      "A person on the hiring team reviews it and decides. Nothing is rejected automatically.",
    ],
  },
];

export const NIGHTS: Advantage = {
  id: "nights",
  index: "06",
  title: "It Works Nights.",
  opener: "You can wake up to an interview request.",
  lines: [
    "Your agent watches for matching roles and answers requests.",
    "It lines up interview times.",
    "A person chooses who to interview and hire. You accept an offer yourself.",
  ],
};

export const ADVANTAGE_COUNT = ADVANTAGES.length + 1;

export const START = {
  title: `You Already Have ${AGENT}.`,
  send: "Send It This Message.",
  trust: ["A person makes every hiring decision.", "Your agent sends only what you approve.", "Every rule comes with its source."] as const,
};

export const FOOTER = {
  rights: `© 2026 ${PRODUCT.name}`,
  pool: `Company names and counts are from the a16z speedrun Talent Network's public listings, as of ${pool.date}. A listing is not an endorsement. Logos are trademarks of their owners.`,
};

/**
 * The words on the phone's screen, station by station. Nothing else
 * is written on the screen but the app's own interface labels (components/stage/screen.ts). Where the two
 * apps say a thing differently, there is a line for each.
 */
export const PHONE_COPY = {
  /** The hero: what the student typed (lowercase, as typed), what the agent says while it works, and its answer. */
  hero: {
    user: "find defense jobs i can apply to on opt",
    /** Grok Bot's working row, and the second line of Muse's name while it works. */
    working: { grok: `Checking ${PRODUCT.name}`, muse: `🔎 checking ${PRODUCT.name}` },
    /** The answer, in two sentences: on the bridge the second arrives when the two roles are held. */
    found: "Found 5 in the a16z speedrun Talent Network.",
    split: "Two ask for a U.S. person. Three don't.",
    /** The five roles, titles only; one role (the first) runs through the later screens. No company is named. */
    roles: [
      { title: "Flight Software Intern" },
      { title: "Manufacturing Engineer" },
      { title: "Avionics Test Engineer" },
      { title: "GNC Engineer", tag: "U.S. person" },
      { title: "RF Systems Engineer", tag: "U.S. person" },
    ],
    /** How the answer shows it came through cleared: Grok Bot's link at the end of the bubble, Muse's card under it. */
    via: `${PRODUCT.name} · 5 roles`,
  },
  /** Stop 01: the connect moment, in the chat. The student's message is the page's own (`PRODUCT.message`). */
  connect: {
    caption: "speedrun defense jobs",
    done: { grok: `${PRODUCT.name} is connected.`, muse: `${PRODUCT.name} is connected and I just verified the link works.` },
  },
  /** Stop 02: three rows that tick with the panes, each with a pill naming the domain its rule is published on. */
  checks: ["Immigration rule, checked", "Export control rule, checked", "Clearance rule, checked"],
  sources: ["uscis.gov", "ecfr.gov", "dcsa.mil"],
  /** Stop 03: the first week. Monday's scene, for the one role that runs through these screens. */
  week: { agent: "Here's the role's first week. Start with Monday.", scene: "Monday: a bench test fails. You're asked why." },
  /** Stop 04: the task, how long it takes, and what is scored. */
  task: {
    agent: "A short task for this role. It's read against 3 criteria.",
    title: "Find the fault in a telemetry log",
    time: "45 minutes",
    scored: ["Finds the fault", "Explains the cause", "Tests the fix"],
    /** Once it is done, read back criterion by criterion in the product's own words: no score, no rank. */
    read: ["aligned", "aligned", "unclear"],
  },
  /** Stop 05: the agent's line, the application as it will be sent, and the question Muse asks before it sends. */
  apply: {
    agent: "Drafted from what I know. Approve to send.",
    card: "Application: flight software intern",
    lines: ["Senior project: a drone flight controller in C++", "Evidence for 6 of 7 stated requirements", "Task: telemetry log, read against 3 criteria", "Work authorization: OPT, as you told me"],
    question: `Allow Muse to send an application in ${PRODUCT.name}?`,
  },
  /** Stop 06: the lock-screen notification. */
  night: { title: "Interview request", body: "A speedrun defense company asked when you're free." },
} as const;

/** What each picture is, for someone who cannot see it. */
export const ALT = {
  hero: "A phone showing a chat with an AI agent. You asked it to find defense jobs you can apply to on OPT; it found five in the a16z speedrun Talent Network, and two of them ask for a U.S. person.",
  bridge:
    "A bridge in three parts. At one end, you and your phone, in Grok Bot or Muse. In the middle, four glass checkpoints run by agents: immigration and visa, export control, clearance eligibility, vetting. Five role cards leave the phone and pass through them. Two stay at export control, because those roles ask for a U.S. person. Your agent asks before it sends the other three; you approve, and they go on by a direct line and land on three company tiles at the far end, the speedrun defense companies.",
  connector: "A chat with your agent. You sent it the one message; it shows cleared as a connector, added, and says cleared is connected.",
  apply: "A chat with your agent. It has drafted an application for a flight software intern role, with your project, your evidence, how your task read against its three criteria and your work authorization as you told it, and asks you to approve it before it sends.",
  checks: "A chat with your agent. Three rules checked, each with the site its rule is published on: immigration, export control, clearance.",
  week: "A chat with your agent. It offers the role's first week, Monday to Friday, starting with Monday: a bench test fails, and you are asked why.",
  task: "A chat with your agent. It offers one short task for the role, finding the fault in a telemetry log in 45 minutes, with the three things it is scored on, and then reads your work back on each: finds the fault, aligned; explains the cause, aligned; tests the fix, unclear.",
  lock: "A phone's lock screen at night with one notification: Interview request. A speedrun defense company asked when you're free.",
};
