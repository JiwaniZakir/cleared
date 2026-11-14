/**
 * What the phone's screen shows: the real interface of the agent the visitor chose, Grok Bot or Muse, with
 * cleared inside it as one of its connectors.
 *
 * A state is data (which screen, which bubbles and cards, how far each has come), and a skin is one app's
 * measured look: its colours, radii, sizes, header and composer, measured off the apps themselves. Every
 * state is drawn through either skin, so the app switch re-skins
 * the whole page. Layout, colours and marks are the apps'; every word of content comes from `PHONE_COPY`
 * (lib/copy.ts), and no company or person is named.
 *
 * One painter, used twice: as the texture on the live 3D phone and as the flat still. Everything is drawn in
 * points on a 390 x 844 screen and scaled to the canvas it is given. App screens are set in the system
 * interface font, which is the face Grok Bot's app uses and the nearest thing to Muse's: nothing is
 * downloaded for them.
 *
 * Every transition is a number: `show` brings a chat's blocks in one by one (each arrives whole, rising a
 * little, as both apps' replies do; nothing is typed out character by character), the agent's working state
 * has `row` and `beat`, a connector has `on`, an approval has `pressed`, the check rows have `done`, the week
 * has `filled`, the lock screen has `wake` and `notif`, each timed as the apps themselves do it; brand/README.md
 * says which states were seen in video and which are still worked out from the rest.
 */
import type { AppId } from "@/lib/app";
import { PRODUCT } from "@/lib/product";

const PRODUCT_NAME = PRODUCT.name;

export const SCREEN = { w: 390, h: 844 } as const;

/** Words that are the same in both apps, or a line for each. */
export type Words = string | Record<AppId, string>;

export type ChatBlock = (
  /** What you typed. `lines`: at most this many, ending in an ellipsis if there is more. */
  | { kind: "user"; text: string; lines?: number }
  /** The agent's reply. `via` shows it came through cleared, in the app's own way: Grok Bot's mark and underlined link at the end of the bubble, Muse's file card under it. */
  | { kind: "agent"; text: Words; via?: string; roles?: readonly { title: string; tag?: string }[] }
  /**
   * The agent at work, between your message and its answer. Grok Bot: three dots in the Bot's colour, then
   * (`row` 0..1) its face and a grey phrase. Muse: typing dots (its phrase is the second line under its name,
   * `ChatScreen.status`). `beat` counts the dots' pulse.
   */
  | { kind: "working"; phrase: string; row: number; beat: number }
  /** The app's own card for a connector offered in the chat. `on` 0..1: from waiting to be added, to added. */
  | { kind: "connector"; caption: string; on: number }
  /**
   * The app's own approval. Grok Bot: a card with the title, grey bars for the application, Cancel and a black
   * Send. Muse: its "Needs review" block, with the question, the detail and three stacked buttons. `pressed` 0..1.
   */
  | { kind: "approval"; title: string; lines: readonly string[]; question: string; detail: string; pressed: number; brief?: boolean }
  /** Rows that tick one by one, each with a small pill naming its source. `done` runs 0..rows.length. */
  | { kind: "checks"; rows: readonly { text: string; source: string }[]; done: number }
  /** The app's own card holding a Monday-to-Friday strip. `filled` runs 0..5. */
  | { kind: "week"; filled: number; scene: string }
  /** The app's own card holding a task: what it is, how long it takes, and the three things it is scored on. */
  | { kind: "task"; title: string; time: string; scored: readonly string[]; read?: readonly string[] }
  /**
   * The agent asks before it sends: its question in a bubble, and under it the app's own button,
   * going down as you press it (`pressed` 0..1). Once sent, the button gives way to `done`, with a tick.
   */
  | { kind: "ask"; text: string; button: string; pressed: number; done?: string }
) & {
  /** In this app only (the two apps do not always split a moment into the same pieces). */
  only?: AppId;
};

export type ChatScreen = {
  kind: "chat";
  /** Which screen this is. The phone slides from one screen to the next when this changes; it never shows two at once. */
  id: string;
  /** Words standing in the composer's field, not yet sent (the message being pasted). */
  field?: string;
  blocks: readonly ChatBlock[];
  /** How many blocks have arrived: 2.5 is two there and the third half risen. */
  show: number;
  /** The second line under Muse's name while it works ("🔎 checking cleared"). At rest it reads "Online". */
  status?: string;
  /** At least this much magnification for the conversation (the hero's: its answer fills the screen, with no empty half). */
  zoom?: number;
};
/** The app's own list of connectors, with cleared in it. `on` 0..1: cleared going from addable to added. */
export type ConnectorsScreen = { kind: "connectors"; id: string; caption: string; on: number };
/** The lock screen at night, with one notification from the app. */
export type LockScreen = { kind: "lock"; id: string; minutes: number; wake: number; notif: number; ago: string; title: string; body: string };
export type ScreenState = ChatScreen | ConnectorsScreen | LockScreen;

/** Pictures the skins need. Each is drawn as supplied; until one has loaded, its place is a plain tile. */
export type ScreenArt = { grokIcon?: CanvasImageSource; museIcon?: CanvasImageSource; museAvatar?: CanvasImageSource };

type Skin = {
  id: AppId;
  /** Who the conversation is with, as the app names it in its header and composer. */
  agent: string;
  /** Grok Bot: the Bot's own colour. Its face, the user's bubbles and the voice button all take it. */
  bot: string;
  bg: string;
  ink: string;
  ink2: string;
  ink3: string;
  agentBubble: string;
  userBubble: string;
  userInk: string;
  radius: number;
  /** Left and right margin of bubbles, their padding, and the text's line height. */
  margin: number;
  padX: number;
  padY: number;
  line: number;
  maxUser: number;
  maxAgent: number;
  /** Gap between bubbles from one speaker, and between speakers. */
  gap: number;
  turn: number;
  /** Where the conversation starts and must end (above the composer). */
  top: number;
  bottom: number;
  card: string;
};

const GROK: Skin = {
  id: "grok", agent: "Job Hunter", bot: "#0D0D0D", bg: "#FCFCFC", ink: "#0D0D0D", ink2: "#6F6F6F", ink3: "#9F9F9F", agentBubble: "#F2F2F2", userBubble: "#0D0D0D", userInk: "#FFFFFF",
  radius: 18, margin: 12, padX: 16, padY: 8, line: 21, maxUser: 270, maxAgent: 314, gap: 8, turn: 20, top: 132, bottom: 762, card: "#F1F2F1",
};
const MUSE: Skin = {
  id: "muse", agent: "Muse", bot: "#0863D6", bg: "#FAFAFA", ink: "#111112", ink2: "#68696D", ink3: "#9D9EA3", agentBubble: "#E9EAEB", userBubble: "#CBE5FF", userInk: "#111112",
  radius: 20, margin: 16, padX: 16, padY: 11, line: 22, maxUser: 300, maxAgent: 312, gap: 8, turn: 16, top: 160, bottom: 694, card: "#E9EAEB",
};
export const SKINS: Record<AppId, Skin> = { grok: GROK, muse: MUSE };

const UI = '-apple-system, "SF Pro Text", system-ui, sans-serif';
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
type Ctx = CanvasRenderingContext2D;
const say = (words: Words, app: AppId) => (typeof words === "string" ? words : words[app]);

/** The family the page's own type is set in (next/font gives it a generated name): cleared's letter is drawn in it. */
export function fontFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mona").trim();
  return family || "system-ui, sans-serif";
}

/* ── Small drawing helpers ───────────────────────────────────────────────────────────────────────── */

function font(ctx: Ctx, weight: number, size: number, family = UI) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(size * -0.012).toFixed(2)}px`;
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
  ctx.fillStyle = fill;
  ctx.fill();
}
/** A raised surface: the apps' round buttons, pills and cards all sit on a soft shadow. */
function raised(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, blur = 10, alpha = 0.09) {
  ctx.save();
  ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur * 0.25;
  box(ctx, x, y, w, h, r, fill);
  ctx.restore();
}
function stroke(ctx: Ctx, colour: string, width: number, draw: () => void) {
  ctx.beginPath();
  draw();
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}
function wrap(ctx: Ctx, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
    // A word wider than the line (an address) breaks where it must: after a slash or a dot where one is near
    // the end of what fits, and never just after a hyphen (an address never breaks at its hyphen).
    while (ctx.measureText(line).width > max && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > max) cut--;
      const soft = Math.max(line.lastIndexOf("/", cut - 1), line.lastIndexOf(".", cut - 1)) + 1;
      if (soft > cut * 0.6) cut = soft;
      while (cut > 2 && line[cut - 1] === "-") cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}
/** The same, kept to `most` lines: the last ends in an ellipsis when there was more. */
function clampLines(ctx: Ctx, text: string, max: number, most?: number): string[] {
  const lines = wrap(ctx, text, max);
  if (!most || lines.length <= most) return lines;
  let last = lines[most - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
  return [...lines.slice(0, most - 1), `${last}…`];
}
/** A grey bar that stands for a line of someone's own text: nothing is invented to fill it. */
const bar = (ctx: Ctx, x: number, y: number, w: number, h = 8) => box(ctx, x, y, w, h, h / 2, "rgba(0, 0, 0, 0.1)");
function check(ctx: Ctx, cx: number, cy: number, r: number, amount: number) {
  // A small black disc with a white tick: the page's one sign for "checked". Never green.
  const k = clamp(amount);
  const pop = k < 1 ? 0.94 + 0.09 * Math.sin(k * Math.PI) + 0.06 * k : 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (k <= 0.02) return;
  ctx.globalAlpha *= k;
  ctx.beginPath();
  ctx.arc(cx, cy, r * pop, 0, Math.PI * 2);
  ctx.fillStyle = "#0D0D0D";
  ctx.fill();
  stroke(ctx, "#FFFFFF", r * 0.24, () => {
    ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.34);
    ctx.lineTo(cx + r * 0.46, cy - r * 0.32);
  });
  ctx.globalAlpha /= k;
}
function picture(ctx: Ctx, image: CanvasImageSource | undefined, x: number, y: number, size: number, r: number, source?: [number, number, number, number]) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, r);
  ctx.clip();
  ctx.fillStyle = "#E4E4E4";
  ctx.fillRect(x, y, size, size);
  if (image) {
    if (source) ctx.drawImage(image, ...source, x, y, size, size);
    else ctx.drawImage(image, x, y, size, size);
  }
  ctx.restore();
}
/** cleared's stand-in icon: the first letter of the word, in ink on a white tile. */
function clearedTile(ctx: Ctx, x: number, y: number, size: number, r: number, family: string) {
  box(ctx, x, y, size, size, r, "#FFFFFF");
  stroke(ctx, "rgba(0, 0, 0, 0.1)", 0.5, () => ctx.roundRect(x, y, size, size, r));
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.font = `680 ${size * 0.62}px ${family}`;
  ctx.fillText("c", x + size / 2, y + size * 0.7);
  ctx.textAlign = "left";
}

/* ── What every screen has: the status bar and the home indicator ────────────────────────────────── */

function statusBar(ctx: Ctx, ink: string, time = true) {
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  font(ctx, 600, 17);
  // The lock screen shows the hour in its own clock: no second, different time beside it.
  if (time) ctx.fillText("9:41", 34, 37);
  // Signal, Wi-Fi, battery.
  for (let i = 0; i < 4; i++) box(ctx, 292 + i * 5, 34 - i * 2.4, 3.2, 4 + i * 2.4, 1, ink);
  for (let i = 0; i < 3; i++) {
    stroke(ctx, ink, 2, () => ctx.arc(324, 37.5, 2.6 + i * 3.6, -Math.PI * 0.75, -Math.PI * 0.25));
  }
  stroke(ctx, ink, 1, () => ctx.roundRect(338, 26.5, 23, 11.5, 3.6));
  box(ctx, 339.8, 28.3, 19.4, 7.9, 2, ink);
  box(ctx, 362.2, 30.4, 1.6, 3.8, 0.8, ink);
}
const homeBar = (ctx: Ctx, colour: string) => box(ctx, 128, 831, 134, 5, 2.5, colour);

/* ── Each app's header and composer ──────────────────────────────────────────────────────────────── */

/** A Bot's face in Grok Bot: a blob in the Bot's colour with two white dashes for eyes. Job Hunter's is black, a cloud. */
function blob(ctx: Ctx, cx: number, cy: number, r: number, colour = GROK.bot) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (const [dx, dy, k] of [[-0.42, 0.16, 0.6], [0.42, 0.16, 0.6], [0, -0.26, 0.72], [0, 0.26, 0.62]] as const) {
    ctx.moveTo(cx + dx * r + k * r, cy + dy * r);
    ctx.arc(cx + dx * r, cy + dy * r, k * r, 0, Math.PI * 2);
  }
  ctx.fill();
  stroke(ctx, "#FFFFFF", r * 0.16, () => {
    ctx.moveTo(cx - r * 0.2, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.12);
    ctx.moveTo(cx + r * 0.24, cy - r * 0.26);
    ctx.lineTo(cx + r * 0.34, cy + r * 0.06);
  });
}

function grokChrome(ctx: Ctx, s: Skin, field?: string) {
  // Header: back, the Bot's pill, its computer.
  raised(ctx, 16, 64, 44, 44, 22, "#F8F8F8");
  stroke(ctx, s.ink, 2, () => {
    ctx.moveTo(41, 78);
    ctx.lineTo(33, 86);
    ctx.lineTo(41, 94);
  });
  font(ctx, 500, 17);
  const name = ctx.measureText(s.agent).width;
  raised(ctx, 66, 64, 44 + name + 18, 44, 22, "#F8F8F8");
  blob(ctx, 90, 86, 12);
  ctx.fillStyle = "#141414";
  ctx.fillText(s.agent, 110, 92);
  raised(ctx, 330, 64, 44, 44, 22, "#F8F8F8");
  stroke(ctx, s.ink, 1.8, () => {
    ctx.roundRect(343, 78, 18, 12.5, 2.5);
    ctx.moveTo(352, 90.5);
    ctx.lineTo(352, 94);
    ctx.moveTo(347.5, 94.5);
    ctx.lineTo(356.5, 94.5);
  });
  // Composer: a plus on its own, the field, the microphone.
  raised(ctx, 28, 778, 44, 44, 22, "#F9F9F9");
  stroke(ctx, s.ink, 1.9, () => {
    ctx.moveTo(50, 791.5);
    ctx.lineTo(50, 808.5);
    ctx.moveTo(41.5, 800);
    ctx.lineTo(58.5, 800);
  });
  raised(ctx, 82, 778, 280, 44, 22, "#FCFCFC", 6, 0.07);
  stroke(ctx, "rgba(0, 0, 0, 0.1)", 0.5, () => ctx.roundRect(82, 778, 280, 44, 22));
  font(ctx, 400, 17);
  ctx.fillStyle = field ? s.ink : s.ink3;
  ctx.fillText(field ? clampLines(ctx, field, 190, 1)[0] : `Ask ${s.agent}`, 100, 806);
  // The microphone, and at the field's end the voice button: a circle in the Bot's colour with a waveform.
  mic(ctx, 308, 800, s.ink);
  box(ctx, 324, 784, 32, 32, 16, s.bot);
  [5, 9, 13, 9, 5].forEach((h, i) => box(ctx, 331.3 + i * 4, 800 - h / 2, 1.8, h, 0.9, "#FFFFFF"));
}

function mic(ctx: Ctx, cx: number, cy: number, colour: string) {
  box(ctx, cx - 3.2, cy - 8, 6.4, 11, 3.2, colour);
  stroke(ctx, colour, 1.5, () => {
    ctx.arc(cx, cy - 1, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 8);
  });
}

function museChrome(ctx: Ctx, s: Skin, art: ScreenArt, status: string, field?: string) {
  // Header: the menu, and Muse's face over its name.
  raised(ctx, 20, 61, 44, 44, 22, "#FDFDFD", 12, 0.08);
  stroke(ctx, s.ink, 2, () => {
    ctx.moveTo(33, 79);
    ctx.lineTo(51, 79);
    ctx.moveTo(33, 87);
    ctx.lineTo(51, 87);
  });
  // Its name, and under it what it is doing: "Online" at rest, an emoji and a lowercase phrase while it works.
  font(ctx, 400, 11);
  const pill = Math.max(60, ctx.measureText(status).width + 22);
  raised(ctx, 195 - pill / 2, 99, pill, 40, 14, "#FEFEFE", 10, 0.1);
  if (art.museAvatar) ctx.drawImage(art.museAvatar, 174, 61, 42, 42);
  else box(ctx, 178, 64, 34, 38, 17, "#E7DCCB");
  ctx.textAlign = "center";
  ctx.fillStyle = s.ink2;
  ctx.fillText(status, 195, 132);
  ctx.fillStyle = s.ink;
  font(ctx, 600, 14);
  ctx.fillText(s.agent, 195, 118);
  ctx.textAlign = "left";
  // Composer: one pill, and the tab bar under it.
  raised(ctx, 16, 708, 358, 44, 22, "#F8F8F8", 10, 0.07);
  stroke(ctx, s.ink, 1.9, () => {
    ctx.moveTo(40, 722);
    ctx.lineTo(40, 738);
    ctx.moveTo(32, 730);
    ctx.lineTo(48, 730);
  });
  font(ctx, 400, 17);
  ctx.fillStyle = field ? s.ink : s.ink3;
  ctx.fillText(field ? clampLines(ctx, field, 262, 1)[0] : "Message", 60, 736);
  mic(ctx, 350, 731, s.ink);
  raised(ctx, 95, 764, 200, 48, 24, "#FFFFFF", 12, 0.09);
  box(ctx, 103, 770, 36, 36, 18, "#F3F4F6");
  const tab = (i: number, draw: (x: number, y: number) => void) => stroke(ctx, i === 0 ? s.ink : s.ink2, 1.7, () => draw(121 + i * 37, 788));
  tab(0, (x, y) => ctx.roundRect(x - 8, y - 7, 16, 13, 5)); // chat
  tab(1, (x, y) => {
    ctx.roundRect(x - 7.5, y - 7.5, 15, 15, 3.5); // feed
    ctx.moveTo(x - 3.5, y - 2);
    ctx.lineTo(x + 3.5, y - 2);
    ctx.moveTo(x - 3.5, y + 2.5);
    ctx.lineTo(x + 1, y + 2.5);
  });
  tab(2, (x, y) => {
    ctx.arc(x, y - 1.5, 6, Math.PI * 0.75, Math.PI * 0.25); // ideas
    ctx.moveTo(x - 2.5, y + 7.5);
    ctx.lineTo(x + 2.5, y + 7.5);
  });
  tab(3, (x, y) => {
    ctx.roundRect(x - 7.5, y - 7.5, 15, 15, 4); // goals
    ctx.moveTo(x - 3.5, y);
    ctx.lineTo(x - 1, y + 2.8);
    ctx.lineTo(x + 4, y - 3);
  });
  tab(4, (x, y) => {
    ctx.arc(x - 4, y - 4, 3, 0, Math.PI * 2); // library
    ctx.roundRect(x + 1, y - 7, 6, 6, 1.5);
    ctx.roundRect(x - 7, y + 1, 6, 6, 1.5);
    ctx.moveTo(x + 7, y + 4);
    ctx.arc(x + 4, y + 4, 3, 0, Math.PI * 2);
  });
}

/* ── A conversation ──────────────────────────────────────────────────────────────────────────────── */

/** Works out a block's size, then (when `ctx.globalAlpha` is above nothing) draws it at `y`. Returns its height. */
function block(ctx: Ctx, s: Skin, b: ChatBlock, y: number, draw: boolean, family: string, vw: number): number {
  // `vw` is the screen's width as the conversation sees it: narrower than the screen when it is magnified.
  const room = vw - s.margin * 2;
  if (b.kind === "user" || b.kind === "agent") {
    const mine = b.kind === "user";
    const max = Math.min(mine ? s.maxUser : s.maxAgent, room - (mine ? 36 : 20)) - s.padX * 2;
    font(ctx, 400, 17);
    const lines = clampLines(ctx, mine ? b.text : say(b.text, s.id), max, mine ? b.lines : undefined);
    const via = !mine && b.via ? b.via : null;
    // Grok Bot names where an answer came from inside the bubble: the connector's small mark and an underlined link.
    const link = via && s.id === "grok" ? ctx.measureText(via).width + 24 : 0;
    // The roles it found, as a list in the answer: titles only, with a small tag on the ones that need one.
    const roles = !mine && b.roles ? b.roles : [];
    const rowH = 25;
    font(ctx, 500, 12);
    // A role's line never runs past its bubble: where title and tag would not fit, the title is set a little
    // smaller (never under 14), and the bubble may take what is left of the screen's width before that.
    const hard = Math.max(max, room - s.margin - 8 - s.padX * 2);
    const sized = roles.map((role) => ({ ...role, tagW: role.tag ? ctx.measureText(role.tag).width + 14 : 0 }));
    font(ctx, 400, 17);
    const rows = sized.map((role) => {
      const full = ctx.measureText(role.title).width;
      const room17 = hard - 16 - (role.tagW ? role.tagW + 8 : 0);
      const size = Math.max(14, Math.min(17, (17 * room17) / full));
      // Still too long at 14: the tag goes under the title, on a line of its own.
      const under = !!role.tagW && (full * size) / 17 + 16 + role.tagW + 8 > hard;
      return { ...role, size, under };
    });
    const rowW = (role: (typeof rows)[number]) => {
      font(ctx, 400, role.size);
      const w = role.under ? Math.max(ctx.measureText(role.title).width + 16, 16 + role.tagW) : ctx.measureText(role.title).width + 16 + (role.tagW ? role.tagW + 8 : 0);
      font(ctx, 400, 17);
      return w;
    };
    const widest = Math.max(0, ...rows.map(rowW));
    const rowTop = (i: number) => rows.slice(0, i).reduce((sum, role) => sum + rowH + (role.under ? 22 : 0), 0);
    const listH = rows.length ? rowTop(rows.length) + 8 : 0;
    const width = Math.min(Math.max(max, widest), hard, Math.max(...lines.map((line) => ctx.measureText(line).width), link, widest)) + s.padX * 2;
    const height = lines.length * s.line + s.padY * 2 + listH + (link ? s.line + 4 : 0);
    const x = mine ? vw - s.margin - width : s.margin;
    // Muse puts it under the bubble, as one of its file cards.
    const cardW = Math.min(250, room);
    // (Its words inside the card: set a little smaller on a narrow column, never under 13, and on two lines if they must.)
    const fits = cardW - 54 - 14;
    font(ctx, 500, 16);
    const viaSize = via ? Math.max(13, Math.min(16, (16 * fits) / ctx.measureText(via).width)) : 16;
    font(ctx, 500, viaSize);
    const viaLines = via && s.id === "muse" ? wrap(ctx, via, fits) : [];
    const cardH = via && s.id === "muse" ? 60 + (viaLines.length - 1) * 17 : 0;
    if (draw) {
      box(ctx, x, y, width, height, s.radius, mine ? s.userBubble : s.agentBubble);
      ctx.fillStyle = mine ? s.userInk : s.ink;
      font(ctx, 400, 17);
      lines.forEach((line, i) => ctx.fillText(line, x + s.padX, y + s.padY + i * s.line + s.line * 0.76));
      rows.forEach((role, i) => {
        const ry = y + s.padY + lines.length * s.line + 8 + rowTop(i);
        box(ctx, x + s.padX + 1, ry + 9.5, 5, 5, 2.5, s.ink2);
        ctx.fillStyle = s.ink;
        font(ctx, 400, role.size);
        ctx.fillText(role.title, x + s.padX + 16, ry + 18);
        if (role.tag) {
          const tx = role.under ? x + s.padX + 16 : x + s.padX + 16 + ctx.measureText(role.title).width + 8;
          const ty = role.under ? ry + 22 : ry;
          if (tx + role.tagW > x + width - 2 || tx + role.tagW > vw - 2) painted.overflow = true;
          box(ctx, tx, ty + 2.5, role.tagW, 19, 9.5, "#FFFFFF");
          ctx.fillStyle = s.ink2;
          font(ctx, 500, 12);
          ctx.fillText(role.tag, tx + 7, ty + 16);
        }
      });
      if (via && link) {
        const ly = y + s.padY + lines.length * s.line + listH + 4;
        clearedTile(ctx, x + s.padX, ly + 2, 17, 4.5, family);
        ctx.fillStyle = s.ink;
        font(ctx, 400, 17);
        ctx.fillText(via, x + s.padX + 24, ly + s.line * 0.76);
        box(ctx, x + s.padX + 24, ly + s.line * 0.76 + 2.5, ctx.measureText(via).width, 1, 0, s.ink);
      }
      if (via && cardH) {
        const cy = y + height + s.gap;
        box(ctx, s.margin, cy, cardW, cardH, 18, s.card);
        box(ctx, s.margin + 8, cy + 8, cardW - 16, cardH - 16, 12, "#FFFFFF");
        clearedTile(ctx, s.margin + 16, cy + 16, 28, 7, family);
        ctx.fillStyle = s.ink;
        font(ctx, 500, viaSize);
        viaLines.forEach((line, i) => {
          if (ctx.measureText(line).width > fits + 1) painted.overflow = true;
          ctx.fillText(line, s.margin + 54, cy + 35.5 - ((viaLines.length - 1) * 17) / 2 + i * 17);
        });
      }
    }
    return height + (cardH ? cardH + s.gap : 0);
  }

  if (b.kind === "working") {
    // Between your message and the answer.
    const h = 30;
    if (!draw) return h;
    const at = Math.floor(b.beat) % 3;
    if (s.id === "muse") {
      // Typing dots in a grey pill; what it is doing is under its name, at the top.
      box(ctx, s.margin, y, 54, h, 15, s.agentBubble);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s.margin + 16 + i * 11, y + h / 2, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = i === at ? "#85868B" : "#B6B7BB";
        ctx.fill();
      }
      return h;
    }
    // Grok Bot: three dots in the Bot's colour, one larger at a time; then the Bot's face and a grey phrase.
    const row = clamp(b.row);
    const alpha = ctx.globalAlpha;
    if (row < 1) {
      ctx.globalAlpha = alpha * (1 - row);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s.margin + 10 + i * 13, y + h / 2, i === at ? 6 : 3.6, 0, Math.PI * 2);
        ctx.fillStyle = s.bot;
        ctx.globalAlpha = alpha * (1 - row) * (i === at ? 1 : 0.45);
        ctx.fill();
      }
    }
    if (row > 0) {
      ctx.globalAlpha = alpha * row;
      blob(ctx, s.margin + 12, y + h / 2, 10, s.bot);
      ctx.fillStyle = s.ink2;
      font(ctx, 400, 17);
      ctx.fillText(b.phrase, s.margin + 32, y + h / 2 + 6);
    }
    ctx.globalAlpha = alpha;
    return h;
  }

  if (b.kind === "connector") {
    const on = ease(clamp(b.on));
    if (s.id === "grok") {
      // The connector's card: its tile, name and caption, then "Not added yet" and a black Add. Added, it
      // closes up to one row.
      const x = s.margin;
      const w = Math.min(314, room);
      const h = lerp(132, 60, on);
      if (draw) {
        const alpha = ctx.globalAlpha;
        raised(ctx, x, y, w, h, 18, "#FFFFFF", 8, 0.06);
        stroke(ctx, "rgba(28, 28, 28, 0.12)", 0.5, () => ctx.roundRect(x, y, w, h, 18));
        const tile = lerp(40, 30, on);
        clearedTile(ctx, x + 16, y + 15, tile, tile * 0.25, family);
        ctx.fillStyle = "#0A0A0A";
        font(ctx, 500, 17);
        ctx.fillText(PRODUCT_NAME, x + 28 + tile, y + lerp(33, 36, on));
        // Open: the caption (inside the card's padding), a rule, the state and the button.
        ctx.globalAlpha = alpha * (1 - on);
        ctx.fillStyle = s.ink2;
        if (on < 0.5) fits(ctx, b.caption, w - 28 - tile - 16, 400, 15);
        else font(ctx, 400, 15);
        ctx.fillText(b.caption, x + 28 + tile, y + 53);
        box(ctx, x + 16, y + 72, w - 32, 0.5, 0, "rgba(0, 0, 0, 0.12)");
        ctx.fillStyle = s.ink2;
        ctx.fillText("Not added yet", x + 16, y + 107);
        font(ctx, 500, 15);
        const add = ctx.measureText("Add").width + 36;
        box(ctx, x + w - 16 - add, y + 85, add, 34, 17, "#0D0D0D");
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText("Add", x + w - 16 - add / 2, y + 107.5);
        ctx.textAlign = "left";
        // Closed: a tick and "Added" at the row's end.
        ctx.globalAlpha = alpha * on;
        ctx.fillStyle = s.ink2;
        font(ctx, 400, 15);
        ctx.textAlign = "right";
        ctx.fillText("Added", x + w - 18, y + 35.5);
        const tw = ctx.measureText("Added").width;
        ctx.textAlign = "left";
        stroke(ctx, s.ink2, 1.8, () => {
          ctx.moveTo(x + w - 18 - tw - 18, y + 30.5);
          ctx.lineTo(x + w - 18 - tw - 13.5, y + 35);
          ctx.lineTo(x + w - 18 - tw - 6, y + 26);
        });
        ctx.globalAlpha = alpha;
      }
      return h;
    }
    // Muse: the connector's tile and name, "Connector" under it, and one wide button that becomes "Connected".
    const w = Math.min(212, room);
    const h = 86;
    if (draw) {
      clearedTile(ctx, s.margin, y, 38, 9.5, family);
      ctx.fillStyle = s.ink;
      font(ctx, 600, 15);
      ctx.fillText(PRODUCT_NAME, s.margin + 48, y + 16);
      ctx.fillStyle = s.ink2;
      font(ctx, 400, 13);
      ctx.fillText("Connector", s.margin + 48, y + 33);
      box(ctx, s.margin, y + 50, w, 36, 18, "#E6E7E9");
      const label = on > 0.5 ? "Connected" : "Connect";
      font(ctx, 500, 15);
      const lw = ctx.measureText(label).width;
      const fade = Math.abs(on - 0.5) * 2;
      const alpha = ctx.globalAlpha;
      ctx.globalAlpha = alpha * fade;
      ctx.fillStyle = s.ink;
      ctx.textAlign = "center";
      ctx.fillText(label, s.margin + w / 2 + (on > 0.5 ? 9 : 0), y + 73.5);
      ctx.textAlign = "left";
      if (on > 0.5) {
        stroke(ctx, s.ink, 1.8, () => {
          ctx.moveTo(s.margin + w / 2 - lw / 2 - 9, y + 68.5);
          ctx.lineTo(s.margin + w / 2 - lw / 2 - 4.5, y + 73);
          ctx.lineTo(s.margin + w / 2 - lw / 2 + 3, y + 64);
        });
      }
      ctx.globalAlpha = alpha;
    }
    return h;
  }

  if (b.kind === "ask") {
    const bubble = block(ctx, s, { kind: "agent", text: b.text }, y, draw, family, vw);
    const top = y + bubble + 10;
    if (b.done) {
      // Sent: a tick in the agent's grey, and the line beside it.
      font(ctx, 400, 15);
      const lines = clampLines(ctx, b.done, room - 26);
      if (draw) {
        box(ctx, s.margin, top + 1, 18, 18, 9, s.ink2);
        stroke(ctx, "#FFFFFF", 2, () => {
          ctx.moveTo(s.margin + 5, top + 10.5);
          ctx.lineTo(s.margin + 8, top + 13.5);
          ctx.lineTo(s.margin + 13.5, top + 7);
        });
        ctx.fillStyle = s.ink2;
        lines.forEach((line, i) => ctx.fillText(line, s.margin + 26, top + 15 + i * 20));
      }
      return bubble + 10 + lines.length * 20;
    }
    // The app's own primary button: Grok Bot's black pill, Muse's blue one.
    const press = Math.sin(clamp(b.pressed) * Math.PI);
    const k = 1 - 0.04 * press;
    font(ctx, 500, 15);
    const w = ctx.measureText(b.button).width + 48;
    if (draw) {
      ctx.save();
      ctx.translate(s.margin + w / 2, top + 17);
      ctx.scale(k, k);
      if (s.id === "grok") box(ctx, -w / 2, -17, w, 34, 17, press > 0.5 ? "#3A3A39" : "#0D0D0D");
      else {
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        g.addColorStop(0, press > 0.5 ? "#064FAB" : "#0863D6");
        g.addColorStop(1, press > 0.5 ? "#3443B5" : "#4254E2");
        ctx.beginPath();
        ctx.roundRect(-w / 2, -17, w, 34, 17);
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText(b.button, 0, 5.5);
      ctx.textAlign = "left";
      ctx.restore();
    }
    return bubble + 10 + 34;
  }

  if (b.kind === "approval") {
    const press = Math.sin(clamp(b.pressed) * Math.PI);
    const k = 1 - 0.04 * press;
    if (s.id === "grok") {
      // A white card: what is to be sent (its title, grey bars for the application), a plain Cancel and a
      // black pill named for the action.
      const x = s.margin;
      const w = Math.min(314, room);
      font(ctx, 500, 17);
      const title = wrap(ctx, b.title, w - 34);
      font(ctx, 400, 15);
      const body = b.lines.map((line) => wrap(ctx, line, w - 34));
      const bodyH = body.reduce((sum, lines) => sum + lines.length * 20 + 5, 0);
      const h = 18 + title.length * 22 + 6 + bodyH + 12 + 34 + 16;
      if (draw) {
        raised(ctx, x, y, w, h, 18, "#FFFFFF", 8, 0.06);
        stroke(ctx, "rgba(28, 28, 28, 0.12)", 0.5, () => ctx.roundRect(x, y, w, h, 18));
        ctx.fillStyle = "#0A0A0A";
        font(ctx, 500, 17);
        title.forEach((line, i) => ctx.fillText(line, x + 17, y + 18 + i * 22 + 16));
        // The application as it will be sent, in its own words.
        ctx.fillStyle = s.ink2;
        font(ctx, 400, 15);
        let ly = y + 18 + title.length * 22 + 6;
        for (const lines of body) {
          lines.forEach((line, i) => ctx.fillText(line, x + 17, ly + i * 20 + 15));
          ly += lines.length * 20 + 5;
        }
        const by = y + h - 16 - 17;
        font(ctx, 500, 15);
        const send = ctx.measureText("Send").width + 40;
        ctx.save();
        ctx.translate(x + w - 16 - send / 2, by);
        ctx.scale(k, k);
        box(ctx, -send / 2, -17, send, 34, 17, press > 0.5 ? "#3A3A39" : "#0D0D0D");
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.fillText("Send", 0, 5.5);
        ctx.restore();
        ctx.fillStyle = "#0A0A0A";
        ctx.textAlign = "right";
        ctx.fillText("Cancel", x + w - 16 - send - 18, by + 5.5);
        ctx.textAlign = "left";
      }
      return h;
    }
    // Muse: "Needs review". The connector's tile, the question, the detail, then three buttons, stacked.
    const x = s.margin;
    const w = Math.min(358, room);
    font(ctx, 500, 16);
    const question = wrap(ctx, b.question, w - 44);
    font(ctx, 400, 14);
    // The detail: the application's title and its lines, as it will be sent.
    // The detail: the application's title and its evidence line (the whole application is Grok Bot's card; in
    // Muse's sheet it would push "Deny" under the composer). `brief`, for a phone cropped to its live message: the title alone.
    const detail = (b.brief ? [b.title] : [b.title, ...b.lines.slice(1, 2)]).flatMap((line) => wrap(ctx, line, w - 44));
    const buttons = y + 34 + question.length * 21 + 4 + detail.length * 19 + 14;
    if (draw) {
      ctx.fillStyle = s.ink;
      font(ctx, 600, 15);
      ctx.fillText("Needs review", x, y + 16);
      clearedTile(ctx, x, y + 36, 32, 8, family);
      ctx.fillStyle = s.ink;
      font(ctx, 500, 16);
      question.forEach((line, i) => ctx.fillText(line, x + 44, y + 34 + i * 21 + 16));
      ctx.fillStyle = s.ink2;
      font(ctx, 400, 14);
      detail.forEach((line, i) => ctx.fillText(line, x + 44, y + 34 + question.length * 21 + 4 + i * 19 + 14));
      ["Allow once", "Allow for this task", "Deny"].forEach((label, i) => {
        const by = buttons + i * 44;
        ctx.save();
        ctx.translate(x + w / 2, by + 18);
        if (i === 0) {
          ctx.scale(k, k);
          const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
          g.addColorStop(0, press > 0.5 ? "#064FAB" : "#0863D6");
          g.addColorStop(1, press > 0.5 ? "#3443B5" : "#4254E2");
          ctx.beginPath();
          ctx.roundRect(-w / 2, -18, w, 36, 18);
          ctx.fillStyle = g;
          ctx.fill();
        } else box(ctx, -w / 2, -18, w, 36, 18, "#EDEEF0");
        ctx.fillStyle = i === 0 ? "#FFFFFF" : s.ink;
        ctx.textAlign = "center";
        font(ctx, 500, 15);
        ctx.fillText(label, 0, 5.5);
        ctx.restore();
      });
      ctx.textAlign = "left";
    }
    return buttons + 3 * 44 - 8 - y;
  }

  if (b.kind === "checks") {
    // One short bubble a row, as the apps split a reply: a check, the line, and a pill naming the source.
    const rowH = s.padY * 2 + s.line + 28;
    if (draw) {
      b.rows.forEach((row, i) => {
        const k = clamp(b.done - i);
        const top = y + i * (rowH + s.gap);
        font(ctx, 400, 17);
        const textW = ctx.measureText(row.text).width;
        const width = Math.min(s.maxAgent, room, Math.max(textW + 32, 150) + s.padX * 2);
        // Where the room is narrower than the line (the magnified picture), the line is set a little smaller, never past the bubble's edge.
        const size = Math.max(14, Math.min(17, (17 * (width - s.padX * 2 - 32)) / textW));
        if ((textW * size) / 17 > width - s.padX * 2 - 32 + 1) painted.overflow = true;
        box(ctx, s.margin, top, width, rowH, s.radius, s.agentBubble);
        check(ctx, s.margin + s.padX + 10, top + s.padY + s.line / 2 + 1, 10, k);
        ctx.fillStyle = s.ink;
        ctx.globalAlpha *= lerp(0.42, 1, ease(k));
        font(ctx, 400, size);
        ctx.fillText(row.text, s.margin + s.padX + 30, top + s.padY + s.line * 0.76);
        ctx.globalAlpha /= lerp(0.42, 1, ease(k));
        if (k > 0.02) {
          // The source: a small pill reading its domain, rising in as the row is checked.
          const e = ease(k);
          ctx.globalAlpha *= e;
          font(ctx, 500, 13);
          const pill = ctx.measureText(row.source).width + 20;
          const py = top + s.padY + s.line + 4 + (1 - e) * 5;
          box(ctx, s.margin + s.padX + 30, py, pill, 22, 11, "#FFFFFF");
          stroke(ctx, "rgba(0, 0, 0, 0.12)", 0.6, () => ctx.roundRect(s.margin + s.padX + 30, py, pill, 22, 11));
          ctx.fillStyle = s.ink2;
          ctx.fillText(row.source, s.margin + s.padX + 40, py + 15.5);
          ctx.globalAlpha /= e;
        }
      });
    }
    return b.rows.length * rowH + (b.rows.length - 1) * s.gap;
  }

  // The app's own card (Grok Bot's link card, Muse's file card) holding one thing.
  const w = Math.min(s.id === "grok" ? 314 : 312, room);
  const ix = s.margin + 12;
  const iw = w - 24;
  const px = ix + (s.id === "muse" ? 14 : 4);
  const pw = iw - (s.id === "muse" ? 28 : 8);
  if (b.kind === "week") {
    font(ctx, 400, 15);
    const scene = wrap(ctx, b.scene, pw);
    const h = 24 + 44 + 12 + scene.length * 20 + 20;
    if (draw) {
      box(ctx, s.margin, y, w, h, s.radius, s.card);
      if (s.id === "muse") box(ctx, ix, y + 12, iw, h - 24, 14, "#FFFFFF");
      // Monday to Friday, filling from the left.
      const cell = (pw - 4 * 8) / 5;
      ["M", "T", "W", "T", "F"].forEach((day, i) => {
        const on = b.filled - i >= 0.5;
        const cx = px + i * (cell + 8);
        box(ctx, cx, y + 24, cell, 44, 10, on ? s.ink : s.id === "muse" ? "#F3F4F6" : "#FFFFFF");
        ctx.fillStyle = on ? "#FFFFFF" : s.ink2;
        ctx.textAlign = "center";
        font(ctx, 600, 15);
        ctx.fillText(day, cx + cell / 2, y + 51.5);
        ctx.textAlign = "left";
      });
      // The day's scene, in words.
      ctx.fillStyle = s.ink;
      font(ctx, 400, 15);
      scene.forEach((line, i) => ctx.fillText(line, px, y + 80 + i * 20 + 15));
    }
    return h;
  }
  // The task: what it is, how long, and the three things it is scored on.
  font(ctx, 500, 17);
  const title = wrap(ctx, b.title, pw);
  // Each criterion, and once done its read-back beside it; where the two would not fit on one line even with the
  // criterion set smaller, the read-back goes under it.
  const rows = b.scored.map((line, i) => {
    const verdict = b.read?.[i];
    font(ctx, 500, 14);
    const vw = verdict ? ctx.measureText(verdict).width : 0;
    font(ctx, 400, 13);
    return { line, verdict, under: !!verdict && ctx.measureText(line).width > pw - 22 - 10 - vw };
  });
  const rowTop = (i: number) => rows.slice(0, i).reduce((sum, row) => sum + (row.under ? 42 : 24), 0);
  const h = 22 + title.length * 22 + 22 + 8 + rowTop(rows.length) + 18;
  if (draw) {
    box(ctx, s.margin, y, w, h, s.radius, s.card);
    if (s.id === "muse") box(ctx, ix, y + 12, iw, h - 24, 14, "#FFFFFF");
    ctx.fillStyle = s.ink;
    font(ctx, 500, 17);
    title.forEach((line, i) => ctx.fillText(line, px, y + 22 + i * 22 + 16));
    ctx.fillStyle = s.ink2;
    font(ctx, 400, 15);
    ctx.fillText(b.time, px, y + 22 + title.length * 22 + 16);
    rows.forEach(({ line, verdict, under }, i) => {
      const ry = y + 22 + title.length * 22 + 30 + rowTop(i);
      stroke(ctx, s.ink2, 1.4, () => ctx.arc(px + 7, ry + 11, 6, 0, Math.PI * 2));
      ctx.fillStyle = s.ink;
      // Once done, the task read back on each criterion, in the product's own words (no score, no rank).
      font(ctx, 500, 14);
      const room = under || !verdict ? pw - 22 : pw - 22 - 10 - ctx.measureText(verdict).width;
      fits(ctx, line, room, 400, 15);
      ctx.fillText(line, px + 22, ry + 16);
      if (verdict) {
        font(ctx, 500, 14);
        ctx.fillStyle = verdict === "aligned" ? s.ink : s.ink2;
        ctx.textAlign = under ? "left" : "right";
        ctx.fillText(verdict, under ? px + 22 : px + pw, under ? ry + 34 : ry + 16);
        ctx.textAlign = "left";
        if (verdict === "aligned") {
          ctx.fillStyle = s.ink;
          ctx.beginPath();
          ctx.arc(px + 7, ry + 11, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
  }
  return h;
}

/**
 * Which picture of a screen is painted, from how many page pixels one of the screen's points is drawn at.
 *
 *   near     the app as it is, with its whole furniture; the conversation is magnified (`by`) until its
 *            smallest type is about 12 px on the page, and re-flowed to the width that leaves.
 *   compact  for a phone standing small: the whole screen magnified (`by`) until its type is 12 px on the
 *            page, with a small header (the agent's mark and name) and nothing else of the furniture.
 *   far      smaller than words can be: the same layout with plain bars for type. Only a phone on its way
 *            from one place to another is ever this small.
 *
 * A screen is always exactly one of these: the change from one to another is a cut.
 */
export type Picture = { kind: "near" | "compact" | "far"; by: number; /** The smallest type in its content, in page pixels. */ type: number };
export function pictureOf(px: number): Picture {
  const needed = 12.6 / (17 * px);
  if (needed > 2.6) return { kind: "far", by: 1.45, type: 0 };
  if (needed > 1.2) {
    const by = Math.ceil(needed * 20) / 20;
    return { kind: "compact", by, type: 17 * px * by };
  }
  const by = Math.round(clamp(12.6 / (13 * px), 1, 1.45) * 20) / 20;
  return { kind: "near", by, type: 13 * px * by };
}

/** A short fade under the app's header, so a conversation that has run on goes up under it softly. */
function fadeUnder(ctx: Ctx, bg: string, y: number, w: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + 12);
  g.addColorStop(0, bg);
  g.addColorStop(1, bg.length === 7 ? `${bg}00` : "rgba(255, 255, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, w, 12);
}

/** How tall the conversation stands in a column `vw` wide. */
function conversationH(ctx: Ctx, s: Skin, state: ChatScreen, family: string, vw: number) {
  let total = 0;
  let prev: ChatBlock["kind"] | null = null;
  for (const b of state.blocks.filter((b) => !b.only || b.only === s.id)) {
    if (prev) total += (prev === "user") !== (b.kind === "user") ? s.turn : s.gap;
    total += block(ctx, s, b, 0, false, family, vw);
    prev = b.kind;
  }
  return total;
}

/**
 * Lays the conversation out from `top` down in a column `vw` wide, and draws it. Where it is taller than the room
 * down to `bottom`, it shows its last turns whole, as a chat that has run on: what came before has gone up under
 * the app's header. Returns where it ends.
 */
function converse(ctx: Ctx, s: Skin, state: ChatScreen, family: string, vw: number, top: number, bottom = Infinity) {
  let y = top;
  let last: ChatBlock["kind"] | null = null;
  // The two apps do not always split a moment into the same pieces: each gets its own.
  const blocks = state.blocks.filter((b) => !b.only || b.only === s.id);
  // Where it is taller than the room, it shows its last turns whole: the earlier ones have gone up under the
  // header (they are not drawn), and none is ever cut part-way. Only a single turn taller than the room is cut, at its foot.
  let first = 0;
  if (Number.isFinite(bottom)) {
    const room = bottom - top;
    while (first < blocks.length - 1 && conversationH(ctx, s, { ...state, blocks: blocks.slice(first) }, family, vw) > room) first++;
    const total = conversationH(ctx, s, { ...state, blocks: blocks.slice(first) }, family, vw);
    if (total > room + 1) painted.sliced = true;
  }
  blocks.forEach((b, i) => {
    if (i < first) return;
    const k = clamp(state.show - i);
    const height = block(ctx, s, b, y, false, family, vw);
    if (last) y += (last === "user") !== (b.kind === "user") ? s.turn : s.gap;
    if (k > 0.01) {
      // Arriving whole: up from a little below (only the hero's one sequence, on its clock, is ever part-way).
      const e = ease(k);
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(0, (1 - e) * 14);
      block(ctx, s, b, y, true, family, vw);
      ctx.restore();
    }
    y += height;
    last = b.kind;
  });
  return y;
}

function paintChat(ctx: Ctx, s: Skin, state: ChatScreen, art: ScreenArt, family: string, picture: Picture) {
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  if (picture.kind === "compact") {
    // The whole screen, larger: a small header under the island, then the conversation.
    const c = picture.by;
    const vw = SCREEN.w / c;
    const head = 56 / c;
    const top = head + 36 + 14;
    ctx.save();
    ctx.scale(c, c);
    painted.bottom = Math.min(1, ((converse(ctx, s, state, family, vw, top, (SCREEN.h - 40) / c) + 14) * c) / SCREEN.h);
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, vw, top - 6);
    fadeUnder(ctx, s.bg, top - 6, vw);
    font(ctx, 500, 17);
    const name = ctx.measureText(s.agent).width;
    if (s.id === "grok") {
      raised(ctx, s.margin, head, 44 + name + 14, 36, 18, "#F8F8F8");
      blob(ctx, s.margin + 20, head + 18, 10, s.bot);
      ctx.fillStyle = "#141414";
      ctx.fillText(s.agent, s.margin + 38, head + 24);
    } else {
      if (art.museAvatar) ctx.drawImage(art.museAvatar, s.margin, head, 36, 36);
      else box(ctx, s.margin, head, 36, 36, 18, "#E7DCCB");
      ctx.fillStyle = s.ink;
      ctx.fillText(s.agent, s.margin + 44, head + 24);
    }
    ctx.restore();
    homeBar(ctx, s.ink);
    return;
  }
  // The conversation, magnified when the phone is small on the page: larger type in the same layout, re-flowed
  // to the width that leaves, so nothing runs off the screen.
  // (A screen's own magnification, where it asks for one, only as far as its conversation still fits above the composer.)
  let zoom = Math.max(picture.by, state.zoom ?? 0);
  while (zoom > picture.by && s.top + conversationH(ctx, s, state, family, SCREEN.w / zoom) * zoom > s.bottom - 12) zoom = Math.max(picture.by, zoom - 0.05);
  ctx.save();
  ctx.translate(0, s.top);
  ctx.scale(zoom, zoom);
  ctx.translate(0, -s.top);
  const end = converse(ctx, s, state, family, SCREEN.w / zoom, s.top, s.top + (s.bottom - 12 - s.top) / zoom);
  painted.bottom = Math.min(1, (s.top + (end + 14 - s.top) * zoom) / SCREEN.h);
  ctx.restore();
  // The app's own furniture, over the conversation.
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, SCREEN.w, s.id === "grok" ? 116 : 146);
  fadeUnder(ctx, s.bg, s.id === "grok" ? 116 : 146, SCREEN.w);
  ctx.fillRect(0, s.bottom + 4, SCREEN.w, SCREEN.h - s.bottom - 4);
  statusBar(ctx, "#000000");
  if (s.id === "grok") grokChrome(ctx, s, state.field);
  else museChrome(ctx, s, art, state.status ?? "Online", state.field);
  homeBar(ctx, s.ink);
}

/* ── The app's list of connectors, with cleared in it ────────────────────────────────────────────── */

function paintConnectors(ctx: Ctx, s: Skin, state: ConnectorsScreen, family: string) {
  const on = clamp(state.on);
  if (s.id === "grok") {
    // Grok Bot: the Plugins sheet over the home screen.
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
    statusBar(ctx, "#000000");
    raised(ctx, 16, 64, 44, 44, 22, "#F8F8F8");
    raised(ctx, 274, 64, 44, 44, 22, "#F8F8F8");
    raised(ctx, 330, 64, 44, 44, 22, "#F8F8F8");
    raised(ctx, 7, 124, 376, 740, 28, "#F7F7F7", 20, 0.1);
    raised(ctx, 24, 140, 44, 44, 22, "#FDFDFD");
    stroke(ctx, s.ink, 2, () => {
      ctx.moveTo(49, 154);
      ctx.lineTo(41, 162);
      ctx.lineTo(49, 170);
    });
    ctx.fillStyle = s.ink;
    font(ctx, 600, 20);
    ctx.fillText("Plugins", 80, 169);
    raised(ctx, 24, 196, 276, 40, 20, "#FBFBFB", 6, 0.06);
    stroke(ctx, s.ink3, 1.8, () => {
      ctx.arc(47, 215, 6, 0, Math.PI * 2);
      ctx.moveTo(51.5, 219.5);
      ctx.lineTo(55.5, 223.5);
    });
    ctx.fillStyle = s.ink3;
    font(ctx, 400, 17);
    ctx.fillText("Search plugins", 70, 222);
    raised(ctx, 310, 194, 44, 44, 22, "#FBFBFB", 6, 0.06);
    ctx.fillStyle = "#9C9C9C";
    font(ctx, 400, 13);
    ctx.fillText("Installed", 26, 270);
    // cleared, first in the list.
    clearedTile(ctx, 26, 292, 40, 10, family);
    ctx.fillStyle = s.ink;
    font(ctx, 500, 17);
    ctx.fillText("cleared", 84, 309);
    ctx.fillStyle = s.ink2;
    font(ctx, 400, 15);
    ctx.fillText(state.caption, 84, 330);
    font(ctx, 500, 15);
    const added = ctx.measureText("Added").width + 44;
    const add = ctx.measureText("Add").width + 30;
    const pw = lerp(add, added, ease(on));
    box(ctx, 364 - pw, 297, pw, 30, 15, on > 0.5 ? "#E1F3EB" : "#ECECEC");
    ctx.fillStyle = on > 0.5 ? "#009957" : s.ink;
    ctx.textAlign = "right";
    ctx.fillText(on > 0.5 ? "Added" : "Add", 364 - 15, 317.5);
    ctx.textAlign = "left";
    if (on > 0.5) {
      stroke(ctx, "#009957", 1.9, () => {
        ctx.moveTo(364 - pw + 14, 312);
        ctx.lineTo(364 - pw + 18.5, 316.5);
        ctx.lineTo(364 - pw + 26, 307.5);
      });
    }
    // Other plugins, unnamed: this page names no one else's product.
    for (let i = 1; i < 4; i++) {
      const y = 284 + i * 82;
      box(ctx, 26, y + 8, 40, 40, 10, "#FFFFFF");
      stroke(ctx, "rgba(0, 0, 0, 0.08)", 0.5, () => ctx.roundRect(26, y + 8, 40, 40, 10));
      bar(ctx, 84, y + 14, 96 + i * 14, 10);
      bar(ctx, 84, y + 34, 168 - i * 12);
      box(ctx, 364 - add, y + 13, add, 30, 15, "#ECECEC");
      ctx.fillStyle = s.ink;
      font(ctx, 500, 15);
      ctx.textAlign = "right";
      ctx.fillText("Add", 364 - 15, y + 33.5);
      ctx.textAlign = "left";
    }
    homeBar(ctx, s.ink);
    return;
  }
  // Muse: the Connectors sheet.
  ctx.fillStyle = "#B4B5B7";
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  statusBar(ctx, "#000000");
  box(ctx, 0, 53, SCREEN.w, SCREEN.h, 38, "#F3F4F6");
  raised(ctx, 16, 66, 44, 44, 22, "#FFFFFF");
  stroke(ctx, s.ink, 2, () => {
    ctx.moveTo(41, 80);
    ctx.lineTo(33, 88);
    ctx.lineTo(41, 96);
  });
  ctx.fillStyle = s.ink;
  ctx.textAlign = "center";
  font(ctx, 600, 17);
  ctx.fillText("Connectors", 195, 94);
  ctx.textAlign = "left";
  box(ctx, 24, 136, 344, 46, 23, "#FFFFFF");
  stroke(ctx, s.ink2, 1.8, () => {
    ctx.arc(47, 158, 6, 0, Math.PI * 2);
    ctx.moveTo(51.5, 162.5);
    ctx.lineTo(55.5, 166.5);
  });
  ctx.fillStyle = s.ink3;
  font(ctx, 400, 17);
  ctx.fillText("Search connectors", 70, 165);
  const row = (y: number, draw: () => void, end: "chevron" | "connect") => {
    draw();
    if (end === "chevron") {
      stroke(ctx, s.ink3, 1.8, () => {
        ctx.moveTo(349, y + 21);
        ctx.lineTo(356, y + 28);
        ctx.lineTo(349, y + 35);
      });
    } else {
      ctx.fillStyle = "#0064D4";
      font(ctx, 500, 17);
      ctx.textAlign = "right";
      ctx.fillText("Connect", 358, y + 34);
      ctx.textAlign = "left";
    }
  };
  // "Connected" holds cleared once it is; until then it waits under "Available" with the app's own "Connect".
  const connected = on > 0.5;
  ctx.fillStyle = "#545559";
  font(ctx, 400, 15);
  ctx.fillText(connected ? "Connected" : "Available", 32, 220);
  box(ctx, 16, 232, 358, 68, 20, "#FFFFFF");
  row(238, () => {
    clearedTile(ctx, 28, 250, 32, 8, family);
    ctx.fillStyle = s.ink;
    font(ctx, 400, 17);
    ctx.fillText("cleared", 72, 262);
    ctx.fillStyle = s.ink2;
    font(ctx, 400, 15);
    ctx.fillText(state.caption, 72, 283);
  }, connected ? "chevron" : "connect");
  if (connected) {
    ctx.fillStyle = "#545559";
    font(ctx, 400, 15);
    ctx.fillText("Available", 32, 340);
  }
  const top = connected ? 352 : 320;
  box(ctx, 16, top, 358, 56 * 3, 20, "#FFFFFF");
  for (let i = 0; i < 3; i++) {
    const y = top + i * 56;
    row(y, () => {
      box(ctx, 28, y + 12, 32, 32, 8, "#F3F4F6");
      bar(ctx, 72, y + 23, 110 + i * 22, 10);
      if (i > 0) box(ctx, 72, y, 286, 0.5, 0, "rgba(0, 0, 0, 0.1)");
    }, "connect");
  }
  homeBar(ctx, s.ink);
}

/* ── The lock screen at night ────────────────────────────────────────────────────────────────────── */

export function clock(minutes: number): string {
  const m = Math.round(minutes);
  const hours = Math.floor(m / 60) % 12 || 12;
  return `${hours}:${String(m % 60).padStart(2, "0")}`;
}

function paintLock(ctx: Ctx, s: Skin, state: LockScreen, art: ScreenArt, z: number) {
  const { w, h } = SCREEN;
  const wake = clamp(state.wake);
  ctx.fillStyle = "#07060B";
  ctx.fillRect(0, 0, w, h);
  // The wallpaper's own light, low on the glass, once the screen wakes.
  if (wake > 0.01) {
    const g = ctx.createRadialGradient(w * 0.42, h * 1.06, 0, w * 0.42, h * 1.06, h * 0.7);
    g.addColorStop(0, `rgba(161, 98, 255, ${(0.3 * wake).toFixed(3)})`);
    g.addColorStop(0.5, `rgba(117, 122, 255, ${(0.09 * wake).toFixed(3)})`);
    g.addColorStop(1, "rgba(117, 122, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  const lit = lerp(0.4, 1, wake);
  ctx.globalAlpha = lit;
  statusBar(ctx, "#FFFFFF", false);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  font(ctx, 700, 98);
  ctx.fillText(clock(state.minutes), w / 2, 206);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  // One notification. From Grok Bot it comes from the Bot: its face as the sender's picture with the app's
  // small badge on it, and its name before the subject. Muse's is the app's own icon and the subject. Its type
  // grows with `zoom`, as the conversation's does, and the platter with it.
  const n = ease(clamp(state.notif));
  if (n > 0.01) {
    const x = 12;
    const y = 252 - (1 - n) * 20;
    const icon = 38 * Math.min(z, 1.25);
    const tx = x + 14 + icon + 12;
    // The sender and the time on one line; the subject on its own line under them; then the message.
    font(ctx, 600, 15 * z);
    const title = wrap(ctx, state.title, x + 366 - 16 - tx).slice(0, 2);
    font(ctx, 400, 15 * z);
    const lines = wrap(ctx, state.body, x + 366 - 16 - tx).slice(0, 3);
    const lineH = 20 * z;
    const height = 22 + 15 * z + (title.length + lines.length) * lineH + 8;
    ctx.globalAlpha = n;
    box(ctx, x, y, 366, height, 24, "rgba(245, 245, 245, 0.9)");
    if (s.id === "grok") {
      box(ctx, x + 14, y + 16, icon, icon, icon / 2, "#FFFFFF");
      blob(ctx, x + 14 + icon / 2, y + 16 + icon / 2, icon * 0.3, s.bot);
      const badge = icon * 0.42;
      box(ctx, x + 14 + icon - badge * 0.8 - 1, y + 16 + icon - badge * 0.8 - 1, badge + 2, badge + 2, badge * 0.3, "rgba(245, 245, 245, 1)");
      picture(ctx, art.grokIcon, x + 14 + icon - badge * 0.8, y + 16 + icon - badge * 0.8, badge, badge * 0.24, [470, 76, 517, 517]);
    } else picture(ctx, art.museIcon, x + 14, y + 16, icon, icon * 0.24);
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    font(ctx, 500, 14 * z);
    ctx.fillText(s.agent, tx, y + 18 + 12 * z);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    font(ctx, 400, 13 * z);
    ctx.fillText(state.ago, x + 350, y + 18 + 12 * z);
    ctx.textAlign = "left";
    ctx.fillStyle = "#000000";
    font(ctx, 600, 15 * z);
    title.forEach((line, i) => ctx.fillText(line, tx, y + 18 + 12 * z + (1 + i) * lineH));
    font(ctx, 400, 15 * z);
    lines.forEach((line, i) => ctx.fillText(line, tx, y + 18 + 12 * z + (1 + title.length + i) * lineH));
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = lit;
  homeBar(ctx, "#FFFFFF");
  ctx.globalAlpha = 1;
}

/* ── The painter ─────────────────────────────────────────────────────────────────────────────────── */

/** In the far picture a name is set large enough to read on the page, up to this size; smaller than that there is the mark alone. */
const FAR_NAME = 44;

/** The far picture's header: the agent's own mark, large, with its name where the name can be read. */
function farHeader(ctx: Ctx, s: Skin, art: ScreenArt, px: number) {
  const size = Math.min(FAR_NAME, 12.6 / px);
  const named = size * px >= 12;
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 46, SCREEN.w, (s.id === "grok" ? 116 : 146) - 46);
  if (s.id === "grok") {
    const r = named ? size * 0.56 : 24;
    font(ctx, 500, size);
    const name = named ? ctx.measureText(s.agent).width + r * 0.7 : 0;
    const h = r * 2 + 16;
    const w = r * 2 + name + 32;
    raised(ctx, SCREEN.w / 2 - w / 2, 84 - h / 2, w, h, h / 2, "#F8F8F8");
    blob(ctx, SCREEN.w / 2 - w / 2 + 16 + r, 84, r, s.bot);
    if (named) {
      ctx.fillStyle = "#141414";
      ctx.fillText(s.agent, SCREEN.w / 2 - w / 2 + 16 + r * 2 + r * 0.7, 84 + size * 0.35);
    }
    return;
  }
  const face = named ? 52 : 72;
  if (art.museAvatar) ctx.drawImage(art.museAvatar, SCREEN.w / 2 - face / 2, named ? 50 : 60, face, face);
  else box(ctx, SCREEN.w / 2 - face / 2, named ? 50 : 60, face, face, face / 2, "#E7DCCB");
  if (named) {
    const fit = Math.min(size, 38);
    ctx.fillStyle = s.ink;
    ctx.textAlign = "center";
    font(ctx, 600, fit);
    ctx.fillText(s.agent, SCREEN.w / 2, 106 + fit * 0.84);
    ctx.textAlign = "left";
  }
}

/**
 * Paints one state in the picture that suits its size on the page (`pictureOf`). In the far picture every run
 * of type that would come out under 12 px on the page is drawn as a plain bar (whatever is large enough to
 * read, such as the lock screen's clock, stays type), and the header becomes the agent's mark, large.
 */
function paintOne(ctx: Ctx, app: AppId, state: ScreenState, art: ScreenArt, family: string, px: number) {
  const skin = SKINS[app];
  const picture = pictureOf(px);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 1;
  const paint = () => {
    if (state.kind === "chat") paintChat(ctx, skin, state, art, family, picture.kind === "far" ? { ...picture, kind: "near" } : picture);
    else if (state.kind === "connectors") paintConnectors(ctx, skin, state, family);
    else paintLock(ctx, skin, state, art, clamp(12.6 / (13 * px), 1, 1.6));
  };
  if (picture.kind !== "far") return paint();
  const base = ctx.getTransform().a;
  const type = ctx.fillText;
  ctx.fillText = function (this: Ctx, text: string, x: number, y: number) {
    const zoom = this.getTransform().a / base;
    const size = parseFloat(/([\d.]+)px/.exec(this.font)?.[1] ?? "17");
    if (size * zoom * px >= 12) return type.call(this, text, x, y);
    const w = this.measureText(text).width;
    const left = this.textAlign === "center" ? x - w / 2 : this.textAlign === "right" ? x - w : x;
    const alpha = this.globalAlpha;
    this.globalAlpha = alpha * 0.24;
    this.beginPath();
    this.roundRect(left, y - size * 0.54, w, size * 0.44, size * 0.22);
    this.fill();
    this.globalAlpha = alpha;
  };
  try {
    paint();
    if (state.kind === "chat") farHeader(ctx, skin, art, px);
  } finally {
    // Back to the canvas's own method.
    delete (ctx as { fillText?: unknown }).fillText;
  }
}

export type Shown = { app: AppId; state: ScreenState };

/**
 * Paints one screen. `width` and `height` are the canvas's own pixels; `px` is how many page pixels one of the
 * screen's points is drawn at (it chooses the picture); `dx` slides the whole screen sideways, in screen
 * widths, for the one move a phone makes from a screen to the next (phone.ts): two screens are then seen
 * side by side for a moment, never one over the other.
 */
/**
 * What the last screen painted measured, for the stage and the checks: whether anything ran past its bubble,
 * card or the screen's edge (`overflow`); whether a turn of the conversation was cut by the header or the
 * composer (`sliced`); and where the conversation ends, as a share of the screen's height from its top (`bottom`;
 * 1 for a screen that is not a chat), so the phone can be cropped to it.
 */
export const painted = { overflow: false, sliced: false, bottom: 1 };
/** Text set in a box of fixed width: a little smaller where it must (never under `least`), and reported if it still does not fit. */
function fits(ctx: Ctx, text: string, max: number, weight: number, size: number, least = 13) {
  font(ctx, weight, size);
  const w = ctx.measureText(text).width;
  const set = w > max ? Math.max(least, (size * max) / w) : size;
  font(ctx, weight, set);
  if (ctx.measureText(text).width > max + 1) painted.overflow = true;
}

export function paintScreen(ctx: Ctx, width: number, height: number, family: string, art: ScreenArt, shown: Shown, px = 1, dx = 0) {
  painted.overflow = false;
  painted.sliced = false;
  painted.bottom = 1;
  ctx.save();
  ctx.setTransform(width / SCREEN.w, 0, 0, height / SCREEN.h, dx * width, 0);
  paintOne(ctx, shown.app, shown.state, art, family, px);
  ctx.restore();
}

/** A string that changes exactly when one screen's picture does: the texture is only re-painted then. */
export function screenKey({ app, state }: Shown, px = 1): string {
  const picture = pictureOf(px);
  return `${app}${picture.kind}${picture.by}${picture.kind === "far" ? px.toFixed(2) : ""}${JSON.stringify(state, (_, value) => (typeof value === "number" ? Math.round(value * 1000) / 1000 : value))}`;
}

/** Which screen a state is, whichever moment of it: the phone slides when this changes. */
export const screenId = ({ app, state }: Shown) => `${app}:${state.id}`;

/** Loads the pictures the skins use. `done` is called as each arrives, so the screen can be painted again. */
export function loadScreenArt(urls: { grokIcon: string; museIcon: string; museAvatar: string }, done: () => void): ScreenArt {
  const art: ScreenArt = {};
  for (const key of ["grokIcon", "museIcon", "museAvatar"] as const) {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      art[key] = image;
      done();
    };
    image.src = urls[key];
  }
  return art;
}
