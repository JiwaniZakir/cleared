// Measures every piece of text on screen against the worst pixel actually behind it, on the real GPU.
// The rule: 4.5:1 for text, 3:1 for the large headlines (24 px and up, or 18.66 px and heavy),
// including on the dark chapter, over the prism and while the page is turning from one ground to the other.
//
//   pnpm build && pnpm start -p 3310
//   node tests/contrast.mjs http://localhost:3310 [--views=desktop,mobile] [--at=hero@0,show@5.8] [--app=muse]
//
// How: at each moment the page is shot twice, once as it is and once with every glyph made transparent.
// The second picture is what is behind the text. Each run of text is then compared, in its own colour,
// with the pixel in its box that gives the lowest contrast. A word set in a gradient is tested with the
// gradient's weakest stop. Moments are `chapter@t` as in tests/shots.mjs; the default set walks the turn
// to night and back in small steps, because that is where a fixed header or a pinned line can be caught
// over the wrong ground.
import { chromium } from "@playwright/test";

const [base, ...flags] = process.argv.slice(2);
if (!base) {
  console.error("usage: node tests/contrast.mjs <base-url> [--views=desktop,mobile] [--at=hero@0,...]");
  process.exit(1);
}
const flag = (name) => flags.find((f) => f.startsWith(`--${name}=`))?.slice(name.length + 3);
const only = flag("views")?.split(",");
const sweep = (id, from, to, step) => Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => `${id}@${(from + i * step).toFixed(2)}`);
// The hero, the bridge whole, each stop, the turn to night step by step, the night, the turn back, the start.
const DEFAULT = ["hero@0", "show@0.95", "show@1.3", "show@2.05", "show@2.65", "show@3.3", "show@4.0", "show@4.95", ...sweep("show", 5.2, 5.6, 0.05), "show@6.2", "show@6.8", ...sweep("show", 6.9, 7.2, 0.05), "start@0", "start@0.7"];
const moments = (flag("at")?.split(",") ?? DEFAULT).map((token) => {
  const [id, t] = token.split("@");
  return { id, t: Number(t ?? 0) };
});
const VIEWS = [
  ["desktop", { width: 1440, height: 900 }, 1],
  ["mobile", { width: 390, height: 844 }, 2],
].filter(([name]) => !only || only.includes(name));

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const decoder = await browser.newPage();
/** Decodes a PNG in a spare page and keeps its pixels there for sampling. */
const load = async (png) =>
  decoder.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    globalThis.shot = ctx;
    return [bitmap.width, bitmap.height];
  }, png.toString("base64"));

let lowest = { ratio: Infinity };
const failures = [];
let runs = 0;

for (const [name, viewport, dpr] of VIEWS) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: dpr });
  await page.goto(base + "/?app=" + (flag("app") ?? "grok"), { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  for (const moment of moments) {
    await page.evaluate(({ id, t }) => {
      const el = document.querySelector(`[data-chapter="${id}"]`);
      const pin = el.querySelector("[data-pin]");
      window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + scrollY + t * (pin ? pin.offsetHeight : innerHeight)));
    }, moment);
    await page.waitForTimeout(2300);

    // Every run of visible text, with its colour and box.
    const texts = await page.evaluate(() => {
      const found = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!node.textContent.trim() || !el || el.closest(".sr, script, style, dialog:not([open])")) continue;
        // The rolling name's spoken form is read, not seen, while the name rolls.
        const spoken = el.closest(".token__both");
        if (spoken && getComputedStyle(spoken).position === "absolute") continue;
        let opacity = 1;
        for (let e = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === "none" || cs.visibility === "hidden") { opacity = 0; break; }
          opacity *= Number(cs.opacity);
        }
        // Text that is fading in or out is not being read yet: it is measured once it is there.
        if (opacity < 0.9) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const cs = getComputedStyle(el);
        const gradient = cs.backgroundClip === "text" ? cs.backgroundImage.match(/rgba?\([^)]+\)/g) : null;
        for (const r of range.getClientRects()) {
          if (r.width < 2 || r.bottom < 1 || r.top > innerHeight - 1) continue;
          // Text that something else covers (a line passing under the header's button) cannot be read at all: skip it.
          const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
          if (top && top !== el && !el.contains(top) && !top.contains(el)) continue;
          found.push({ text: node.textContent.trim().slice(0, 40), colours: gradient ?? [cs.color], size: parseFloat(cs.fontSize), weight: Number(cs.fontVariationSettings.match(/"wght" (\d+)/)?.[1] ?? cs.fontWeight), x: r.left, y: Math.max(0, r.top), w: r.width, h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top) });
        }
      }
      return found;
    });
    const style = await page.addStyleTag({ content: "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } .prism-word { background: none !important; } .token__mark { visibility: hidden !important; } svg { visibility: hidden !important; }" });
    await page.waitForTimeout(350);
    await load(await page.screenshot());
    await style.evaluate((el) => el.remove());

    const results = await decoder.evaluate(
      ({ texts, dpr }) => {
        const lum = (r, g, b) => {
          const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        return texts.map((t) => {
          const x = Math.round(t.x * dpr);
          const y = Math.round(t.y * dpr);
          const w = Math.max(1, Math.round(t.w * dpr));
          const h = Math.max(1, Math.round(t.h * dpr));
          const data = globalThis.shot.getImageData(x, y, w, h).data;
          let worst = Infinity;
          let behind = "";
          for (const colour of t.colours) {
            const [r, g, b, a = 1] = colour.match(/[\d.]+/g).map(Number);
            for (let i = 0; i < data.length; i += 4) {
              // The text's own colour, laid over this pixel at its own alpha.
              const fr = r * a + data[i] * (1 - a);
              const fg = g * a + data[i + 1] * (1 - a);
              const fb = b * a + data[i + 2] * (1 - a);
              const l1 = lum(fr, fg, fb);
              const l2 = lum(data[i], data[i + 1], data[i + 2]);
              const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
              if (ratio < worst) {
                worst = ratio;
                behind = `rgb(${data[i]} ${data[i + 1]} ${data[i + 2]})`;
              }
            }
          }
          return { ...t, ratio: worst, behind };
        });
      },
      { texts, dpr },
    );
    for (const r of results) {
      runs++;
      const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 600);
      const need = large ? 3 : 4.5;
      const where = `${name} ${moment.id}@${moment.t}`;
      if (r.ratio < lowest.ratio) lowest = { ...r, where };
      if (r.ratio < need) failures.push(`${where}: "${r.text}" ${r.size}px is ${r.ratio.toFixed(2)}:1 (needs ${need}) in ${r.colours[0]} over ${r.behind}`);
    }
  }
  await page.close();
}

await browser.close();
console.log(`${runs} runs of text measured. Lowest: ${lowest.ratio.toFixed(2)}:1, "${lowest.text}" (${lowest.size}px) at ${lowest.where}, over ${lowest.behind}`);
console.log(failures.length ? `${failures.length} below the rule:\n${[...new Set(failures)].join("\n")}` : "every run of text meets the rule");
process.exit(failures.length ? 1 : 0);
