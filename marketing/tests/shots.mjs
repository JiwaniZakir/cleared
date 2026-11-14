// Shoots the page at chosen scroll positions, and counts the words on each screen.
//
//   pnpm build && pnpm start -p 3310
//   node tests/shots.mjs http://localhost:3310 <out-dir> --gpu
//   node tests/shots.mjs http://localhost:3310 <out-dir> --gpu --views=desktop --at=hero@0,show@1.3,show@4.4,start@0
//   node tests/shots.mjs http://localhost:3310 <out-dir> --gpu --card=3
//
// `--gpu`: Chromium uses this machine's real GPU and loads the page as a visitor would. Review the look from
// these frames. Without it the software renderer is used and the stage is forced on (`?3d=force`): fine for
// checking layout anywhere, wrong for material and light.
//
// `--at` takes moments as `chapter@t`. A chapter is a `[data-chapter]` section, and t is in viewport heights
// from the moment its top reaches the top of the viewport (negative while it is still arriving). For the
// show that is the director's own clock: the bridge whole from 0 to 1.5, the five stations from 1.5 to 5.2
// (they start at 1.5, 2.2, 2.9, 3.5 and 4.2), the night from 5.2 to 7.2. Without `--at`, the default set
// below is shot: the frames to review the page from.
//
// `page@t` is a place on the whole page instead: t viewport heights down from its top.
//
// `--standard` shoots the standard set to review the page from, at both sizes: a frame every quarter screen down the
// whole page (`page-…`), twelve a screen through the pinned show (`show-…`), the hero with the switch thrown to
// Muse, card 02 closed, opening, open, paged and closed, and the page as a visitor who asks for reduced motion
// gets it (`reduced-…`). It takes a quarter of an hour.
//
// `--dpr=3 --clip=880,330,400,360` shoots one part of the viewport enlarged: for looking at a model's material up close.
// `--app=muse` shoots the page in Muse (the default is Grok Bot); the app is fixed by the address (`?app=`), so
// the rolling name holds still. `--roll` leaves it rolling. `--page=/screens` shoots another route, whole.
// `--card=<n>` also shoots advantage n's card (1 to 6) closed, opening, open, paged on and closed again.
// `--still` shoots the page without the live stage (`?3d=off`) as slices, top to bottom.
// Views: desktop (1440 x 900), mobile (390 x 844, device pixel ratio 2), laptop (1280 x 720), tablet (1024 x 768).
//
// It prints only the name of each file it writes. `--words` also prints the words on screen in each frame (and
// writes them to words.json); `--verbose` prints what it measured on the way (sizes, type, bytes, the sheet).
// A console error, CSP violation or failed or outside request is printed (to stderr) whatever the flags, and
// makes it exit with 1.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base, outDir, ...flags] = process.argv.slice(2);
if (!base || !outDir) {
  console.error("usage: node tests/shots.mjs <base-url> <out-dir> [--gpu] [--views=desktop,mobile] [--at=hero@0,bridge@0.5] [--card=nights] [--still] [--wait=900]");
  process.exit(1);
}
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const gpu = flags.includes("--gpu");
const still = flags.includes("--still");
const only = flag("views")?.split(",");
const wait = Number(flag("wait") ?? 900);
const standard = flags.includes("--standard");
const wordsOut = flags.includes("--words");
const verbose = flags.includes("--verbose");
/** Only with `--verbose`. */
const note = (...args) => {
  if (verbose) console.log(...args);
};
const card = flag("card") ?? (standard ? "2" : undefined);
/** How long the page is given to settle at each new place before the frame is taken (words arrive on their own clock). */
const settle = Number(flag("settle") ?? (standard ? 1000 : 1700));
const dprFlag = flag("dpr") ? Number(flag("dpr")) : null;
const app = flags.includes("--roll") ? null : (flag("app") ?? "grok"); // fixed by the address, unless left rolling
const other = flag("page"); // another route, shot whole: --page=/screens
const clip = flag("clip")?.split(",").map(Number);
const DEFAULT = ["hero@0", "show@-0.45", "show@0.3", "show@0.55", "show@0.95", "show@1.3", "show@1.5", "show@1.95", "show@2.65", "show@3.1", "show@3.75", "show@4.6", "show@4.95", "show@5.45", "show@6.0", "show@6.6", "show@7.1", "start@0", "start@0.7"];
const moments = (flag("at")?.split(",") ?? DEFAULT).map((token) => {
  const [id, t] = token.split("@");
  return { id, t: Number(t ?? 0) };
});
mkdirSync(outDir, { recursive: true });

const VIEWS = [
  ["desktop", { width: 1440, height: 900 }, 1],
  ["mobile", { width: 390, height: 844 }, 2],
  ["laptop", { width: 1280, height: 720 }, 1],
  ["tablet", { width: 1024, height: 768 }, 1],
].filter(([name]) => (only ? only.includes(name) : name === "desktop" || name === "mobile"));

const browser = await chromium.launch({ args: gpu ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const problems = [];
const report = [];

/** The words a visitor can see in the viewport right now: real text only, nothing hidden, nothing off screen. */
const countWords = () => {
  const words = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const el = node.parentElement;
    // Counted as seen, whether or not a screen reader is given it (the bridge's labels are described in one sentence instead).
    if (!text || !el || el.closest(".sr, script, style, canvas")) continue;
    if (el.closest(".token__both") && getComputedStyle(el.closest(".token__both")).position === "absolute") continue;
    if (el.closest("dialog:not([open])")) continue;
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden") { opacity = 0; break; }
      opacity *= Number(cs.opacity);
    }
    if (opacity < 0.1) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.bottom < 4 || r.top > innerHeight - 4 || r.right < 0 || r.left > innerWidth) continue;
    words.push(...text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)));
  }
  return words;
};

for (const [name, viewport, dpr] of VIEWS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dprFlag ?? dpr, hasTouch: name === "mobile", isMobile: name === "mobile" });
  const page = await context.newPage();
  if (other) {
    await page.goto(base + other + (app ? `?app=${app}` : ""), { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${outDir}/${name}-page-${other.replace(/[^a-z0-9]+/gi, "") || "home"}.png`, fullPage: true });
    console.log(`${name}-page-${other.replace(/[^a-z0-9]+/gi, "") || "home"}.png`);
    await context.close();
    continue;
  }
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy|Refused to/i.test(m.text())) problems.push(`${name}: ${m.text().slice(0, 240)}`);
  });
  page.on("pageerror", (e) => problems.push(`${name}: pageerror ${String(e).slice(0, 240)}`));
  page.on("requestfailed", (r) => problems.push(`${name}: request failed ${r.url().slice(0, 160)}`));
  page.on("request", (r) => {
    if (!r.url().startsWith(base) && !/^(data|blob):/.test(r.url())) problems.push(`${name}: third-party request ${r.url().slice(0, 160)}`);
  });

  // What the visit weighs: bytes on the wire, counted to the end of the view's frames.
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  let transferred = 0;
  client.on("Network.loadingFinished", (e) => (transferred += e.encodedDataLength));

  const query = [still ? "3d=off" : gpu ? "" : "3d=force", app ? `app=${app}` : ""].filter(Boolean).join("&");
  await page.goto(base + "/" + (query ? `?${query}` : ""), { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  const info = await page.evaluate(() => ({
    mode: document.documentElement.dataset.mode,
    canvases: document.querySelectorAll(".stage canvas").length,
    height: document.documentElement.scrollHeight,
    screens: +(document.documentElement.scrollHeight / innerHeight).toFixed(2),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  note(name, JSON.stringify(info));
  const type = await page.evaluate(() =>
    [[".display", "display"], [".headline", "headline"], [".title", "card title"], [".lead", "lead"], [".body", "body"], [".label", "capitals"], [".label--pool", "the companies' label"], [".chip", "source chip"], [".btn--md", "header button"], [".btn--lg", "page button"]]
      .map(([selector, what]) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return `${what} ${cs.fontSize}/${cs.lineHeight} w${cs.fontWeight} ${cs.letterSpacing}${cs.fontStretch !== "100%" ? ` stretch ${cs.fontStretch}` : ""}`;
      })
      .filter(Boolean)
      .join(" · "),
  );
  note(`${name} type: ${type}`);
  if (info.overflowX > 0) problems.push(`${name}: horizontal overflow of ${info.overflowX}px`);

  const shoot = async (label) => {
    await page.screenshot({ path: `${outDir}/${name}-${label}.png`, ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : {}) });
    console.log(`${name}-${label}.png`);
    const words = await page.evaluate(countWords);
    report.push({ view: name, frame: label, words: words.length, text: words.join(" ") });
  };

  if (still) {
    const slices = Math.ceil(info.height / viewport.height);
    for (let i = 0; i < slices; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * viewport.height);
      await page.waitForTimeout(400);
      await shoot(`still-${String(i).padStart(2, "0")}`);
    }
    await context.close();
    continue;
  }

  const goTo = async ({ id, t }) =>
    page.evaluate(
      ({ id, t }) => {
        if (id === "page") {
          window.scrollTo(0, t * innerHeight);
          return true;
        }
        const el = document.querySelector(`[data-chapter="${id}"]`);
        if (!el) return false;
        const pin = el.querySelector("[data-pin]");
        const top = el.getBoundingClientRect().top + scrollY;
        window.scrollTo(0, Math.max(0, top + t * (pin ? pin.offsetHeight : innerHeight)));
        return true;
      },
      { id, t },
    );

  // The standard set: every quarter screen down the page, then twelve a screen through the pinned show.
  const list = standard
    ? [
        ...Array.from({ length: Math.floor((info.screens - 1) * 4) + 1 }, (_, i) => ({ id: "page", t: i / 4 })),
        ...Array.from({ length: Math.round(7.2 * 12) + 1 }, (_, i) => ({ id: "show", t: Math.round((i / 12) * 1000) / 1000 })),
      ]
    : moments;
  for (const [n, moment] of list.entries()) {
    if (!(await goTo(moment))) {
      problems.push(`${name}: no chapter "${moment.id}"`);
      continue;
    }
    // The words arrive on their own clock (1.4 s and a stagger): let them land before the frame is taken.
    await page.waitForTimeout(n === 0 ? wait : wait + settle);
    await shoot(standard ? `${moment.id}-${moment.t.toFixed(3).padStart(6, "0")}` : `${String(n + 1).padStart(2, "0")}-${moment.id}@${moment.t}`);
  }
  if (standard) {
    // The switch, thrown to the other app: the headline, the switch and the phone turn together.
    await goTo({ id: "page", t: 0 });
    await page.waitForTimeout(wait);
    await page.locator('.hero .switch__option[aria-checked="false"]').click();
    await page.waitForTimeout(3200);
    await shoot("switch-thrown");
    await page.locator('.hero .switch__option[aria-checked="false"]').click();
    await page.waitForTimeout(3200);
  }

  note(`${name} transferred over the whole scroll: ${(transferred / 1024).toFixed(0)} KB`);

  if (card) {
    const n = Number(card);
    const starts = [1.5, 2.2, 2.9, 3.5, 4.2, 5.2, 7.2];
    await goTo({ id: "show", t: starts[n - 1] + (starts[n] - starts[n - 1]) * 0.8 });
    await page.waitForTimeout(wait + 1700);
    await shoot(`card-${n}-1-closed`);
    await page.locator(`[data-card="${n - 1}"]`).click();
    await page.waitForTimeout(170);
    await shoot(`card-${n}-2-opening`);
    await page.waitForTimeout(1100);
    await shoot(`card-${n}-3-open`);
    const state = await page.evaluate(() => ({
      focusIn: !!document.activeElement?.closest("dialog[open]"),
      focused: document.activeElement?.id || document.activeElement?.tagName,
      pageLocked: getComputedStyle(document.documentElement).overflowY,
      sheet: (() => { const r = document.querySelector("dialog[open] .sheet")?.getBoundingClientRect(); return r ? `${Math.round(r.width)} x ${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}` : "none"; })(),
    }));
    note(`${name} card open: ${JSON.stringify(state)}`);
    await page.locator("dialog[open] .pager button").last().click();
    await page.waitForTimeout(500);
    await shoot(`card-${n}-4-paged`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => ({ open: !!document.querySelector("dialog[open]"), focusBack: document.activeElement?.getAttribute("data-card") }));
    note(`${name} card after Escape: ${JSON.stringify(after)}`);
    await shoot(`card-${n}-5-after-escape`);
  }
  await context.close();

  if (standard) {
    // The page as a visitor who asks for reduced motion gets it: nothing pinned, nothing moving, top to bottom.
    const calm = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: name === "mobile", isMobile: name === "mobile", reducedMotion: "reduce" });
    const still = await calm.newPage();
    await still.goto(base + "/", { waitUntil: "networkidle" });
    await still.waitForTimeout(1500);
    const height = await still.evaluate(() => document.documentElement.scrollHeight);
    for (let i = 0; i * viewport.height < height; i++) {
      await still.evaluate((y) => window.scrollTo(0, y), i * viewport.height);
      await still.waitForTimeout(400);
      await still.screenshot({ path: `${outDir}/${name}-reduced-${String(i).padStart(2, "0")}.png` });
      console.log(`${name}-reduced-${String(i).padStart(2, "0")}.png`);
    }
    await calm.close();
  }
}

await browser.close();
if (wordsOut) {
  writeFileSync(`${outDir}/words.json`, JSON.stringify(report, null, 2));
  console.log("\nwords on screen, per frame:");
  for (const r of report) console.log(`  ${r.view} ${r.frame}: ${r.words}  ${r.text.slice(0, 150)}`);
}
if (problems.length) console.error("\nPROBLEMS:\n" + [...new Set(problems)].join("\n"));
else note("\nno console errors, CSP violations, failed or third-party requests");
process.exitCode = problems.length ? 1 : 0;
