/**
 * The phone's screens, stop by stop, as data: which of the app's own screens, which bubbles and cards, and
 * how far each has come. Every word is from `PHONE_COPY` (lib/copy.ts); layout and labels are the apps' own
 * (screen.ts). The same state is drawn through either app's skin.
 *
 * Each state has an `id`: the phone shows one screen at a time and slides to the next when the id changes
 * (phone.ts). Within a screen, things arrive whole: a step is a whole number, never a dissolve.
 *
 * Wording lives in the copy file, rows and cards here, and the one sequence that runs on a clock (the hero's)
 * has its timings in `HERO_BEATS`: each can be changed without touching the painter.
 */
import { BRIDGE, PHONE_COPY } from "@/lib/copy";
import { PRODUCT } from "@/lib/product";
import type { ChatScreen, ConnectorsScreen, LockScreen } from "./screen";

/**
 * The hero's one sequence, in milliseconds: the student's bubble rises; the agent works (dots, then its
 * working row); the answer arrives whole. As both apps do it.
 */
export const HERO_BEATS = { bubble: 380, dots: 520, row: 640, reply: 320 } as const;
export const HERO_MS = HERO_BEATS.bubble + HERO_BEATS.dots + HERO_BEATS.row + HERO_BEATS.reply;

const asked = { kind: "user", text: PHONE_COPY.hero.user } as const;
/** The hero's conversation is magnified at least this much: its answer and the roles fill the screen, with no empty half under them. */
const HERO_ZOOM = 1.4;

/**
 * The hero: what you typed, the agent working, and its answer with the five roles it found as a list (two of
 * them tagged). `ms` is how far the sequence has run; at its end (the default) the screen is at rest.
 */
export const heroScreen = (ms: number = HERO_MS): ChatScreen => {
  const { bubble, dots, row, reply } = HERO_BEATS;
  const working = ms - bubble;
  if (ms >= bubble + dots + row) {
    return {
      kind: "chat",
      id: "hero",
      zoom: HERO_ZOOM,
      show: 1 + Math.min(1, (ms - bubble - dots - row) / reply),
      blocks: [asked, { kind: "agent", text: `${PHONE_COPY.hero.found} ${PHONE_COPY.hero.split}`, roles: PHONE_COPY.hero.roles, via: PHONE_COPY.hero.via }],
    };
  }
  return {
    kind: "chat",
    id: "hero",
    zoom: HERO_ZOOM,
    show: ms < bubble ? Math.max(0, ms / bubble) : 2,
    status: working >= 0 ? PHONE_COPY.hero.working.muse : undefined,
    blocks: [asked, { kind: "working", phrase: PHONE_COPY.hero.working.grok, row: working >= dots ? 1 : 0, beat: Math.max(0, working) / 300 }],
  };
};

/**
 * Your end of the bridge: the question and what the agent found, short enough to read on a phone standing
 * small. `split` adds the answer's second sentence, at the moment two of the five are held.
 */
export const foundScreen = (split = true, brief = false): ChatScreen => ({
  // (`brief` also leaves out where the answer came from: Muse shows it as a card of its own, too tall for a cropped phone.)
  kind: "chat",
  id: "hero",
  show: brief ? 1 : 2,
  // (`brief`: the answer alone, for a phone cropped to its live message.)
  blocks: [...(brief ? [] : [asked]), { kind: "agent", text: split ? `${PHONE_COPY.hero.found} ${PHONE_COPY.hero.split}` : PHONE_COPY.hero.found, via: brief ? undefined : PHONE_COPY.hero.via }],
});

/**
 * Your end of the bridge, before the three cross: the agent asks whether to send them, you press
 * Send (`pressed` 0..1), and it says they are sent (`sent`). The conversation has run on: where there is no
 * room for all of it, its earlier turns have gone up under the header. (`brief`: the ask alone, for a phone
 * cropped to its live message.)
 */
export const askScreen = (pressed = 0, sent = false, brief = false): ChatScreen => ({
  kind: "chat",
  // (The same conversation, run on: the phone does not slide to another screen.)
  id: "hero",
  show: brief ? 1 : 3,
  blocks: [...(brief ? [] : [asked, { kind: "agent", text: `${PHONE_COPY.hero.found} ${PHONE_COPY.hero.split}`, via: PHONE_COPY.hero.via } as const]), { kind: "ask", text: BRIDGE.ask, button: BRIDGE.send, pressed, done: sent ? BRIDGE.approved : undefined }],
});

/**
 * 01: the connect moment, in the chat, in four steps: the message standing in the composer (0); sent, and the
 * app offering cleared as a connector to add (1); added (2); the agent saying so (3).
 */
/** (`full`: at the close, its conversation magnified more than the hero's, as it is shorter, so it fills the screen.) */
export const connectScreen = (step = 3, full = false): ChatScreen => ({
  kind: "chat",
  id: "connect",
  zoom: full ? 1.6 : undefined,
  show: step >= 3 ? 3 : step >= 1 ? 2 : 0,
  field: step < 1 ? PRODUCT.message : undefined,
  blocks: [
    // The whole message, its address in full (three lines at most; four where it is magnified, at the close).
    { kind: "user", text: PRODUCT.message, lines: full ? 4 : 3 },
    { kind: "connector", caption: PHONE_COPY.connect.caption, on: step >= 2 ? 1 : 0 },
    { kind: "agent", text: PHONE_COPY.connect.done },
  ],
});

/** The connect card's opened view: the app's own list of connectors, with cleared in it. Shown on the review page only. */
export const connectorScreen = (on = 1): ConnectorsScreen => ({ kind: "connectors", id: "connectors", caption: PHONE_COPY.connect.caption, on });

/** 02: three rules, checked one by one (`done` of them so far), each with where it comes from. */
export const checksScreen = (done = 3): ChatScreen => ({
  kind: "chat",
  id: "checks",
  show: 1,
  blocks: [{ kind: "checks", rows: PHONE_COPY.checks.map((text, i) => ({ text, source: PHONE_COPY.sources[i] })), done }],
});

/** 03: the role's first week, Monday first, and Monday's scene. */
export const weekScreen = (filled = 1, brief = false): ChatScreen => ({
  kind: "chat",
  id: "week",
  show: 2,
  blocks: [...(brief ? [] : [{ kind: "agent", text: PHONE_COPY.week.agent } as const]), { kind: "week", filled, scene: PHONE_COPY.week.scene }],
});

/** 04: one short task: what it is, how long it takes, the three things it is scored on. */
/** (`read`: the task done and read back, criterion by criterion: the end of stop 04.) */
export const taskScreen = (brief = false, read = false): ChatScreen => ({
  kind: "chat",
  id: "task",
  show: 2,
  blocks: [...(brief ? [] : [{ kind: "agent", text: PHONE_COPY.task.agent } as const]), { kind: "task", title: PHONE_COPY.task.title, time: PHONE_COPY.task.time, scored: PHONE_COPY.task.scored, read: read ? PHONE_COPY.task.read : undefined }],
});

/**
 * (`brief`, on the three screens above and below: without the agent's line before the card, for a phone of
 * which only the top is in the picture.)
 *
 * 05: the application, drafted in its own words, in the app's own approval: Grok Bot's card under the agent's
 * line, Muse's "Needs review" block with that line inside it. `pressed` 0..1 is the approving button going down.
 */
/** (`short`: the approval with its title and its buttons only, for a phone of which only the top is in the picture: Send in view.) */
export const applyScreen = (pressed = 0, brief = false, short = false): ChatScreen => ({
  // (`brief` also makes Muse's sheet brief: see the approval block.)
  kind: "chat",
  id: "apply",
  show: 2,
  blocks: [
    ...(brief ? [] : [{ kind: "agent", text: PHONE_COPY.apply.agent, only: "grok" } as const]),
    { kind: "approval", title: PHONE_COPY.apply.card, lines: short ? [] : PHONE_COPY.apply.lines, question: PHONE_COPY.apply.question, detail: PHONE_COPY.apply.agent, pressed, brief },
  ],
});

/** 06: the lock screen at night, and the one notification. */
export const lockScreen = (minutes = 3 * 60 + 7, wake = 1, notif = 1, ago = "now"): LockScreen => ({ kind: "lock", id: "lock", minutes, wake, notif, ago, title: PHONE_COPY.night.title, body: PHONE_COPY.night.body });

/** Every state at rest, for the review page and the stills, and the moving ones caught part-way. */
export const ALL_SCREENS = [
  { id: "hero", name: "Hero", state: heroScreen() },
  { id: "hero-dots", name: "Hero, the agent working: dots", state: heroScreen(HERO_BEATS.bubble + 200) },
  { id: "hero-row", name: "Hero, the agent working: its row", state: heroScreen(HERO_BEATS.bubble + HERO_BEATS.dots + 300) },
  { id: "found", name: "Your end of the bridge", state: foundScreen() },
  { id: "ask", name: "Your end of the bridge, before the three cross: the agent asks", state: askScreen() },
  { id: "ask-sent", name: "Your end of the bridge: sent, as you approved", state: askScreen(0, true) },
  { id: "connect-paste", name: "01, the message in the composer", state: connectScreen(0) },
  { id: "connect-before", name: `01, sent: ${PRODUCT.name} not added yet`, state: connectScreen(1) },
  { id: "connect", name: `01, ${PRODUCT.name} added`, state: connectScreen() },
  { id: "connector", name: "01, the card's opened view (this page only)", state: connectorScreen() },
  { id: "checks", name: "02, three rules checked", state: checksScreen() },
  { id: "week", name: "03, the first week", state: weekScreen() },
  { id: "task", name: "04, one task", state: taskScreen() },
  { id: "task-read", name: "04, the task read back", state: taskScreen(false, true) },
  { id: "apply", name: "05, the application and the app's own approval", state: applyScreen() },
  { id: "night", name: "06, the lock screen", state: lockScreen() },
] as const;
