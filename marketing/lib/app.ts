/**
 * Which of the two agents the page is shown in. One state drives everything: the rolling name in a headline,
 * the selected pill in the switch, the phone's skin.
 *
 * Until the visitor chooses, it alternates by itself, on one clock, for as long as a headline with the
 * rolling name in it is on screen (components/AgentName.tsx tells this file when one is); with none on
 * screen it holds whichever app is showing, so nothing changes under the reader. Choosing an app in the
 * switch stops the alternation for good and is remembered for the viewer. `?app=grok` or `?app=muse` fixes
 * it and turns the alternation off: for captures and tests.
 */
export type AppId = "grok" | "muse";

export const APPS: Record<AppId, { name: string }> = {
  grok: { name: "Grok Bot" },
  muse: { name: "Muse" },
};

const KEY = "cleared.app";
let current: AppId = "grok";
/** True once the visitor (or the address) has chosen: nothing changes it by itself after that. */
let chosen = false;
/** True once the app has changed while the page was open: from then on a rolling name moves when it changes. */
let turned = false;
let chosenTimes = 0;
let restored = false;
const listeners = new Set<() => void>();

function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const fixed = new URLSearchParams(window.location.search).get("app");
    const saved = fixed === "grok" || fixed === "muse" ? fixed : window.localStorage.getItem(KEY);
    if (saved === "grok" || saved === "muse") {
      current = saved;
      chosen = true;
    }
  } catch {
    // No storage here (private mode, a blocked site): the choice lasts for this visit.
  }
}

export function getApp(): AppId {
  restore();
  return current;
}

/** The visitor chooses: it holds for the whole page and is remembered. */
export function setApp(next: AppId) {
  restore();
  chosen = true;
  retime();
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // As above.
  }
  if (next === current) return;
  current = next;
  turned = true;
  chosenTimes++;
  listeners.forEach((listener) => listener());
}

/** How many times the visitor has changed the app themselves (the hero's conversation plays again each time). */
export function choices(): number {
  return chosenTimes;
}

export function hasTurned(): boolean {
  return turned;
}

/** The clock's own turn to the other app. Does nothing once the visitor has chosen. */
function alternate() {
  if (chosen) return;
  current = current === "grok" ? "muse" : "grok";
  turned = true;
  listeners.forEach((listener) => listener());
}

/* ── The one clock ── */

/** The rolling names on screen right now, each with how long it holds a name (milliseconds). */
const onScreen = new Map<object, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let period = 0;
let held = false;

function retime() {
  const hold = chosen || held || onScreen.size === 0 ? 0 : Math.min(...onScreen.values());
  if (hold === period) return;
  if (timer) clearInterval(timer);
  timer = hold ? setInterval(alternate, hold) : null;
  period = hold;
}

/** A rolling name says it is on screen (and how long it holds each name), or that it no longer is (`null`). */
export function rolling(key: object, hold: number | null) {
  restore();
  if (hold === null) onScreen.delete(key);
  else onScreen.set(key, hold);
  retime();
}

/** Holds the clock while something is open over the page (a card's sheet), and lets it go again. */
export function holdRolling(yes: boolean) {
  held = yes;
  retime();
}

export function subscribeApp(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
