/**
 * The director turns the scroll position into everything that moves.
 *
 * The page lays itself out in CSS. There are three sections ("chapters"): the hero, the show, and the start.
 * The show is one long section whose pin stays on screen while it passes; inside the pin are its three acts
 * (the bridge whole, the journey along it, the night), each with empty boxes ("slots") that say where the
 * phone and the set belong at this window size. The director measures those boxes, and for any scroll
 * position works out where the phone is, what its screen shows, where the camera stands, and what the bridge
 * is doing. So composition lives in the stylesheet, the stage has no layout of its own, and every value is a
 * function of scroll: it rewinds exactly and nothing is drawn unless something changed.
 *
 * It also switches the page's own words on and off as their moment comes (`data-on`; the words then arrive
 * and leave on their own clock), and tells the header which ground it is over.
 *
 * The show's clock, `tau`, is in viewport heights from the moment its pin takes hold: the bridge whole from
 * 0 to 1.5, the journey's five stations from 1.5 to 5.2, the night from 5.2 to 7.2.
 *
 * No three.js here: this file is in the page's first bundle and runs with or without the 3D stage.
 */
import { DISPLAY, PHONE } from "./dims";
import { live, type Box, type Pose, type SetGeometry } from "./live";
import type { ScreenState } from "./screen";
import { applyScreen, askScreen, checksScreen, connectScreen, foundScreen, HERO_MS, heroScreen, lockScreen, taskScreen, weekScreen } from "./states";
import { choices, subscribeApp } from "@/lib/app";

type Slot = Box & { el: HTMLElement };
type Cam = { eye: number; pan: number; lens: number };
type Act = { el: HTMLElement; slots: Record<string, Slot>; pose: Pose | null; cam: Cam };
type Chapter = { id: string; el: HTMLElement; pin: HTMLElement; top: number; height: number; pinH: number; slots: Record<string, Slot>; pose: Pose | null; cam: Cam; acts: Record<string, Act> };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 below `a`, 1 above `b`, straight in between. */
const lin = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
/** The same, eased at both ends: nothing on the stage starts or stops abruptly. */
const smooth = (v: number, a: number, b: number) => {
  const t = lin(v, a, b);
  return t * t * (3 - 2 * t);
};
const glide = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const bump = (t: number) => Math.sin(clamp(t) * Math.PI);
const mixPose = (a: Pose, b: Pose, t: number): Pose => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), h: lerp(a.h, b.h, t), rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), rz: lerp(a.rz, b.rz, t) });
const mixCam = (a: Cam, b: Cam, t: number): Cam => ({ eye: lerp(a.eye, b.eye, t), pan: lerp(a.pan, b.pan, t), lens: lerp(a.lens, b.lens, t) });

/** The show's story, in viewport heights from the moment its pin takes hold. */
const JOURNEY = 1.5;
// (Stop 02 is 0.7 of a screen, as long as 01: the checks' verdicts are told once, on the bridge.)
const STATIONS = [1.5, 2.2, 2.9, 3.5, 4.2, 5.2] as const;
/** Across a wide window, stop 02's three legal panes are shown at this share of the station's size. */
const LEGAL = 0.76;
/** At stop 05, where along it each of the three steps of what happens next arrives (the application runs from 0.4 to 0.66). */
const BRIDGE_STEPS = [0.42, 0.52, 0.62] as const;
/** The bridge whole: when the five roles leave the phone, and when two of them are held at Export control. */
const T = { lift: 0.15 } as const;
const HELD = 0.46;
/** Before the three cross: once they have cleared Vetting, the agent asks, you press Send, it says they are sent; then they go. */
const ASK = { ask: 0.92, press: [0.97, 1.01], sent: 1.01, go: 1.05 } as const;
/**
 * Down a narrow window, where each stop's prop stands (its middle, in px from the window's top): 01 the row,
 * with the plug on the lead-in; 02 the three legal panes; 03 and 04 the Vetting pane; 05 the wall. The words
 * under them are placed in the stylesheet at the same heights (`.journey__station` and its pieces).
 */
const PROP_Y = [700, 712, 640, 640, 702] as const;
const NIGHT = 5.2;
const END = 7.2;

let chapters: Chapter[] = [];
let header: HTMLElement | null = null;
/** The page's own buttons (the hero's, the start's), as top and bottom in the document: the header's button stands down while one of them is on screen. */
let ownButtons: [number, number][] = [];
/** The night card's box in the pinned viewport: left, top, right, bottom. */
let nightCard: [number, number, number, number] = [0, 0, 0, 0];
let stale = true;
let scheduled = 0;
let started = 0;
/** When the hero's one sequence began (the student's message, the agent working, its answer). */
let heroStarted = 0;
let seenChoices = 0;
let lastTime = 0;
let lastY = 0;
/** The night, 0 by day and 1 at night, moving toward its target on its own clock. */
let darkNow = 0;
let darkTarget = 0;
/** The pane that crosses the lens between stops: when it set off, which way, how far it has got (0..1), and the stop it last set off for. */
let sweepFrom = 0;
let sweepWay = 1;
let sweepNow = 1;
/** At night, the wall's one shared brightening as the notification lands: when it started, how far it has got, and whether the notification was in. */
let ringFrom = 0;
let ringNow = 1;
let rang = false;
const RING_MS = 1100;
let sweptAt = -2;
/**
 * The shot the camera holds along the journey (a stop, and down a narrow window stop 02's beat, as stop * 3 +
 * beat), the one it is leaving, and when it set off: a change of shot runs on its own clock, so a scroll that
 * stops never leaves the camera between two stops.
 */
let shotKey = -1;
let shotPrev = -1;
let shotFrom = 0;
const SHIFT_MS = 800;
/**
 * Things that arrive and leave on their own clock once the scroll has crossed a threshold, so that a scroll
 * that stops never leaves one half-way: how much of each is there (0..1), by name.
 */
const clocks: Record<string, number> = {};
let frameDt = 16;
let busy = false;
/** Moves a clocked thing toward 0 or 1 over `ms`, and says where it is now. */
function toward(name: string, target: number, ms: number): number {
  const now = clocks[name] ?? target;
  const next = now === target ? now : clamp(now + (target > now ? 1 : -1) * (frameDt / ms));
  clocks[name] = next;
  if (next !== target) busy = true;
  return next;
}
/** The bridge's frame: down a narrow window it is held at its own place while the show's pin comes up. */
let bridgeFrame: HTMLElement | null = null;
let pointer = { x: 0, y: 0 };
let fine = false;
let mode3d = false;
const subscribers = new Set<(time: number) => void>();
/** Elements the director switches on and off, by name. */
let steps = new Map<string, HTMLElement[]>();
/** The header's height. */
let headerH = 56;
/** The bridge's heading, held with the frame down a narrow window. */
let bridgeHead: HTMLElement | null = null;
/** Down a narrow window, where each stop's card ends (px from the pin's top): the phone stands just under it. */
let cardBottoms: number[] = [];

/** Switches a named piece of the page on or off. Its words then arrive, or leave, on their own clock. */
function on(name: string, yes: boolean) {
  for (const el of steps.get(name) ?? []) {
    const want = yes;
    if (want === (el.dataset.on === "1")) continue;
    if (want) el.dataset.on = "1";
    else delete el.dataset.on;
  }
}

function camOf(el: HTMLElement): Cam {
  const cs = getComputedStyle(el);
  const number = (name: string, fallback: number) => {
    const value = parseFloat(cs.getPropertyValue(name));
    return Number.isFinite(value) ? value : fallback;
  };
  return { eye: number("--eye", 0.36), pan: number("--pan", 0), lens: number("--lens", 1.5) };
}

/** The phone at rest in a slot, turned as the stylesheet says (--rx, --ry, --rz, in degrees). */
function poseOf(s: Slot | undefined): Pose | null {
  if (!s) return null;
  const cs = getComputedStyle(s.el);
  const degrees = (name: string) => ((parseFloat(cs.getPropertyValue(name)) || 0) * Math.PI) / 180;
  return { x: s.x + s.w / 2, y: s.y + s.h / 2, h: s.h, rx: degrees("--rx"), ry: degrees("--ry"), rz: degrees("--rz") };
}

function slotsIn(root: HTMLElement, origin: DOMRect): Record<string, Slot> {
  const slots: Record<string, Slot> = {};
  for (const slot of root.querySelectorAll<HTMLElement>("[data-slot]")) {
    const r = slot.getBoundingClientRect();
    // A box that is not laid out at this window size (the start's phone on a narrow one) is not a place.
    if (r.width + r.height === 0) continue;
    slots[slot.dataset.slot ?? ""] = { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height, el: slot };
  }
  return slots;
}

function measure() {
  stale = false;
  const host = document.querySelector<HTMLElement>("[data-stage]");
  live.w = host?.clientWidth || document.documentElement.clientWidth;
  live.h = host?.clientHeight || window.innerHeight;
  header = document.querySelector<HTMLElement>("[data-header]");
  ownButtons = [...document.querySelectorAll<HTMLElement>("main .btn")].map((button) => {
    const r = button.getBoundingClientRect();
    return [r.top + window.scrollY, r.bottom + window.scrollY];
  });
  mode3d = document.documentElement.dataset.mode === "3d";
  steps = new Map();
  for (const el of document.querySelectorAll<HTMLElement>("[data-step]")) {
    const list = steps.get(el.dataset.step ?? "") ?? [];
    list.push(el);
    steps.set(el.dataset.step ?? "", list);
  }
  // The bridge's frame (and, down a narrow window, its heading) is measured where it lies, unmoved.
  bridgeFrame = document.querySelector<HTMLElement>("[data-bridge-frame]");
  bridgeHead = document.querySelector<HTMLElement>("[data-bridge-head]");
  if (bridgeFrame) bridgeFrame.style.transform = "";
  if (bridgeHead) bridgeHead.style.transform = "";
  headerH = header?.offsetHeight ?? 56;
  chapters = [...document.querySelectorAll<HTMLElement>("[data-chapter]")].map((el) => {
    const pin = el.querySelector<HTMLElement>("[data-pin]") ?? el;
    const origin = pin.getBoundingClientRect();
    const acts: Record<string, Act> = {};
    for (const act of el.querySelectorAll<HTMLElement>("[data-act]")) {
      const slots = slotsIn(act, origin);
      acts[act.dataset.act ?? ""] = { el: act, slots, pose: poseOf(slots.phone), cam: camOf(act) };
    }
    const slots = slotsIn(el, origin);
    return { id: el.dataset.chapter ?? "", el, pin, top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight, pinH: pin.offsetHeight, slots, pose: Object.keys(acts).length ? null : poseOf(slots.phone), cam: camOf(el), acts };
  });
  measureSet();
  // Each stop's card, as it stands in the journey (offsets ignore the rise a card is given while it is off).
  cardBottoms = [];
  const showChapter = chapters.find((c) => c.id === "show");
  for (let i = 1; i <= 5; i++) {
    const row = steps.get(`card${i}`)?.[0];
    const cards = row?.parentElement;
    if (!row || !cards || !showChapter) continue;
    cardBottoms[i - 1] = cards.getBoundingClientRect().top - showChapter.pin.getBoundingClientRect().top + row.offsetTop + row.offsetHeight;
  }
  const card = steps.get("card6")?.[0]?.querySelector(".card");
  const pin = card?.closest<HTMLElement>("[data-pin]");
  if (card && pin) {
    const r = card.getBoundingClientRect();
    const o = pin.getBoundingClientRect();
    nightCard = [r.left - o.left, r.top - o.top, r.right - o.left, r.bottom - o.top];
  }
}

/** Where the bridge's parts stand in the wide shot, from the bridge act's own boxes. */
function measureSet() {
  const act = chapters.find((c) => c.id === "show")?.acts.bridge;
  const s = act?.slots;
  if (!act || !s?.layer || !s.pool) return;
  const axis = getComputedStyle(act.el).getPropertyValue("--axis").trim() === "y" ? "y" : "x";
  // Your end: the live phone, at both sizes (down a narrow window it is pinned at the head of the rail).
  const phone = s.phone;
  if (!phone) return;
  const layer = s.layer;
  const pool = s.pool;
  const fractions = [0.1125, 0.3375, 0.5625, 0.7875];
  let geometry: SetGeometry;
  // Down a narrow window the rail runs left to right too: one short row of panes under your
  // phone, its lead-in coming down to it from the phone's foot, the wall under the row.
  const desk = live.w >= 1024;
  if (axis === "x") {
    const plinthH = Math.max(desk ? 8 : 6, layer.h * 0.075);
    const paneH = layer.h - plinthH;
    const laneY = desk ? phone.y + phone.h * 0.5 : layer.y + paneH / 2;
    geometry = {
      axis,
      start: desk ? [phone.x + phone.w + 10, laneY] : [layer.x - 4, laneY],
      end: desk ? [pool.x - 14, laneY] : [layer.x + layer.w + 4, laneY],
      lead: !desk,
      gap: 12,
      plinth: { x: layer.x, y: layer.y + layer.h - plinthH, w: layer.w, h: plinthH },
      panes: fractions.map((f) => [layer.x + layer.w * f, layer.y + paneH / 2] as [number, number]),
      pane: [layer.w * 0.115, paneH],
      pool: { x: pool.x, y: pool.y, w: pool.w, h: pool.h },
      cardSize: desk ? [30, 20] : [22, 15],
      comet: desk ? 110 : 60,
      tileFont: 13,
    };
  } else {
    // Down a narrow window it runs from the top down, in the order of the process: you at the head, the companies at the foot.
    const laneX = layer.x + layer.w * 0.5;
    geometry = {
      axis,
      start: [laneX, phone.y + phone.h + 6],
      end: [laneX, pool.y - 12],
      gap: 10,
      plinth: { x: laneX, y: layer.y, w: 0, h: layer.h },
      panes: fractions.map((f) => [laneX, layer.y + layer.h * f] as [number, number]),
      pane: [layer.w, layer.h * 0.13],
      pool: { x: pool.x, y: pool.y, w: pool.w, h: pool.h },
      cardSize: [26, 18],
      comet: 70,
      tileFont: 13,
    };
  }
  // How far apart two panes stand at a stop, for the labels under them (a wide window shows the three legal panes together).
  const station = chapters.find((c) => c.id === "show")?.acts.journey?.slots.station;
  // (Down a narrow window the props stand at the bridge's own size.)
  if (station && axis === "x") station.el.style.setProperty("--pitch", desk ? `${(LEGAL * (geometry.panes[1][0] - geometry.panes[0][0]) * station.h) / (geometry.pane[1] + geometry.plinth.h)}px` : `${geometry.panes[1][0] - geometry.panes[0][0]}px`);
  live.set.geometry = geometry;
  live.set.version++;
}

const find = (id: string) => chapters.find((c) => c.id === id);
/** 0 as the chapter's top enters at the bottom of the viewport, 1 as it reaches the top. */
const arrive = (c: Chapter, y: number) => lin(y, c.top - c.pinH, c.top);
/** 0 as the pin lets go, 1 when the chapter has left the viewport. */
const leave = (c: Chapter, y: number) => lin(y, c.top + c.height - c.pinH, c.top + c.height);
/** A screen's words are kept near 15 px on the page (so its smallest labels stay near 12): the smaller the phone stands, the more its screen is magnified. Smaller still, it is drawn without words (`farOf` in screen.ts). */


/* ── One frame ────────────────────────────────────────────────────────────────────────────────────── */

function compute() {
  const y = window.scrollY;
  const hero = find("hero");
  const show = find("show");
  const start = find("start");
  const bridge = show?.acts.bridge;
  const journey = show?.acts.journey;
  const tau = show ? clamp((y - show.top) / show.pinH, -1, END) : -1;
  const coming = show ? arrive(show, y) : 0;
  const going = show ? leave(show, y) : 0;
  const G = live.set.geometry;
  // The layout's own breakpoint (the stylesheet's 1024 px): across a wide window, or down a narrow one. The set's
  // rail runs left to right at both sizes.
  const wide = live.w >= 1024;
  const way: 1 | -1 = y >= lastY ? 1 : -1;
  lastY = y;

  /* Which stop of the journey, and how far through it. */
  let station = -1;
  let sp = 0;
  for (let i = 0; i < 5; i++) {
    if (tau >= STATIONS[i] && tau < STATIONS[i + 1]) {
      station = i;
      sp = (tau - STATIONS[i]) / (STATIONS[i + 1] - STATIONS[i]);
    }
  }
  const inNight = tau >= NIGHT;
  const q = lin(tau, NIGHT, END);
  // The three legal checks of stop 02, one beat each.
  const beat = station === 1 ? Math.min(2, Math.floor(sp * 3)) : -1;
  const bp = station === 1 ? sp * 3 - beat : 0;
  const key = station >= 0 ? station * 3 : -1;
  if (key !== shotKey) {
    if (key >= 0 && shotKey >= 0) {
      shotPrev = shotKey;
      shotFrom = performance.now();
    }
    shotKey = key;
  }
  const shiftT = shotFrom ? clamp((performance.now() - shotFrom) / SHIFT_MS) : 1;
  if (shiftT >= 1) shotFrom = 0;
  else busy = true;
  /** How far the camera has gone from the shot it left to the one it holds: 1 once there. */
  const shift = shotFrom && shotPrev >= 0 ? glide(shiftT) : 1;
  const fromStation = shotPrev >= 0 ? Math.floor(shotPrev / 3) : station;

  /* The night: after the screen has dimmed the ground goes dark on its own clock (`frame` runs it), and back at the end. */
  // (It falls as the screen turns to the lock screen: the two start together, so no held frame has one without the other.)
  // (It holds until the show lets go: then the dawn, the card leaving and the phone's move to the close come together.)
  darkTarget = inNight && q >= 0.03 && going <= 0 ? 1 : 0;
  const dark = darkNow * darkNow * (3 - 2 * darkNow);
  /** Dawn, and after: the set leaves the way it came, and the night's composition holds while the show lets go. */
  const ending = inNight && going > 0;
  /**
   * The night's composition (where the phone, the camera and the set stand), on a clock of its own: it arrives
   * with the dark, and stays through the dawn and the exit, so nothing slides back toward stop 05 as the light
   * comes up.
   */
  const nightSet = smooth(toward("night-set", inNight && q >= 0.03 ? 1 : 0, 1000), 0, 1);

  /* The bridge is one picture at both sizes: nothing in it pans. */
  // While the show's pin is still coming up the window, the bridge comes up with it: the picture and its words
  // are one thing. (Down a narrow window it stands at its own place instead, held there against the pin's rise,
  // while the hero's phone comes to its place in it: what is not yet uncovered by the pin is simply not on.)
  const rise = show && tau < 0 ? (1 - coming) * show.pinH : 0;
  const climb = wide ? 0 : rise;
  {
    const move = climb ? `translate3d(0, ${(-climb).toFixed(1)}px, 0)` : "";
    for (const el of [bridgeFrame, bridgeHead]) if (el && el.style.transform !== move) el.style.transform = move;
  }

  /* Where the phone rests in the show at this moment, and the camera with it: the bridge's pose, then the journey's. */
  // From the bridge whole to stop 01: one move on its own clock, once the scroll crosses into the journey (or back).
  const handOff = glide(toward("hand-off", tau >= JOURNEY ? 1 : 0, 900));
  const bridgePose = bridge?.pose ? { ...bridge.pose, y: bridge.pose.y + (wide ? rise : 0) } : null;
  // Down a narrow window the phone stands a little lower at stop 02 (whose card is the longest), and has a place of its own at night.
  // Down a narrow window the phone stands just under the stop's card, never under it: its status bar and its
  // first lines always in view. (At 01 a little lower, so the plug has room to dock on its top.)
  const lift = (i: number) => (wide || !journey?.pose || cardBottoms[i] === undefined ? 0 : cardBottoms[i] + 12 + journey.pose.h / 2 - journey.pose.y);
  const lifted = station > 0 ? lerp(lift(fromStation), lift(station), shift) : lift(inNight ? 4 : 0);
  const journeyPose = journey?.pose ? { ...journey.pose, y: journey.pose.y + lifted } : null;
  const nightPose = show?.acts.night?.pose;
  const nightStop = journeyPose && nightPose ? mixPose(journeyPose, nightPose, nightSet) : journeyPose;
  // Down a narrow window, at dawn the night's card leaves with the night and the phone rises in its place, whole
  // in the window: no held frame is half empty, and it goes up with the show into the close.
  const stopPose = nightStop;
  // (Down a narrow window the bridge has no live phone: it comes up from below for stop 01.)
  const showPose = bridgePose && stopPose ? mixPose(bridgePose, stopPose, handOff) : stopPose ? { ...stopPose, y: stopPose.y + (1 - handOff) * live.h } : bridgePose;
  const nightCam = show?.acts.night?.cam ?? journey?.cam;
  const showCam = bridge && journey ? mixCam(mixCam(bridge.cam, journey.cam, handOff), nightCam ?? journey.cam, nightSet) : { eye: 0.36, pan: 0, lens: 1.5 };

  /* The phone: at rest in the chapter being read, gliding to the next one's place as this one lets go. */
  let index = 0;
  for (let i = 0; i < chapters.length; i++) if (chapters[i].top <= y + 0.5) index = i;
  const here = chapters[index];
  const next = chapters[index + 1];
  const restOf = (c: Chapter | undefined) => (c?.id === "show" ? showPose : (c?.pose ?? null));
  const camHere = (c: Chapter | undefined): Cam => (c?.id === "show" ? showCam : (c?.cam ?? { eye: 0.36, pan: 0, lens: 1.5 }));
  const from = restOf(here);
  const to = next?.id === "show" ? bridgePose : restOf(next);
  let k = 0;
  let gone = 0;
  /*
   * From the show to the close the move runs on its own clock, from the moment the pin lets go: across a wide
   * window the phone crosses to the close's place in 700 ms; down a narrow one it leaves by the foot. The close's
   * words come once it has (they would stand over it on its way). A scroll that stops never leaves it half-way.
   */
  const exit = smooth(toward("exit", going > 0.01 ? 1 : 0, 700), 0, 1);
  /** The close's words are on: the phone has crossed (or gone), and the close is far enough up the window. */
  // (Down a narrow window the phone goes up with the show, above the close: its words come as soon as they are in view.)
  const closing = !!start && (wide ? arrive(start, y) > 0.45 && exit > 0.85 : arrive(start, y) > 0.02);
  /** How far the phone has gone from this chapter's place to the next one's: by the clock out of the show, by the scroll elsewhere (over the first two thirds of the way, so what comes next has the rest to arrive in). */
  let e = 0;
  if (from && here) {
    const letGo = here.top + here.height - here.pinH;
    k = y > letGo ? lin(y, letGo, here.top + here.height) : 0;
    e = here.id === "show" ? exit : glide(lin(k, 0, 0.66));
    const p = live.phone;
    if (k > 0 && to) {
      Object.assign(p, mixPose(from, to, e));
      // Down a narrow window the hero's phone goes up with the page until it is whole under the header, and then
      // grows smaller into your end of the bridge, at the head of the rail, as the bridge comes up to it.
      if (here.id === "hero" && !wide && bridge?.pose) {
        const held = { ...from, y: from.y - Math.min(y - letGo, Math.max(0, from.y - from.h / 2 - (headerH + 12))) };
        e = glide(lin(coming, 0.15, 0.6));
        Object.assign(p, mixPose(held, bridge.pose, e));
      }
      // From the hero to the bridge across a wide window it stays beside the hero's words while they go up (no
      // empty half beside them), stepping back to the bridge's size as it stands. Once the words are past its top
      // it crosses, at the height of its place in the bridge, ahead of the companies coming up on its right and
      // behind the app switch going up on its left, and waits there for the bridge to come up to it. It never
      // stands over a word on the way. (The bridge's words come once it is in place.)
      if (here.id === "hero" && wide) {
        const docked = bridge?.pose ?? to;
        const size = glide(lin(k, 0, 0.3));
        e = glide(lin(k, 0.45, 0.65));
        const stepped = mixPose(from, to, size);
        Object.assign(p, stepped, { x: lerp(from.x, to.x, e), y: Math.min(lerp(from.y, docked.y, size), to.y) });
      }
      // It turns as it travels: a little further round at the middle of the move than at either end.
      p.ry += 0.22 * bump(e);
    } else {
      Object.assign(p, from);
      // Nothing follows with a place for it: it leaves with its chapter.
      if (k > 0) {
        // Across a wide window it goes up with the page. Down a narrow one, too: it stands at the top of the
        // window at dawn, and the close comes up under it.
        // (As the show lets go, the dawn: the phone rises on the exit's clock until its foot is at the window's,
        // the card having left with the night, so the close comes up under it, never over it.)
        if (here.id === "show" && !wide) p.y = lerp(p.y, live.h - 8 - p.h / 2, exit) - (y - letGo);
        // (Out of the close it goes a little faster than the page, so it has gone by the time the footer is in view.)
        else p.y += wide ? -(y - letGo) * (here.id === "start" ? 2.4 : 1) : (y - letGo) * 2.4;
        gone = here.id === "show" ? e : k;
      }
    }
  } else {
    // This chapter has no place for the phone (the start, on a narrow window): it is out of the picture.
    live.phone.y = -live.phone.h;
    gone = 1;
  }
  const cam = k > 0 && to ? mixCam(camHere(here), next?.id === "show" && bridge ? bridge.cam : camHere(next), e) : camHere(here);
  {
    const p = live.phone;
    live.lens = cam.lens;
    // Down a narrow window the bridge is a drawing, not a floor: the floor is put out of the picture while the show runs.
    const floorless = !wide && tau > -0.6 && going < 0.6 ? smooth(coming, 0.2, 0.7) * (1 - smooth(going, 0.2, 0.6)) : 0;
    // Across a wide window, from the hero to the bridge, the phone waits at its place while the bridge comes up
    // to it: once it has crossed, the floor is the bridge's own (the set stands on it, coming up from below), and
    // the phone stands over it until they meet.
    let floorY = p.y + p.h / 2;
    if (wide && here?.id === "hero" && next?.id === "show" && bridge?.pose) floorY = Math.max(floorY, lerp(floorY, bridge.pose.y + bridge.pose.h / 2 + rise, e));
    live.floor.y = floorY + floorless * live.h * 3;
    live.flat = floorless;
    // The pointer moves the camera a little, so near and far slide against each other.
    live.eye.x = live.w / 2 + cam.pan * live.w + live.tilt.x * live.w * 0.018;
    live.eye.y = p.y + p.h / 2 - cam.eye * p.h + live.tilt.y * live.h * 0.012;
  }

  live.day = 1 - dark;
  live.floor.day = live.day;
  // (No reflections at night: the dark floor mirrors nothing.)
  live.floor.mirror = (1 - gone) * (1 - dark);
  live.prism = Math.max(hero ? 1 - smooth(leave(hero, y), 0.05, 0.7) : 0, start ? smooth(arrive(start, y), 0.4, 1) : 0) * 0.9 + 0.1;
  live.sky = dark;
  const landed = 0.5;
  {
    const N = live.night;
    const s = show?.acts.night?.slots;
    N.cx = live.w / 2;
    N.radius = Math.max(live.w * 1.15, live.h * 0.9);
    N.apex = s?.horizon ? s.horizon.y : live.h * 0.8;
    N.orbitApex = s?.orbit ? s.orbit.y : live.h * 0.14;
    N.satSize = s?.sat ? s.sat.w : 88;
    N.horizon = 1;
    // Dawn: the light along the horizon grows with the clock.
    N.glow = 0.3 + 0.7 * smooth(q, 0.6, 0.9);
    N.orbit = 1;
    N.sat = Math.pow(lin(q, 0.06, 1.0), 0.75);
    // The night card's box (measured once; it does not move while the show is pinned): no star behind it.
    N.quiet = inNight ? nightCard : [0, 0, 0, 0];
  }

  /*
   * The phone's screen: exactly one state. Which one changes when the scroll crosses a threshold; the phone
   * then makes its own move to it (phone.ts). Nothing here is a dissolve.
   */
  const lockMinutes = q < landed ? lerp(112, 187, lin(q, 0.06, landed)) : lerp(187, 401, lin(q, landed, 0.9));
  const since = Math.round(lockMinutes) - 187;
  const ago = q < landed + 0.04 || since < 2 ? "now" : since < 60 ? `${since}m ago` : `${Math.floor(since / 60)}h ago`;
  let screen: ScreenState;
  // (The night's first moment, before the dusk, is still stop 05's picture, as it was left.)
  if (inNight && going <= 0) screen = q < 0.03 ? applyScreen(0, !wide) : lockScreen(lockMinutes, q >= landed ? 1 : 0.3, q >= landed ? 1 : 0, ago);
  else if (inNight || going > 0 || (start && y >= start.top - live.h)) {
    // Dawn, and on the way out: the night's last screen stays (you wake up to the request). Across a wide window,
    // once the phone has crossed to the close's place, it shows cleared connected: never an earlier step.
    screen = wide && (exit > 0.5 || !inNight) && going > 0.01 ? connectScreen(3, true) : lockScreen(lockMinutes, 1, 1, ago);
  // (Never an empty chat: the message is sent, and cleared offered, from the stop's first frame.)
  } else if (station === 0) screen = connectScreen(sp < 0.45 ? 1 : sp < 0.64 ? 2 : 3);
  else if (station === 1) screen = checksScreen(beat + (bp > 0.45 ? 1 : 0));
  // Down a narrow window only the top of the phone is in the picture: its screens go straight to what matters.
  else if (station === 2) screen = weekScreen(sp > 0.3 ? 1 : 0, !wide);
  // 04 ends with the task read back, criterion by criterion.
  else if (station === 3) screen = taskScreen(!wide, sp > 0.5);
  // (Down a narrow window the approval without the agent's line above it: its evidence and Send together.)
  else if (station === 4) screen = applyScreen(bump(lin(sp, 0.3, 0.38)), !wide);
  // Your end of the bridge: what it found; then, before the three cross, it asks, and you send them.
  // (Down a narrow window the hero's own screen stays until the phone has grown smaller; the cropped phone shows the live turn alone.)
  else if (coming > (wide ? 0.25 : 0.4)) screen = tau >= ASK.ask ? askScreen(bump(lin(tau, ASK.press[0], ASK.press[1])), tau >= ASK.sent, !wide) : foundScreen(tau > HELD, !wide);
  else screen = heroScreen(live.hero);
  live.screen.state = screen;
  live.screen.way = way;
  {
    // What the screen throws on the floor and on what stands near it: white by day, a cool violet from the lock screen once it wakes.
    const lock = screen.kind === "lock" ? screen : null;
    const wake = lock ? lock.wake : 0;
    live.glow = lock ? wake * dark : 0;
    const night: [number, number, number] = [0.34 * wake + 0.02, 0.3 * wake + 0.02, 0.62 * wake + 0.03];
    live.screenLight = lock ? night : [0.9, 0.9, 0.9];
  }

  /* Down a narrow window the phone is cropped to its live message (the stage cuts it there, with a short fade):
     no blank white under it. It is whole in the hero, and at night. */
  {
    const P = live.phone;
    const foot = P.y + P.h / 2;
    const screenTop = P.y - P.h / 2 + ((1 - DISPLAY.h) / 2) * P.h;
    const content = Math.min(foot, screenTop + live.screenBottom * DISPLAY.h * P.h);
    let b = 0;
    if (!wide && show) {
      if (here?.id === "hero" && next?.id === "show") b = e;
      else if (here?.id === "show" && going <= 0) b = inNight ? 1 - nightSet : 1;
    }
    P.crop = b > 0.001 ? lerp(foot, content, b) : -1;
  }

  /* The bridge. */
  const S = live.set.state;
  if (G && show && bridge) {
    const across = G.axis === "x";
    // Down a narrow window: your phone's foot (where it is cropped), where the rail's lead-in comes down from.
    const P = live.phone;
    const footY = P.crop > 0 ? P.crop : P.y + P.h / 2;
    const rowLen = Math.max(1, Math.hypot(G.end[0] - G.start[0], G.end[1] - G.start[1]));
    /** The lead-in's length as a share of the rail's (the roles' `u` runs from minus this, at your phone's foot). */
    const Lu = G.lead && !wide ? leadLength(P.x, footY + 14, G.start[0], G.start[1]) / rowLen : 0;
    const paneU = G.panes.map((pane) => (across ? (pane[0] - G.start[0]) / (G.end[0] - G.start[0]) : (pane[1] - G.start[1]) / (G.end[1] - G.start[1])));
    S.show = smooth(coming, 0.2, 0.5) * (1 - smooth(going, 0.0, 0.1));
    S.traffic = tau * 0.55;
    // It is built as the hero leaves, from your end outward, and stands whole when the show takes hold.
    // (On its own clock: a scroll that stops part-way leaves it either built or not there.)
    // (Once the phone has come to its place in it: nothing of the set is ever drawn across the phone on its way.)
    const built = toward("built", coming > (wide ? 0.85 : 0.55) && going < 0.03 && !ending ? 1 : 0, 900);
    S.lanes = smooth(built, 0, 0.45);
    // Down a narrow window, while the pin is still coming up, the lanes reach no higher than its top (above it is the hero).
    S.layer = smooth(built, 0.2, 0.8);
    // The companies: on the bridge whole, at their own stop, and at night. Before their stop they would show round the card's edge.
    // (Down a narrow window the wall is at the top of a frame taller than the window: it comes as the camera climbs to it.)
    const wanted = tau < JOURNEY ? coming > (wide ? 0.35 : 0.4) : station === 4 || inNight;
    const pool = toward("pool", wanted && going < 0.02 && !ending ? 1 : 0, 520);
    S.pool = pool * pool * (3 - 2 * pool);
    S.lit = [0, 0, 0, 0];
    S.glow = [0, 0, 0, 0];
    S.checks = [0, 0, 0, 0];
    S.replies = [-1, -1, -1];
    S.coupling = { u: -9, lock: 0 };
    S.comets = 0;
    S.ticks = [0, 0, 0];
    S.ring = 0;
    S.cut = -9;
    S.from = null;
    // The five roles. The last two are the ones that ask for a U.S. person: they stop at Export control.
    const tokens = S.tokens;
    for (const token of tokens) {
      token.u = -9;
      token.held = 0;
    }
    const gap = 0.045;
    /** Places the roles as a short train whose head is at `head`; the two at the back stop at Export control. */
    const train = (head: number, shown = 5) => {
      for (let i = 0; i < 5; i++) {
        const u = head - i * gap;
        const stops = i >= 3;
        tokens[i].u = i >= shown || u < -Lu + 0.004 ? -9 : stops ? Math.min(u, paneU[1] - (i - 3.5) * gap) : Math.min(u, 1.2);
        tokens[i].held = stops && u >= paneU[1] - (i - 3.5) * gap ? 1 : 0;
      }
    };

    if (tau < JOURNEY) {
      /* The bridge whole. Five roles leave the phone; each pane says what it finds; two stay; three cross and land. */
      // (Down a narrow window they drop out of your phone down the lead-in first. They clear Vetting, and wait
      // past it while the agent asks and you approve; then they cross.)
      const clear = Math.min(0.985, paneU[3] + (G.pane[0] * 0.8) / rowLen + 2 * gap + 0.01);
      const head = tau < T.lift ? -9 : pathOf(tau, [T.lift, -Lu], [0.3, paneU[0]], [0.34, paneU[0]], [0.46, paneU[1]], [0.56, paneU[1]], [0.68, paneU[2]], [0.73, paneU[2]], [0.85, paneU[3]], [0.9, clear], [ASK.go, clear], [1.28, 1.2 + 2 * gap]);
      if (head > -8) train(head);
      S.lit = paneU.map((at) => (head >= at - 0.004 ? 1 : 0));
      S.checks = S.lit.slice();
      // Three land, on three different companies' tiles: each lights and takes a tick at its corner.
      // (A role that reaches its tile becomes its tick: the token is gone a moment before it would touch the mark.)
      S.ticks = [0, 1, 2].map((i) => (head - i * gap >= 1.17 ? 1 : 0));
      S.comets = 0.3 * smooth(tau, 1.2, 1.35);
    } else S.comets = 0.25;

    if (station === 0) {
      // 01: the connector slides in along the lanes and locks at the phone; light runs away down both lanes.
      // (Down a narrow window it would lock just under the card, out of sight: the phone's screen shows the moment there.)
      // (Down a narrow window it comes down onto the phone's top from above: the rest of the set is out of this picture.)
      // (Down a narrow window it is not in the picture: the phone's own screen shows cleared being added.)
      // (Down a narrow window it comes up the lead-in and locks into your phone's foot.)
      S.coupling = wide ? { u: lerp(0.22, 0.012, smooth(sp, 0.12, 0.45)), lock: bump(lin(sp, 0.45, 0.62)) } : { u: -Lu * lerp(0.35, 0.93, smooth(sp, 0.12, 0.45)), lock: bump(lin(sp, 0.45, 0.62)) };
      S.comets = 0.3 + 0.7 * bump(lin(sp, 0.45, 0.8));
    } else if (station === 1) {
      // 02: the three legal checks. The roles go from pane to pane; at Export control two stay.
      const stop = (n: number) => paneU[n] + (n >= 1 ? 2 * gap : 4 * gap) * 0.5;
      train(beat === 0 ? lerp(0.02, stop(0), smooth(bp, 0, 0.4)) : lerp(stop(beat - 1), stop(beat), smooth(bp, 0, 0.4)));
      S.lit = [0, 1, 2, 3].map((i) => (i < beat || (i === beat && bp > 0.45) ? 1 : 0));
      S.checks = S.lit.slice();
    } else if (station === 2 || station === 3) {
      // 03 and 04: vetting. The three that went on wait at the fourth pane.
      train(station === 2 ? lerp(paneU[2] + gap, paneU[3] + gap, smooth(sp, 0, 0.16)) : paneU[3] + gap);
      // (The two held at Export control are out of this picture, behind the phone or above the window: not shown.)
      tokens[3].u = tokens[4].u = -9;
      S.lit = [1, 1, 1, station === 3 || sp > 0.2 ? 1 : 0];
      S.checks = S.lit.slice();
    } else if (station === 4) {
      // 05: you approve; one application runs the direct line and lands on a company's tile.
      train(paneU[3] + gap);
      tokens[3].u = tokens[4].u = -9;
      S.lit = [1, 1, 1, 1];
      S.checks = [1, 1, 1, 1];
      const run = lin(sp, 0.4, 0.66);
      if (run > 0) tokens[0].u = lerp(paneU[3] + gap, 1.2, glide(run));
      S.ticks = [run >= 0.9 ? 1 : 0, 0, 0];
      if (run >= 0.9) tokens[0].u = -9;
      // (Down a narrow window the wall stands alone under the phone: the application's tick lands on its tile.)
      if (!wide) {
        for (const token of tokens) token.u = -9;
        S.lanes = 0;
        S.comets = 0;
      }
    } else if (inNight) {
      // 06: the whole bridge at night. Replies come out of the wall over the hours (never from one company's
      // tile: the notification names none); the last is yours, and lands as the notification.
      S.lit = [1, 1, 1, 1];
      S.checks = [1, 1, 1, 1];
      const starts = [0.2, 0.36, 0.5];
      S.replies = starts.map((at) => {
        const u = lin(q, at - 0.14, at);
        return u > 0 && u < 1 ? 1 - u : -1;
      });
      S.glow = [0, 1, 2, 3].map((i) => Math.max(...S.replies.map((u) => (u < 0 ? 0 : bump(lin(u, paneU[i] - 0.07, paneU[i] + 0.07))))));
      // (Down a narrow window, the night's first moment is still 05's picture: the wall alone under the phone.)
      if (!wide && q < 0.03) {
        S.lanes = 0;
        S.comets = 0;
        S.ticks = [1, 0, 0];
      }
    }
    // As the notification lands, the wall's nine outlines brighten together, once, on their own clock (a scroll
    // that stops never holds them half-lit).
    const notified = inNight && going <= 0 && q >= landed;
    if (notified && !rang) {
      ringFrom = performance.now();
      request();
    }
    rang = notified;
    S.ring = ringNow < 1 ? bump(ringNow) : 0;
    if (ringNow < 1) busy = true;
    // In the night's wide shot the wall is enlarged as the set draws back, so its marks stay large enough to read.
    S.wallGrow = nightSet;

    /*
     * Where the whole set stands. In the wide shot, exactly on its labels. Then the camera travels along it:
     * a point of the set (`anchor`) is brought to a point of the viewport (`target`), at a size. Across a wide
     * window the set stands on the floor, so the anchor is on its floor line and the target is where the
     * floor is seen at that depth: at your end it stays in the phone's own plane, joined to the phone; further
     * along it stands behind the phone, as far back as puts its floor line at the bottom of the station's box.
     */
    const floorLine = G.plinth.y + G.plinth.h;
    const D = cam.lens * live.h;
    const wideShot = { anchor: G.start, target: [G.start[0], G.start[1] + (wide ? rise : 0)] as [number, number], scale: 1, yaw: 0, back: 0 };
    type Shot = typeof wideShot;
    const st = journey?.slots.station;
    const jp = journey?.pose;
    const bp0 = bridge.pose;
    const along = (u: number): [number, number] => [lerp(G.start[0], G.end[0], u), lerp(G.start[1], G.end[1], u)];
    /** Where the set stands for stop `i` (and, down a narrow window, for stop 02's pane `n`). */
    const shot = (i: number): Shot => {
      if (!st || !jp || !bp0) return wideShot;
      const centre: [number, number] = [st.x + st.w / 2, st.y + st.h / 2];
      if (!wide) {
        // Down a narrow window each stop keeps its prop on stage, the same size as on the bridge, under the
        // phone: the row (with the plug on the lead-in), the three legal panes, the Vetting pane, the wall.
        const make = (anchor: [number, number]): Shot => ({ anchor, target: [live.w / 2, PROP_Y[Math.min(4, Math.max(0, i))]], scale: 1, yaw: 0, back: 0 });
        if (i === 0) return make([(G.start[0] + G.end[0]) / 2, G.start[1]]);
        if (i === 1) return make([G.panes[1][0], G.start[1]]);
        if (i === 2 || i === 3) return make([G.panes[3][0], G.start[1]]);
        return make([G.pool.x + G.pool.w / 2, G.pool.y + G.pool.h / 2]);
      }
      if (!bp0) return wideShot;
      const floor = live.floor.y;
      const grown = jp.h / bp0.h;
      // Your end: the set in the phone's plane, grown as the phone has, its lanes leaving the phone's edge.
      const joined: Shot = { anchor: [G.start[0], floorLine], target: [jp.x + (PHONE.w * jp.h) / 2 + (G.start[0] - (bp0.x + (PHONE.w * bp0.h) / 2)) * grown, floor], scale: grown, yaw: 0, back: 0 };
      // Further along: behind the phone, its floor line at the bottom of the station's box.
      const seen = clamp((st.y + st.h - live.eye.y) / Math.max(1, floor - live.eye.y), 0.5, 1);
      const back = D * (1 / seen - 1);
      const scale = st.h / (G.pane[1] + G.plinth.h);
      const behind = (x: number, s = scale): Shot => ({ anchor: [x, floorLine], target: [centre[0], st.y + st.h], scale: s, yaw: -0.1, back });
      if (i === 0) return joined;
      // 02: the three legal panes together, the middle one at the centre, a little smaller so the Vetting pane
      // and the plinth's end stand clear of the card (the labels under them use the same pitch).
      if (i === 1) return behind(G.panes[1][0], scale * LEGAL);
      if (i === 2 || i === 3) return behind(G.panes[3][0]);
      // 05: the direct line and the companies: as large as fits the station's box, so their marks stay clear.
      return behind(G.pool.x + G.pool.w * 0.42, Math.min(st.h / G.pool.h, (st.w * 1.15) / G.pool.w));
    };
    const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
      anchor: [lerp(a.anchor[0], b.anchor[0], t), lerp(a.anchor[1], b.anchor[1], t)],
      target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t)],
      scale: lerp(a.scale, b.scale, t),
      yaw: lerp(a.yaw, b.yaw, t),
      back: lerp(a.back, b.back, t),
    });
    const shotOf = (k: number) => shot(Math.floor(k / 3));
    let placed: Shot = wideShot;
    if (station >= 0) {
      const held = shift < 1 ? mixShot(shotOf(shotPrev), shotOf(key), shift) : shotOf(key);
      placed = station === 0 && handOff < 1 ? mixShot(wideShot, held, handOff) : held;
    } else if (!inNight && tau >= 0 && handOff > 0) placed = mixShot(wideShot, shot(0), handOff);
    else if (inNight && jp && st) {
      // The night's wide shot: the whole bridge running away behind the phone, small against the horizon.
      const length = Math.hypot(G.end[0] - G.start[0], G.end[1] - G.start[1]) + (across ? G.pool.w : G.pool.h);
      const from = shot(4);
      const quiet = nightCard;
      let wideNight: Shot;
      if (wide) {
        // The first pane stands clear of the phone's edge, and the companies end short of the card.
        const first = G.panes[0][0] - G.pane[0] / 2 - G.start[0];
        // (Clear of the gap kept behind the phone, where nothing of the set is drawn but the rail.)
        const left = jp.x + (PHONE.w * jp.h) / 2 + 72;
        const right = (quiet[0] > 0 ? quiet[0] : live.w * 0.64) - live.w * 0.03;
        const scale = (right - left) / (length - first);
        wideNight = { anchor: [G.start[0], floorLine], target: [left - first * scale, st.y + st.h], scale, yaw: -0.12, back: from.back };
      } else {
        // Down a narrow window: the whole of it in the station's box.
        // Down a narrow window: the companies' lights in the sky over the card, the rest running down behind it to the phone.
        wideNight = { anchor: [G.pool.x + G.pool.w / 2, G.pool.y + G.pool.h / 2], target: [live.w / 2, st.y + st.h / 2 - live.h * 0.02], scale: 0.5, yaw: 0, back: from.back };
      }
      placed = mixShot(from, wideNight, nightSet);
    }
    Object.assign(S, placed);
    // Down a narrow window the rail's lead-in comes down from your phone's foot, wherever the set stands.
    if (!wide && G.lead && !inNight) {
      // (A little under the foot: a role on it never touches the phone.)
      S.from = [placed.anchor[0] + (P.x - placed.target[0]) / placed.scale, placed.anchor[1] + (footY + 14 - placed.target[1]) / placed.scale];
      // (At 01 the plug comes up the lead-in as the set stands now, and locks into the phone's foot.)
      if (station === 0) S.coupling.u = -(leadLength(S.from[0], S.from[1], G.start[0], G.start[1]) / rowLen) * lerp(0.35, 0.97, smooth(sp, 0.12, 0.45));
    }
    // Across a wide window, once the set stands behind the phone (at a stop, and at night), nothing of it is
    // drawn behind the phone but the rail: a role, a pane or the plinth would peek out round its edges. (Where
    // the set's place is seen: its anchor at the target, at its scale.)
    if (wide && placed.back > 1 && jp) {
      // (Its edge as drawn, with its thickness and its turn, and a clear gap.)
      const edge = live.phone.x + (PHONE.w * live.phone.h) / 2 + 34;
      S.cut = (placed.anchor[0] + (edge - placed.target[0]) / placed.scale - G.start[0]) / (G.end[0] - G.start[0]);
    }

    /*
     * The lens. Along the journey one place is in focus (and the phone, always) and the rest of the set is
     * soft. Between stops a pane of glass crosses in front of the lens, on its own clock (`frame` runs it):
     * it is never caught half-way by a scroll that stops. The bridge whole and the night are sharp.
     */
    {
      const F = live.focus;
      type Subject = [number, number, number, number];
      const pane = (n: number): Subject => (across ? [G.panes[n][0], G.panes[n][1], G.pane[1] * 0.17 + 34, G.pane[1] / 2 + 44] : [G.panes[n][0], G.panes[n][1], G.pane[0] / 2 + 30, G.pane[1] * 1.4 + 26]);
      const blend = (a: Subject, b: Subject, t: number): Subject => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
      // What each stop looks at, in the set's own pixels: a centre and a half size.
      const subject = (i: number, n = 0): Subject => {
        if (i <= 0) return [...along(0.06), 110, 90];
        // 02: the three legal panes, with the two held roles.
        if (i === 1) return across ? [G.panes[1][0], G.panes[1][1], G.panes[2][0] - G.panes[0][0] + G.pane[1] * 0.2, G.pane[1] / 2 + 44] : pane(Math.min(2, Math.max(0, n)));
        if (i === 2 || i === 3) return pane(3);
        const from = along(0.82);
        // (Down a narrow window the wall stands alone under the phone, the rail out of the picture: all of it.)
        return wide ? [(from[0] + G.pool.x + G.pool.w) / 2, G.pool.y + G.pool.h / 2, (G.pool.x + G.pool.w - from[0]) / 2 + 30, G.pool.h / 2 + 36] : [G.pool.x + G.pool.w / 2, G.pool.y + G.pool.h / 2, G.pool.w / 2 + 30, G.pool.h / 2 + 36];
      };
      const subjectOf = (k: number) => subject(Math.floor(k / 3), k % 3);
      // (Into the night, while the lens is still pulled, the companies stay its subject, as at stop 05.)
      const at = station >= 0 ? (shift < 1 ? blend(subjectOf(shotPrev), subjectOf(key), shift) : subjectOf(key)) : inNight ? subject(4) : subject(0);
      F.window = [placed.target[0] + (at[0] - placed.anchor[0]) * placed.scale, placed.target[1] + (at[1] - placed.anchor[1]) * placed.scale, at[2] * placed.scale, at[3] * placed.scale];
      // At night everything is sharp; from the dawn on, too (the set is leaving).
      F.soft = inNight ? (ending ? 0 : 1 - dark) : handOff;
      // A new stop: the pane sets off across the lens (forward, or back the way it came).
      if (station !== sweptAt) {
        if (station >= 1 && sweptAt >= 0 && sweptAt <= 4) {
          sweepFrom = performance.now();
          sweepWay = station > sweptAt ? 1 : -1;
          request();
        }
        sweptAt = station;
      }
      const span = wide ? live.w : live.h;
      const t = sweepNow;
      F.pane = { at: (sweepWay > 0 ? lerp(1.32, -0.32, t) : lerp(-0.32, 1.32, t)) * span, half: span * 0.13, amount: t < 1 ? Math.pow(bump(t), 0.7) : 0, down: !wide };
    }

    // Down a narrow window the checks step back while the companies are the subject.
    // While the companies are the subject the checks step back (across a wide window they would stand cut by the window's edge, behind the phone).
    // (And down a narrow window they stay back through the night's first moment, while the set still stands as at 05.)
    S.layer *= toward("layer", station === 4 || (!wide && inNight && q < 0.03) ? 0 : 1, 420);
    // 02 frames the three legal panes, and 03 and 04 the Vetting pane alone: nothing of the others half in the
    // picture, under the card, or behind the phone.
    S.only = station === 1 ? 4 : station === 2 || station === 3 ? 3 : -1;
    // Down a narrow window, where the picture holds the Vetting pane alone, the lead-in would run off its edge: it fades.
    S.leadOn = toward("lead-in", !wide && (station === 2 || station === 3) ? 0 : 1, 420);
    // Once the camera has left your end the set stands behind the phone, and its lanes run on behind it.
    S.lead = across ? clamp(placed.back / Math.max(1, live.h * 0.1)) : station >= 1 || inNight ? 1 : 0;
    // The prism's colour follows the place along the bridge: purple at your end, aqua over the checks, cream at the companies.
    live.along = tau < JOURNEY ? 0 : station >= 0 ? [0, 0.5, 0.6, 0.6, 1][station] : 0.3;

    /* The page's own words, switched on and off as their moment comes. */
    const inBridge = tau < JOURNEY;
    // (Each once the phone, gliding down from the hero, has passed where it stands: across a wide window the
    // heading once the phone is in its place under it. Down a narrow window each once the pin has come up past
    // its place. The heading stays the whole bridge: under the title, the line gives way to the direct line at
    // the arrival, down a narrow window.)
    const directOn = tau < JOURNEY && tau > ASK.go && inBridge;
    // (Across a wide window the heading comes up over the phone's place, where the phone waits: it comes on once it is past it.)
    on("bridge-title", coming > (wide ? 0.9 : 0.93) && inBridge);
    on("bridge-line", coming > (wide ? 0.9 : 0.93) && inBridge && (wide || !directOn));
    // (Across a wide window the phone waits at its place for the bridge to come up to it: its label comes once they meet.)
    on("you", coming > (wide ? 0.995 : 0.75) && inBridge);
    // The roles as they leave your phone; the three that arrive.
    on("train", tau > T.lift && inBridge);
    // (The frame's words down a narrow window stand below your phone: they come as the phone arrives.)
    on("sent", S.ticks.some((t) => t > 0.5) && inBridge);
    // (Down a narrow window the words under your phone wait for its foot, coming down from the hero over them,
    // to have risen above the row of panes.)
    const foot = live.phone.crop > 0 ? live.phone.crop : live.phone.y + live.phone.h / 2;
    const under = wide || !bridge?.slots.layer || foot < bridge.slots.layer.y - 6;
    on("layer", coming > (wide ? 0.6 : 0.3) && under && inBridge);
    on("limits", coming > (wide ? 0.6 : 0.3) && under && inBridge);
    on("pool", coming > (wide ? 0.35 : 0.3) && under && inBridge);
    G.panes.forEach((_, i) => {
      on(`pane${i}`, coming > (wide ? 0.6 : 0.3) + i * 0.03 && under && inBridge);
      // (A pane's number stands under it: it comes with the row.)
      on(`num${i}`, S.layer > 0.6 && inBridge);
      on(`lit${i}`, tau < JOURNEY && S.lit[i] > 0.5 && inBridge);
    });
    on("held", tau > HELD && inBridge);
    on("direct", directOn);
    for (let i = 0; i < 5; i++) on(`card${i + 1}`, station === i || (i === 4 && inNight && darkNow < 0.5 && q < 0.5));
    // 06 stays through the dawn (it turns into a day card with the ground) until the show lets go: across a wide
    // window the phone then crosses where it stands; down a narrow one it stays until the close's words come.
    // (Down a narrow window it stays until it has gone up with the show: the close comes up under it, with no empty half.)
    // (It leaves with the night, at both sizes: the card and the scene change together. Down a narrow window the
    // phone rises in its place.)
    on("card6", inNight && darkNow >= 0.5 && going <= 0.01);
    // 02's three checks across a wide window: each name under its pane, with where its rule is published once
    // the pane has checked. (What they found is written once, on the bridge.)
    for (let i = 0; i < 3; i++) {
      on(`legal${i}`, station === 1);
      on(`legal-lit${i}`, station === 1 && S.lit[i] > 0.5);
    }
    on("vetting", station === 2 || station === 3);
    // (They stay through the moment before the dark falls, as 05's picture does.)
    on("station-pool", station === 4 || (inNight && q < 0.03));
    on("station-direct", station === 4 || (inNight && q < 0.03));
    // What happens to the application, one step as it reaches each, while it runs the line.
    BRIDGE_STEPS.forEach((at, i) => on(`backend${i}`, (station === 4 && sp >= at) || (inNight && q < 0.03)));
  }

  /* The start. */
  // (Once the phone has crossed the window, or gone by its foot: see `exit` above.)
  if (start) on("start", closing);

  /* The header reads the ground under it, and gives up its button while one of the page's own is on screen: one button, always. */
  if (header) {
    const own = ownButtons.some(([top, bottom]) => bottom > y + header!.offsetHeight && top < y + live.h) ? "page" : "header";
    if (header.dataset.cta !== own) header.dataset.cta = own;
    const ground = darkNow > 0.5 ? "night" : "bone";
    if (header.dataset.ground !== ground) header.dataset.ground = ground;
    const pin = show?.pin;
    if (pin && pin.dataset.ground !== ground) pin.dataset.ground = ground;
  }
}

/** The lead-in's length (set.ts draws the same curve): from your phone's foot along under it, bending down into the rail's start. */
function leadLength(fx: number, fy: number, sx: number, sy: number) {
  const bx = sx;
  const by = fy + 10;
  let d = 0;
  let px = fx;
  let py = fy;
  for (let i = 1; i <= 18; i++) {
    const t = i / 18;
    const x = (1 - t) * (1 - t) * fx + 2 * (1 - t) * t * bx + t * t * sx;
    const yy = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * by + t * t * sy;
    d += Math.hypot(x - px, yy - py);
    px = x;
    py = yy;
  }
  return d;
}

/** A value that runs through `[when, value]` points in order, straight between them. */
function pathOf(t: number, ...points: [number, number][]): number {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) if (t <= points[i][0]) return lerp(points[i - 1][1], points[i][1], (t - points[i - 1][0]) / (points[i][0] - points[i - 1][0]));
  return points[points.length - 1][1];
}

/* ── The loop: one frame when something changed, none otherwise ───────────────────────────────────── */

const INTRO_MS = 1800;

function frame(time: number) {
  scheduled = 0;
  if (stale) measure();
  const dt = lastTime ? Math.min(64, time - lastTime) : 16;
  lastTime = time;
  let moving = false;

  // The one arrival. It starts when the stage says it is ready (see `begin`).
  if (started && live.intro < 1) {
    live.intro = clamp((time - started) / INTRO_MS);
    moving = true;
  }
  // The hero's sequence: once after the page loads, and again when the visitor chooses an app.
  if (heroStarted && live.hero < HERO_MS) {
    live.hero = clamp(time - heroStarted, 0, HERO_MS);
    moving = true;
  }
  // The night arrives and leaves on its own clock, in about a second, whatever the scroll does.
  if (darkNow !== darkTarget) {
    darkNow = clamp(darkNow + (darkTarget > darkNow ? 1 : -1) * (dt / 1000));
    moving = true;
  }
  // The pane crossing the lens between stops: 700 ms.
  if (sweepNow < 1 || sweepFrom) {
    sweepNow = sweepFrom ? clamp((time - sweepFrom) / 700) : 1;
    if (sweepNow >= 1) sweepFrom = 0;
    else moving = true;
  }
  // The wall's one brightening at night: RING_MS.
  if (ringNow < 1 || ringFrom) {
    ringNow = ringFrom ? clamp((time - ringFrom) / RING_MS) : 1;
    if (ringNow >= 1) ringFrom = 0;
    else moving = true;
  }
  // The pointer's pull, eased.
  if (fine) {
    const ease = 1 - Math.exp(-dt / 180);
    const dx = pointer.x - live.tilt.x;
    const dy = pointer.y - live.tilt.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) {
      live.tilt.x += dx * ease;
      live.tilt.y += dy * ease;
      moving = true;
    }
  }

  frameDt = dt;
  busy = false;
  if (mode3d) compute();
  else showEverything();
  live.busy = busy;
  if (busy) moving = true;
  for (const subscriber of subscribers) subscriber(time);
  if (moving) request();
  else lastTime = 0;
}

/** Without the stage nothing is pinned and nothing waits for its moment: every word is simply there. */
function showEverything() {
  for (const name of steps.keys()) on(name, true);
  if (header) {
    if (header.dataset.cta !== "header") header.dataset.cta = "header";
    const night = document.querySelector<HTMLElement>("[data-act='night']")?.getBoundingClientRect();
    const ground = night && night.top < header.offsetHeight / 2 && night.bottom > header.offsetHeight / 2 ? "night" : "bone";
    if (header.dataset.ground !== ground) header.dataset.ground = ground;
  }
}

/**
 * Brings the page to the stop where a card is on screen: for a card reached with the keyboard while it is off.
 */
export function reveal(name: string) {
  const match = /^card(\d)$/.exec(name);
  const show = find("show");
  if (!mode3d || !match || !show || steps.get(name)?.[0]?.dataset.on === "1") return;
  const i = Number(match[1]) - 1;
  const tau = i < 5 ? lerp(STATIONS[i], STATIONS[i + 1], 0.8) : lerp(NIGHT, END, 0.5);
  window.scrollTo({ top: show.top + tau * show.pinH, behavior: "instant" });
}

/** Asks for one frame. */
export function request() {
  if (!scheduled) scheduled = requestAnimationFrame(frame);
}

/** The stage calls this once it can draw: the phone's arrival starts now. */
export function begin() {
  if (!started) {
    started = performance.now();
    // The phone is still arriving: the conversation starts once it can be read.
    heroStarted = started + 700;
    live.hero = 0;
  }
  request();
}

/** The stage draws in the same frame the numbers were worked out. */
export function subscribe(fn: (time: number) => void): () => void {
  subscribers.add(fn);
  request();
  return () => subscribers.delete(fn);
}

/** Starts listening. Returns the function that stops it. */
export function startDirector(): () => void {
  const remeasure = () => {
    stale = true;
    request();
  };
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    request();
  };
  fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", remeasure);
  window.addEventListener("pointermove", onPointer, { passive: true });
  // Web fonts and late layout move the slots: measure again when the page's size changes.
  const observer = new ResizeObserver(remeasure);
  observer.observe(document.body);
  document.fonts?.ready.then(remeasure).catch(() => {});
  const modes = new MutationObserver(remeasure);
  modes.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  // The visitor chooses an app: the hero's conversation plays again in it, as the answer to their choice.
  // (The name rolling by itself only dissolves one finished screen into the other.)
  seenChoices = choices();
  const unsubscribeApp = subscribeApp(() => {
    if (choices() !== seenChoices && started) {
      heroStarted = performance.now() + 220;
      live.hero = 0;
    }
    seenChoices = choices();
    request();
  });
  remeasure();
  return () => {
    unsubscribeApp();
    window.removeEventListener("scroll", request);
    window.removeEventListener("resize", remeasure);
    window.removeEventListener("pointermove", onPointer);
    observer.disconnect();
    modes.disconnect();
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = 0;
  };
}
