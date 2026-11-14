// Checks the rules that keep every held frame clean, at every twelfth of a screen down the whole page, at
// both sizes, after the page has settled:
//
//   a. no two visible runs of the page's text intersect, and the header has a ground (nothing is read through it);
//   b. the stage is settled: the phone is not between two screens, the night is not half-way, the pane that
//      crosses the lens between stops is not in the picture;
//   c. the phone's screen is never the wordless picture, and the companies' tiles carry their marks or none
//      (never a half-faded mark, never a tile shown with its mark missing);
//   d. no visible text is under 12 px: the page's own, and the type on the phone's screen as it stands on the page;
//   e. down a narrow window no card stands over the phone's top (its status bar and first lines), and nothing on
//      the phone's screen runs past its bubble or the screen's edge;
//   f. no text is cut by the screen's side edges, and nothing in the pinned show stands half under the header;
//   g. no chip stands outside the box it belongs to;
//   h. no piece of the set (a pane, its tick, a role, the plinth, a tile, a tile's tick) stands on the phone's
//      silhouette: over its screen, or peeking from behind it (the stage's own report, `over`);
//   i. down a narrow window, no frame has more than a third of the window below the header empty: a band of
//      rows with nothing on them but the ground (read off the frame's own pixels);
//   j. no turn of the conversation on the phone's screen is cut part-way by its header or its composer.
//   k. none of the page's own words stand on the phone, at rest or on its way between two places.
//
//   pnpm build && pnpm start -p 3310
//   node tests/overlap.mjs http://localhost:3310 [--views=desktop,mobile] [--app=muse] [--step=12] [--from=0] [--to=99]
//
// What it reads from the stage is `window.__stage` (components/stage/stage.ts).
import { chromium } from "@playwright/test";

const [base, ...flags] = process.argv.slice(2);
if (!base) {
  console.error("usage: node tests/overlap.mjs <base-url> [--views=desktop,mobile] [--app=muse] [--step=12] [--from=0] [--to=99]");
  process.exit(1);
}
const flag = (name, fallback) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const only = flag("views")?.split(",");
const app = flag("app", "grok");
const step = Number(flag("step", 12));
const from = Number(flag("from", 0));
const to = Number(flag("to", 99));
const VIEWS = [
  ["desktop", { width: 1440, height: 900 }, 1],
  ["mobile", { width: 390, height: 844 }, 2],
].filter(([name]) => !only || only.includes(name));

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const failures = [];
let frames = 0;

/** Every visible run of the page's text in the viewport: its box (a line at a time), its size, and a few of its words. */
const readText = () => {
  const runs = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    const text = node.textContent;
    if (!text.trim() || !el || el.closest(".sr, script, style, dialog:not([open])")) continue;
    const spoken = el.closest(".token__both");
    if (spoken && getComputedStyle(spoken).position === "absolute") continue;
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") { opacity = 0; break; }
      opacity *= Number(cs.opacity);
    }
    // Text that is arriving or leaving is not a held frame's text.
    if (opacity < 0.9) continue;
    const range = document.createRange();
    const lead = text.length - text.trimStart().length;
    range.setStart(node, lead);
    range.setEnd(node, text.trimEnd().length);
    const size = parseFloat(getComputedStyle(el).fontSize);
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.bottom < 2 || r.top > innerHeight - 2 || r.right < 2 || r.left > innerWidth - 2) continue;
      // Covered by something else (the header's ground, a card): not seen, so not in the frame.
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
      if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
      // The type's own box is taller than its letters: the middle 70% is what can collide.
      // (Text of the page already passing under the header's ground is covered there, as on any page.)
      const headerBottom = document.querySelector("[data-header]")?.offsetHeight ?? 0;
      const under = !el.closest("[data-header]") && r.top < headerBottom - 1;
      runs.push({ x: r.left, y: r.top + r.height * 0.15, w: r.width, h: r.height * 0.7, top: r.top, bottom: r.bottom, size, text: text.trim().slice(0, 28), huge: !!el.closest(".footer__mark"), pinned: !!el.closest("[data-pin]"), under, card: !!el.closest(".card"), header: !!el.closest("[data-header]") });
    }
  }
  return runs;
};

for (const [name, viewport, dpr] of VIEWS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: name === "mobile", isMobile: name === "mobile" });
  const page = await context.newPage();
  await page.goto(`${base}/?app=${app}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3200);
  const info = await page.evaluate(() => ({
    screens: document.documentElement.scrollHeight / innerHeight,
    mode: document.documentElement.dataset.mode,
    ground: (() => {
      const header = document.querySelector("[data-header]");
      return header ? getComputedStyle(header, "::before").backgroundColor : "none";
    })(),
  }));
  const fail = (at, rule, detail) => failures.push(`${name} page@${at.toFixed(3)} (${rule}) ${detail}`);
  if (!/^rgb\(/.test(info.ground)) failures.push(`${name} (a) the header has no opaque ground: ${info.ground}`);
  const last = Math.min(to, info.screens - 1);
  for (let k = Math.round(from * step); k / step <= last + 1e-6; k++) {
    const at = k / step;
    await page.evaluate((t) => window.scrollTo(0, t * innerHeight), at);
    // The words arrive on their own clock, and the stage's own moves take up to about a second: wait them out.
    await page.waitForTimeout(1250);
    let stage = null;
    for (let i = 0; i < 12; i++) {
      stage = await page.evaluate(() => (window.__stage ? JSON.parse(JSON.stringify(window.__stage)) : null));
      if (!stage || stage.settled) break;
      await page.waitForTimeout(150);
    }
    frames++;
    if (info.mode === "3d") {
      if (!stage) fail(at, "b", "the stage reports nothing");
      else {
        if (!stage.settled) fail(at, "b", `not settled: ${JSON.stringify(stage.blends ?? stage.screen)}`);
        if (stage.phone?.onScreen !== false) {
          if (stage.screen.picture === "far") fail(at, "c", `the phone's screen (${stage.screen.id}) has bars for words`);
          else if (stage.screen.type < 11.5) fail(at, "d", `the phone's type is ${stage.screen.type.toFixed(1)} px on the page (${stage.screen.id}, ${stage.screen.picture})`);
        }
        if (stage.tiles.marks > 0.02 && stage.tiles.marks < 0.98) fail(at, "c", `the tiles' marks are half-faded (${stage.tiles.marks.toFixed(2)})`);
        if (stage.tiles.marks >= 0.98 && !stage.tiles.ready) fail(at, "c", "the tiles are shown with a mark missing");
      }
    }
    const runs = await page.evaluate(readText);
    for (const run of runs) if (run.size < 11.95 && !run.huge) fail(at, "d", `"${run.text}" is ${run.size} px`);
    // f. Cut by the screen's side edges; or, in the pinned show, half under the header.
    // (Only while the show is pinned: what scrolls with the page passes under the header as any page does.)
    const { headerBottom, pinned } = await page.evaluate(() => {
      const pin = document.querySelector("[data-pin]")?.getBoundingClientRect();
      return { headerBottom: document.querySelector("[data-header]")?.offsetHeight ?? 0, pinned: !!pin && Math.abs(pin.top) < 1 && Math.abs(pin.bottom - innerHeight) < 2 };
    });
    for (const run of runs) {
      if (run.huge) continue;
      if (run.x < -1 || run.x + run.w > viewport.width + 1) fail(at, "f", `"${run.text}" is cut by the screen's edge`);
      if (pinned && run.pinned && run.top < headerBottom - 1 && run.bottom > headerBottom + 1) fail(at, "f", `"${run.text}" stands half under the header`);
    }
    // e. Down a narrow window, a card over the phone's top.
    if (info.mode === "3d" && name === "mobile" && stage?.phone?.onScreen) {
      const band = { top: stage.phone.top, bottom: stage.phone.top + 150, left: stage.phone.left, right: stage.phone.right };
      const over = await page.evaluate((band) => {
        for (const card of document.querySelectorAll(".card")) {
          let opacity = 1;
          for (let e = card; e; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.display === "none" || cs.visibility === "hidden") opacity = 0;
            opacity *= Number(cs.opacity);
          }
          if (opacity < 0.9) continue;
          const r = card.getBoundingClientRect();
          if (r.bottom > band.top + 2 && r.top < band.bottom && r.right > band.left && r.left < band.right) return card.querySelector("h3")?.textContent?.slice(0, 30) ?? "a card";
        }
        return null;
      }, band);
      if (over && band.top < viewport.height - 40) fail(at, "e", `"${over}" stands over the phone's top`);
    }
    if (info.mode === "3d" && stage?.phone?.onScreen && stage.screen.overflow) fail(at, "e", `something on the phone's screen (${stage.screen.id}) runs past its bubble, card or the screen's edge`);
    // j. A turn of the conversation cut by the phone's header or composer (it shows whole turns only).
    if (info.mode === "3d" && stage?.phone?.onScreen && stage.screen.sliced) fail(at, "j", `a turn of the conversation on the phone's screen (${stage.screen.id}) is cut by its header or composer`);
    // k. None of the page's own words stand on the phone (as far as its crop), on its way from one place to the
    //    next as much as at rest. (Words on a card stand on the card, which covers the phone: rule e.)
    if (info.mode === "3d" && stage?.phone?.onScreen) {
      const p = stage.phone;
      for (const run of runs) {
        if (run.huge || run.under || run.card || run.header) continue;
        if (run.x < p.right - 2 && run.x + run.w > p.left + 2 && run.y < p.bottom - 2 && run.y + run.h > p.top + 2) fail(at, "k", `"${run.text}" stands on the phone`);
      }
    }
    // g. A chip outside its box.
    const chips = await page.evaluate(() =>
      [...document.querySelectorAll(".chip")]
        .filter((chip) => {
          const r = chip.getBoundingClientRect();
          if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
          let opacity = 1;
          for (let e = chip; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
          if (opacity < 0.9) return false;
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .map((chip) => chip.textContent.trim()),
    );
    for (const chip of chips) fail(at, "g", `the chip "${chip}" stands outside the screen`);
    // h. A piece of the set on the phone.
    if (info.mode === "3d" && stage?.over?.length) fail(at, "h", `${stage.over.join(", ")} on the phone's silhouette`);
    // i. Down a narrow window, a band of the window with nothing in it.
    if (info.mode === "3d" && name === "mobile") {
      const shot = (await page.screenshot({ type: "png" })).toString("base64");
      const empty = await page.evaluate(async ({ shot, header }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${shot}`;
        await image.decode();
        // A quarter of the window's width: each row's own commonest colour is its ground, and a row is empty when
        // fewer than 4 of its points differ from it (a hairline, a star or a phone's edge is something; a gradient is not).
        const w = Math.round(innerWidth / 4);
        const h = Math.round(innerHeight / 4);
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const top = Math.ceil(header / 4);
        let run = 0;
        let longest = 0;
        for (let y = top; y < h; y++) {
          const counts = new Map();
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          const ground = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
          const [gr, gg, gb] = [((ground >> 8) & 15) * 16 + 8, ((ground >> 4) & 15) * 16 + 8, (ground & 15) * 16 + 8];
          let busy = 0;
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (Math.abs(data[i] - gr) + Math.abs(data[i + 1] - gg) + Math.abs(data[i + 2] - gb) > 36) busy++;
          }
          run = busy < 4 ? run + 1 : 0;
          longest = Math.max(longest, run);
        }
        return (longest * 4) / (innerHeight - header);
      }, { shot, header: headerBottom });
      if (empty > 1 / 3) fail(at, "i", `${Math.round(empty * 100)}% of the window under the header is one empty band`);
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        const a = runs[i];
        const b = runs[j];
        if (a.huge || b.huge || a.under || b.under) continue;
        const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        if (w > 3 && h > 3) fail(at, "a", `"${a.text}" and "${b.text}" intersect by ${Math.round(w)} x ${Math.round(h)} px`);
      }
    }
  }
  await context.close();
}

await browser.close();
const unique = [...new Set(failures)];
console.log(`${frames} frames checked.`);
console.log(unique.length ? `${unique.length} failures:\n${unique.slice(0, 300).join("\n")}${unique.length > 300 ? `\n… and ${unique.length - 300} more` : ""}` : "every held frame is clean");
process.exit(unique.length ? 1 : 0);
