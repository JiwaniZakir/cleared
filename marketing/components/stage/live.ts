import type { ScreenState } from "./screen";
import { heroScreen } from "./states";

/** A box in the viewport, in CSS pixels from its top-left corner. */
export type Box = { x: number; y: number; w: number; h: number };

/** Where the phone is and how it is turned: centre and height in viewport pixels, angles in radians. */
export type Pose = { x: number; y: number; h: number; rx: number; ry: number; rz: number };

export type Pulse = { d: number; dir: 1 | -1 };

/**
 * Everything the stage draws, as numbers. The director (director.ts) works these out from the scroll
 * position; the stage (stage.ts) only reads them. Nothing here runs on a clock except `intro`, the one
 * arrival after the page loads, `hero`, the one conversation on the hero's screen, and `tilt`, the pointer's
 * pull on the camera.
 */
export const live = {
  /** The stage's size: the viewport, in CSS pixels. */
  w: 1,
  h: 1,
  /** 0..1: the picture is flat (down a narrow window the bridge is a drawing, with no floor and no darkened corners). */
  flat: 0,
  /** True while something the director runs on its own clock is still on its way (for the checks: a frame is settled when it is not). */
  busy: false,
  /** 0..1: the phone arriving, once, after the page loads. */
  intro: 0,
  /** How far the hero's one sequence has run, in milliseconds (states.ts, `HERO_BEATS`). */
  hero: 0,
  /** The pointer's pull on the camera, eased: -1..1 on each axis. */
  tilt: { x: 0, y: 0 },
  /**
   * The camera. `eye` is the point of the viewport straight ahead of it (pixels from the top-left corner):
   * everything that recedes converges there, and the horizon runs through it. `lens` is how far back it
   * stands, in viewport heights: lower is wider. The plane the phone stands in stays in register with the
   * page whatever these are, so moving them moves the space behind and in front of it, never the layout.
   */
  eye: { x: 0, y: 0 },
  lens: 1.5,
  /** The floor: where it meets the plane the phone stands in (viewport pixels), how much of its shadow is there, and how much it mirrors. */
  floor: { y: 0, day: 1, mirror: 1 },
  /** The light the screen throws on what is near it, as linear red, green and blue. */
  screenLight: [1, 1, 1] as [number, number, number],
  phone: { x: 0, y: 0, h: 1, rx: 0, ry: 0, rz: 0, crop: -1 } as Pose & { crop: number },
  /** Where the conversation on the screen ends, as a share of the screen's height (the stage reads it off the painter): the director crops the phone to it. */
  screenBottom: 1,
  /** The screen: exactly one state, and which way the scroll is going (the phone slides to a new screen from that side). */
  screen: { state: heroScreen() as ScreenState, way: 1 as 1 | -1 },
  /** 1: the bone page's light. 0: night. */
  day: 1,
  /** 0..1: the prism's light, on the floor and along the phone's edges. */
  prism: 0,
  /** 0..1: how far the lit screen glows into the dark around it. */
  glow: 0,
  /** Where along the bridge the camera is, 0 at your end and 1 at the companies: the prism's colour follows it. */
  along: 0,
  /**
   * The lens's focus: how far it is pulled (0: everything sharp), the box that is in focus besides the phone
   * (centre and half size, viewport pixels), and the pane of glass that crosses in front of the lens between
   * stops (where its middle is along its way, its half width, how much of it is there).
   */
  focus: { soft: 0, window: [0, 0, 1, 1] as [number, number, number, number], pane: { at: 0, half: 1, amount: 0, down: false } },
  /** How much of the night sky (stars, the planet's edge, the orbit, the satellite) is there. */
  sky: 0,
  /** The bridge. `geometry` is where its parts stand in the wide shot, measured off the page; it is null until measured. */
  set: {
    geometry: null as SetGeometry | null,
    /** Bumped whenever the geometry changes, so the stage lays the set out again. */
    version: 0,
    state: {
      show: 0,
      anchor: [0, 0],
      target: [0, 0],
      scale: 1,
      yaw: 0,
      back: 0,
      lanes: 0,
      lead: 0,
      layer: 0,
      pool: 0,
      lit: [0, 0, 0, 0],
      glow: [0, 0, 0, 0],
      checks: [0, 0, 0, 0],
      tokens: [0, 1, 2, 3, 4].map(() => ({ u: -9, held: 0 })),
      ticks: [0, 0, 0],
      ring: 0,
      wallGrow: 0,
      replies: [-1, -1, -1],
      comets: 0,
      traffic: 0,
      coupling: { u: -9, lock: 0 },
      only: -1,
      cut: -9,
      from: null,
      leadOn: 1,
    } as SetState,
  },
  night: {
    /** The horizon: the top of its curve, the curve's radius and centre line, in viewport pixels. */
    apex: 0,
    radius: 1,
    cx: 0,
    horizon: 0,
    /** 0..1: the light along the horizon. */
    glow: 0,
    /** The orbit: the top of its curve (it shares the horizon's centre), and how visible it is. */
    orbitApex: 0,
    orbit: 0,
    /** The satellite: 0..1 along the part of the orbit that crosses the viewport, and its span in pixels. */
    sat: 0,
    satSize: 80,
    /** Where the chapter's words are (left, top, right, bottom, in viewport pixels): no star is drawn behind them. */
    quiet: [0, 0, 0, 0] as [number, number, number, number],
  },
};

export type Live = typeof live;

/**
 * Where the bridge's parts stand in the wide shot, in the pixels of the bridge section's pin (so, at rest
 * there, in viewport pixels). Across a wide window the bridge runs left to right; down a narrow one, top to
 * bottom.
 */
export type SetGeometry = {
  axis: "x" | "y";
  /** Where the lanes leave the phone and where they reach the pool: the midline between the two lanes. */
  start: [number, number];
  end: [number, number];
  /** How far apart the two lanes are. */
  gap: number;
  plinth: Box;
  /** The centre of each of the four panes on the lanes, and a pane's width and height as seen. */
  panes: [number, number][];
  pane: [number, number];
  pool: Box;
  /** The application card's size, a comet's length, and the type size on a pool tile. */
  cardSize: [number, number];
  comet: number;
  tileFont: number;
  /** Down a narrow window: the rail has a lead-in from your phone's foot (`SetState.from`) to its start. */
  lead?: boolean;
};

/** Everything the bridge does, as numbers the director works out from the scroll. */
export type SetState = {
  /** 0..1: how much of the set is there at all. */
  show: number;
  /**
   * How the whole set is placed: the point `anchor` (in the geometry's own pixels) is put at `target` (viewport
   * pixels) and everything is scaled by `scale` about it, turned by `yaw` about the vertical through it, and
   * pushed `back` pixels away from the camera. In the wide shot anchor and target are the same point and
   * scale is 1, so every part stands on its label.
   */
  anchor: [number, number];
  target: [number, number];
  scale: number;
  yaw: number;
  back: number;
  /** 0..1: the lanes drawn out from the phone; the plinth and panes assembled; the pool gathered. */
  lanes: number;
  /** 0..1: the lanes run on past your end, behind the phone (once the camera has travelled away from it). */
  lead: number;
  layer: number;
  pool: number;
  /** Per pane: lit (it has checked), glowing (something is passing through), its check popped. */
  lit: number[];
  glow: number[];
  checks: number[];
  /**
   * The five roles, as plain tokens on the upper lane: where each is (0 at your end, 1 at the lanes' end, on to
   * 1.2 at its company's tile; below 0 on a narrow window's lead-in; -9, not there), and whether it has been held (it stays, greyed).
   */
  tokens: { u: number; held: number }[];
  /** The three tiles a role lands on: 1 once it has (the tile lights and takes a tick at its corner). */
  ticks: number[];
  /** At night: the wall's outlines, all nine together, brightening as the notification lands (0..1, on its own clock). */
  ring: number;
  /** How far the set has gone into the night's wide shot (0..1): the wall is enlarged with it, so its marks stay large enough to read. */
  wallGrow: number;
  /** At night: up to three replies, each out of the wall at the lanes' end (1) and back along the lower lane to you (0). No company's tile is singled out. */
  replies: number[];
  /** Agent traffic: how strong the comets are, and where along the lanes they have got to (scroll-driven, wraps). */
  comets: number;
  traffic: number;
  /** The connector: where it is along the lanes (below 0, on a narrow window's lead-in; not there at -9), and its flash as it locks. */
  coupling: { u: number; lock: number };
  /** Which panes are in the picture: -1 all four; 0 to 3 that pane alone; 4 the first three (the legal checks). */
  only: number;
  /** Nothing of the set is drawn before this place along the lanes (across a wide window: behind the phone). */
  cut: number;
  /**
   * Down a narrow window, where your phone's foot is, in the geometry's own pixels: the rail comes down from it
   * to the row of panes (the lead-in), and the roles drop out of it (their `u` below 0 is on the lead-in).
   */
  from: [number, number] | null;
  /** 0..1: how much of the lead-in is drawn (it fades where the picture holds the Vetting pane alone, and would run off its edge). */
  leadOn: number;
};
