// Checks that an advantage's card and the page's one sheet behave as they should, on a desktop, on a phone
// and with reduced motion: the whole card opens the sheet; it is a modal
// sheet of the right width, holding that advantage; focus moves in and stays in; the page behind does not
// scroll; the arrows page through all six; it closes by the cross, Escape, a tap outside and (on the phone) a
// downward swipe; focus returns to the card of the advantage it was showing; with reduced motion nothing
// travels.
//
//   pnpm build && pnpm start -p 3310
//   node tests/card.mjs http://localhost:3310 [n]        n: which advantage's card, 1 to 6 (default 3)
import { chromium } from "@playwright/test";

const base = process.argv[2];
const n = Number(process.argv[3] ?? 3);
if (!base) {
  console.error("usage: node tests/card.mjs <base-url> [n]");
  process.exit(1);
}
/** Where each advantage's stop begins on the show's clock, in viewport heights (the director's numbers). */
const STARTS = [1.5, 2.2, 2.9, 3.5, 4.2, 5.2, 7.2];

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const failures = [];
const check = (view, what, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${what}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures.push(`${view}: ${what} ${detail}`);
};

for (const [view, viewport, touch, reduced] of [
  ["desktop", { width: 1440, height: 900 }, false, false],
  ["phone", { width: 390, height: 844 }, true, false],
  ["desktop, reduced motion", { width: 1440, height: 900 }, false, true],
]) {
  console.log(view);
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await context.newPage();
  await page.goto(base + "/?app=grok", { waitUntil: "networkidle" });
  const button = page.locator(`[data-card="${n - 1}"]`);
  const card = page.locator(`.card:has([data-card="${n - 1}"])`);
  const dialog = page.locator("#sheet");
  // To the card's own stop (with the stage), or to the card itself (without it, where nothing is pinned).
  await page.evaluate(
    ({ n, STARTS }) => {
      const show = document.querySelector('[data-chapter="show"]');
      const pin = show.querySelector("[data-pin]");
      if (document.documentElement.dataset.mode === "3d") window.scrollTo(0, show.getBoundingClientRect().top + scrollY + (STARTS[n - 1] + (STARTS[n] - STARTS[n - 1]) * 0.8) * pin.offsetHeight);
      else document.querySelector(`[data-card="${n - 1}"]`).scrollIntoView({ block: "center" });
    },
    { n, STARTS },
  );
  await page.waitForTimeout(2200);
  const isOpen = () => dialog.evaluate((d) => d.open);
  const state = () => dialog.evaluate((d) => d.dataset.state);
  const opened = () => page.waitForFunction(() => document.querySelector("#sheet")?.dataset.state === "open");
  const closed = () => page.waitForFunction(() => !document.querySelector("#sheet")?.open, null, { timeout: 3000 }).catch(() => {});

  check(view, "the card's title is a button that announces a dialog", (await button.getAttribute("aria-haspopup")) === "dialog" && (await button.getAttribute("aria-expanded")) === "false");
  check(view, "the title is still a heading", await button.evaluate((el) => /^H[2-4]$/.test(el.parentElement.tagName)));

  // 1. The whole card is the button: click its opener, not its title.
  const startY = await page.evaluate(() => scrollY);
  const lead = await card.locator(".lead").boundingBox();
  await page.mouse.click(lead.x + lead.width / 2, lead.y + lead.height / 2);
  await opened();
  check(view, "a click anywhere on the card opens the sheet", await isOpen());
  const timing = await dialog.evaluate((d) => {
    const cs = getComputedStyle(d.querySelector(".sheet"));
    return { properties: cs.transitionProperty, durations: cs.transitionDuration, curve: cs.transitionTimingFunction };
  });
  if (reduced) check(view, "with reduced motion the sheet only fades, in 150 ms", /opacity/.test(timing.properties) && !/transform/.test(timing.properties) && timing.durations.split(",").every((d) => parseFloat(d) <= 0.15), `${timing.properties} ${timing.durations}`);
  else check(view, "it opens in 450 to 500 ms on cubic-bezier(0.32, 0.72, 0, 1)", /0\.48s/.test(timing.durations) && /cubic-bezier\(0\.32, 0\.72, 0, 1\)/.test(timing.curve), `${timing.durations} ${timing.curve}`);
  await page.waitForTimeout(700);
  const open = await dialog.evaluate((d) => {
    const r = d.querySelector(".sheet").getBoundingClientRect();
    return {
      width: Math.round(r.width),
      left: Math.round(r.left),
      right: Math.round(innerWidth - r.right),
      bottom: Math.round(innerHeight - r.bottom),
      modal: d.matches(":modal"),
      labelled: !!document.getElementById(d.getAttribute("aria-labelledby"))?.textContent,
      focusInside: d.contains(document.activeElement),
      focused: document.activeElement?.id || document.activeElement?.tagName,
      index: d.querySelector(".label--index")?.textContent.trim(),
      lines: d.querySelectorAll(".sheet__lines li").length,
      picture: !!d.querySelector(".sheet__picture [role='img'][aria-label]"),
      title: d.querySelector("h2")?.innerText.replace(/\s+/g, " "),
    };
  });
  check(view, "it is a modal dialog with a name", open.modal && open.labelled, open.title);
  check(view, "it shows this card's advantage", open.index?.startsWith(String(n).padStart(2, "0")), open.index);
  if (touch) check(view, "the sheet is the full width less a small margin", open.left >= 6 && open.left <= 16 && open.right >= 6 && open.right <= 16, `${open.width} px, margins ${open.left} and ${open.right}`);
  else check(view, "the sheet is 720 to 820 px wide", open.width >= 720 && open.width <= 820, `${open.width} px`);
  check(view, "it holds the title, the opener, the remaining lines and one picture", open.lines >= 1 && open.picture, `${open.lines} lines`);
  check(view, "focus moved to its title", open.focusInside && open.focused === "sheet-title", String(open.focused));
  check(view, "the card says it is expanded", (await button.getAttribute("aria-expanded")) === "true");

  // 2. Focus stays inside.
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  check(view, "Tab keeps focus inside the sheet", await dialog.evaluate((d) => d.contains(document.activeElement)));

  // 3. The page behind does not scroll.
  await page.mouse.move(viewport.width / 2, viewport.height - 30);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(250);
  check(view, "the page behind does not scroll", (await page.evaluate(() => scrollY)) === startY, `${startY} then ${await page.evaluate(() => scrollY)}`);

  // 4. The arrows page through all six, and come back round. On every page the pager is whole, inside the
  // sheet and on its count's line, and the sheet's phone shows words (never the wordless picture) with nothing
  // running past its bubbles.
  const seen = [open.index];
  const sheetFaults = [];
  const inspect = () =>
    dialog.evaluate((d) => {
      // (As the page opens: the sheet's own scroll at its top. An earlier step may have scrolled it.)
      d.querySelector(".sheet__scroll").scrollTo({ top: 0, behavior: "instant" });
      const sheet = d.querySelector(".sheet").getBoundingClientRect();
      const pager = d.querySelector(".pager").getBoundingClientRect();
      const count = d.querySelector(".pager .label").getBoundingClientRect();
      const arrow = d.querySelector(".pager button").getBoundingClientRect();
      const still = d.querySelector(".sheet__picture canvas");
      const index = d.querySelector(".label--index")?.textContent.trim().slice(0, 2);
      const faults = [];
      if (pager.top < sheet.top - 1 || pager.bottom > sheet.bottom + 1 || pager.left < sheet.left - 1 || pager.right > sheet.right + 1) faults.push(`${index}: the pager stands outside the sheet`);
      // Every row of words whole, in the part of the sheet that is in view as it opens (its scrolling box, within
      // the sheet and the window), and none under another: the title, the opener, each line, the pager. (A pager
      // can stand inside the sheet and still cover a line: the check above would not see it.)
      const box = d.querySelector(".sheet__scroll").getBoundingClientRect();
      const top = Math.max(box.top, sheet.top, 0);
      const bottom = Math.min(box.bottom, sheet.bottom, innerHeight);
      const rows = [...d.querySelectorAll(".sheet__text .title, .sheet__text .lead, .sheet__lines li, .pager")];
      let above = -Infinity;
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        const words = (row.textContent || "").trim().slice(0, 24) || "the pager";
        if (r.top < top - 1 || r.bottom > bottom + 1) faults.push(`${index}: "${words}" is not whole in view (${Math.round(r.top)} to ${Math.round(r.bottom)}, the sheet shows ${Math.round(top)} to ${Math.round(bottom)})`);
        if (r.top < above - 1) faults.push(`${index}: "${words}" stands under the row before it`);
        above = r.bottom;
      }
      if (Math.abs(count.top + count.height / 2 - (arrow.top + arrow.height / 2)) > 2) faults.push(`${index}: the count is off the arrows' line`);
      if (still?.dataset.picture === "far") faults.push(`${index}: the sheet's phone is bars, not words`);
      // The sheet's phone whole inside the sheet, where the sheet scrolls to it.
      {
        const scroller = d.querySelector(".sheet__scroll");
        const phone = d.querySelector(".sheet__picture .still");
        if (phone && scroller) {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "instant" });
          const p = phone.getBoundingClientRect();
          const frame = d.querySelector(".sheet").getBoundingClientRect();
          const picture = d.querySelector(".sheet__picture").getBoundingClientRect();
          if (p.top < Math.max(frame.top, 0) - 1 || p.bottom > Math.min(frame.bottom, innerHeight) + 1 || p.bottom > picture.bottom + 1 || p.left < frame.left - 1 || p.right > frame.right + 1) faults.push(`${index}: the sheet's phone is not whole inside the sheet (${Math.round(p.top)} to ${Math.round(p.bottom)}, the sheet ${Math.round(frame.top)} to ${Math.round(frame.bottom)})`);
          scroller.scrollTo({ top: 0, behavior: "instant" });
        }
      }
      if (still?.dataset.overflow === "1") faults.push(`${index}: something on the sheet's phone runs past its bubble`);
      return faults;
    });
  sheetFaults.push(...(await inspect()));
  for (let i = 0; i < 6; i++) {
    await dialog.locator(".pager button").last().click();
    await page.waitForTimeout(160);
    seen.push(await dialog.evaluate((d) => d.querySelector(".label--index")?.textContent.trim()));
    sheetFaults.push(...(await inspect()));
  }
  check(view, "on every page every row and the pager are whole in view, the count on the arrows' line; the phone shows words and is whole inside the sheet", sheetFaults.length === 0, [...new Set(sheetFaults)].join("; "));
  check(view, "the arrows page through all six and come back round", new Set(seen).size === 6 && seen[6] === seen[0], seen.map((s) => s.slice(0, 2)).join(" "));
  await dialog.locator(".pager button").first().click();
  await page.waitForTimeout(150);
  const before = n === 1 ? 6 : n - 1;
  check(view, "the back arrow shows the advantage before", (await dialog.evaluate((d) => d.querySelector(".label--index")?.textContent.trim())).startsWith(String(before).padStart(2, "0")));

  // 5. Escape closes it, quickly, and focus returns to the card of the advantage it was showing.
  const closeStart = Date.now();
  await page.keyboard.press("Escape");
  await closed();
  const closeMs = Date.now() - closeStart;
  check(view, "Escape closes it in about 250 ms", !(await isOpen()) && closeMs < 420, `${closeMs} ms`);
  // The page goes to that card's stop, and the card rises in over most of a second.
  await page.waitForTimeout(1100);
  check(view, "focus returns to the card of the advantage it was showing", (await page.evaluate(() => document.activeElement?.getAttribute("data-card"))) === String(before - 1));
  check(view, "that card is on screen", await page.evaluate(() => {
    const el = document.activeElement?.closest(".card");
    const r = el?.getBoundingClientRect();
    return !!r && r.bottom > 0 && r.top < innerHeight && Number(getComputedStyle(el.parentElement).opacity) > 0.5;
  }));

  // 6. Enter on the card opens it; the cross closes it.
  await page.keyboard.press("Enter");
  await opened();
  check(view, "Enter on the card opens it", await isOpen());
  await page.waitForTimeout(550);
  await dialog.locator(".sheet__close").click();
  await closed();
  check(view, "the cross closes it", !(await isOpen()));
  await page.waitForTimeout(400);

  // 7. A tap outside closes it.
  await page.keyboard.press("Enter");
  await opened();
  await page.waitForTimeout(550);
  if (touch) await page.touchscreen.tap(viewport.width / 2, 20);
  else await page.mouse.click(60, 60);
  await closed();
  check(view, "a tap outside closes it", !(await isOpen()), await state());
  await page.waitForTimeout(400);

  // 8. On the phone, a downward swipe closes it; a short one does not.
  if (touch) {
    const client = await context.newCDPSession(page);
    const swipe = async (distance) => {
      const box = await dialog.locator(".sheet").boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + 90;
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 8; i++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (distance * i) / 8 }] });
        await page.waitForTimeout(24);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await page.keyboard.press("Enter");
    await opened();
    await page.waitForTimeout(550);
    await swipe(30);
    await page.waitForTimeout(500);
    check(view, "a short drag leaves it open", await isOpen());
    await swipe(190);
    await closed();
    check(view, "a downward swipe closes it", !(await isOpen()), await state());
  }
  await context.close();
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed:\n${failures.join("\n")}` : "\nthe card and the sheet behave as specified");
process.exit(failures.length ? 1 : 0);
