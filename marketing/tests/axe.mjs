// Accessibility check with axe: the static page (what reduced-motion, no-WebGL and no-JS visitors get)
// and the film, at desktop and phone width.
//
//   node tests/axe.mjs <base-url>
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const base = process.argv[2];
if (!base) {
  console.error("usage: node tests/axe.mjs <base-url>");
  process.exit(1);
}
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let found = 0;
for (const [name, viewport, query] of [
  ["desktop static", { width: 1440, height: 900 }, "?3d=off"],
  ["phone static", { width: 390, height: 664 }, "?3d=off"],
  ["desktop film", { width: 1440, height: 900 }, "?3d=force"],
  ["phone film", { width: 390, height: 664 }, "?3d=force"],
]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base + "/" + query, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  console.log(`${name}: ${results.violations.length} kinds of violation, ${results.passes.length} rules passed`);
  for (const violation of results.violations) {
    found++;
    console.log(`  ${violation.impact} · ${violation.id} · ${violation.nodes.length} node(s): ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) console.log(`     ${node.target.join(" ")} — ${(node.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
  }
  await context.close();
}
await browser.close();
console.log(found ? `${found} kinds of violation in all` : "no violations");
