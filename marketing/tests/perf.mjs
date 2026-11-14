// Measures how the film runs on the machine's real GPU: frame times over one whole scroll of the page at a
// constant speed, and (optionally) what the main thread spent those frames on.
//
//   pnpm build && pnpm start -p 3310
//   node tests/perf.mjs http://localhost:3310 --profile=phone            (390 × 844, device pixel ratio 3, CPU slowed 4×)
//   node tests/perf.mjs http://localhost:3310 --profile=desktop          (1440 × 900, device pixel ratio 2)
//   node tests/perf.mjs http://localhost:3310 --profile=phone --trace=/tmp/trace.json --cpu=/tmp/cpu.json
//
// Frame time is the interval between animation frames while a script scrolls the page (time-based, so a slow
// frame does not slow the scroll): what a visitor sees, display cadence included. Run it with nothing else
// busy on the machine, and read `uptime` in the output before believing a bad number.
//
// Targets: phone profile median ≤ 22 ms and 95th
// percentile ≤ 50 ms; desktop no frame over 100 ms and fewer than 1% over 33 ms.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [base, ...flags] = process.argv.slice(2);
if (!base) {
  console.error("usage: node tests/perf.mjs <base-url> [--profile=phone|desktop|desktop-1x] [--trace=file] [--cpu=file] [--runs=1] [--from=0] [--to=1] [--throttle=n] [--css=rule]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const found = flags.find((f) => f.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};
const PROFILES = {
  phone: { viewport: { width: 390, height: 844 }, dpr: 3, throttle: 4, speed: 600 },
  desktop: { viewport: { width: 1440, height: 900 }, dpr: 2, throttle: 1, speed: 900 },
  "desktop-1x": { viewport: { width: 1440, height: 900 }, dpr: 1, throttle: 1, speed: 900 },
};
const profile = { ...PROFILES[flag("profile", "phone")] };
// `--throttle=30` slows the CPU further, to see the film hand over to the static page when it cannot keep up.
if (flag("throttle")) profile.throttle = Number(flag("throttle"));
const tracePath = flag("trace");
const cpuPath = flag("cpu");
const runs = Number(flag("runs", 1));
const from = Number(flag("from", 0));
const to = Number(flag("to", 1));
// For experiments: a rule to add to the page before measuring (for example `--css=.sl-row{transition:none!important}`).
const css = flag("css");

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
const ms = (v) => `${v.toFixed(1)} ms`;

const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: profile.viewport, deviceScaleFactor: profile.dpr });
const consoleLines = [];
page.on("console", (m) => consoleLines.push(`${m.type()}: ${m.text().slice(0, 160)}`));
page.on("pageerror", (e) => consoleLines.push(`pageerror: ${String(e).slice(0, 160)}`));
await page.goto(base + "/?app=grok", { waitUntil: "networkidle" });
const about = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return { mode: document.documentElement.dataset.mode, renderer: gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "none", height: document.documentElement.scrollHeight };
});
console.log(`uptime: ${execSync("uptime").toString().trim()}`);
console.log(`mode ${about.mode}, renderer ${about.renderer}, page ${about.height} px, profile ${JSON.stringify(profile)}`);
if (about.mode !== "3d") {
  console.error("The page chose the static layout: no usable GPU here.");
  await browser.close();
  process.exit(1);
}
if (css) await page.addStyleTag({ content: css });
await page.waitForTimeout(3500);
const client = await page.context().newCDPSession(page);
if (profile.throttle > 1) await client.send("Emulation.setCPUThrottlingRate", { rate: profile.throttle });

for (let run = 0; run < runs; run++) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  if (tracePath && run === 0) {
    await browser.startTracing(page, { path: tracePath, categories: ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "v8.execute", "blink.user_timing", "disabled-by-default-v8.gc", "loading", "gpu"] });
  }
  if (cpuPath && run === 0) {
    await client.send("Profiler.enable");
    await client.send("Profiler.setSamplingInterval", { interval: 250 });
    await client.send("Profiler.start");
  }
  const result = await page.evaluate(
    ({ speed, from, to }) =>
      new Promise((resolve) => {
        const frames = [];
        const whole = document.documentElement.scrollHeight - innerHeight;
        const start = whole * from;
        const end = whole * to;
        const sections = [...document.querySelectorAll("main section[id]")].map((s) => [s.id, s.getBoundingClientRect().top + scrollY]);
        let last = performance.now();
        const t0 = last;
        const step = (now) => {
          frames.push([now - last, scrollY]);
          // A mark in the trace where a long frame ended, so the trace can say what filled it.
          if (now - last > 80) performance.mark(`long:${Math.round(now - last)}:${Math.round(scrollY)}`);
          last = now;
          const y = Math.min(end, start + ((now - t0) / 1000) * speed);
          window.scrollTo(0, y);
          if (y >= end) resolve({ frames, sections, mode: document.documentElement.dataset.mode });
          else requestAnimationFrame(step);
        };
        window.scrollTo(0, start);
        requestAnimationFrame(step);
      }),
    { speed: profile.speed, from, to },
  );
  let cpu = null;
  if (cpuPath && run === 0) {
    cpu = (await client.send("Profiler.stop")).profile;
    writeFileSync(cpuPath, JSON.stringify(cpu));
  }
  if (tracePath && run === runs - 1) await browser.stopTracing();

  // The first frames after the jump to the start are not the film's.
  const frames = result.frames.slice(3);
  const times = frames.map((f) => f[0]).sort((a, b) => a - b);
  const over = (limit) => frames.filter((f) => f[0] > limit);
  const chapterAt = (y) => {
    let name = "top";
    for (const [id, top] of result.sections) if (top <= y + 1) name = id;
    return name;
  };
  console.log(
    `run ${run + 1}: ${frames.length} frames, median ${ms(quantile(times, 0.5))}, p95 ${ms(quantile(times, 0.95))}, p99 ${ms(quantile(times, 0.99))}, worst ${ms(times[times.length - 1])}, ` +
      `over 33 ms ${over(33.4).length} (${((over(33.4).length / frames.length) * 100).toFixed(1)}%), over 50 ms ${over(50).length}, over 100 ms ${over(100).length}; mode at the end: ${result.mode}`,
  );
  const long = over(100).map((f) => `${Math.round(f[0])} ms at ${Math.round(f[1])} (${chapterAt(f[1])})`);
  if (long.length) console.log(`  over 100 ms: ${long.join(", ")}`);
  const byChapter = {};
  for (const f of over(33.4)) byChapter[chapterAt(f[1])] = (byChapter[chapterAt(f[1])] ?? 0) + 1;
  if (over(33.4).length) console.log(`  over 33 ms by chapter: ${Object.entries(byChapter).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  if (cpu) {
    // Self time by function, from the sampling profiler.
    const self = new Map();
    const byId = new Map(cpu.nodes.map((n) => [n.id, n]));
    cpu.samples.forEach((id, i) => {
      const node = byId.get(id);
      const f = node.callFrame;
      const key = `${f.functionName || "(anonymous)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (cpu.timeDeltas[i] ?? 0) / 1000);
    });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    console.log(`  CPU profile, self time (of ${Math.round(total)} ms sampled):`);
    for (const [key, time] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`    ${time.toFixed(0).padStart(6)} ms  ${key}`);
  }
}
await browser.close();
if (consoleLines.length) console.log(`console: ${[...new Set(consoleLines)].join(" | ")}`);

if (tracePath) {
  // Main-thread self time by kind of work, from the trace.
  const events = JSON.parse(readFileSync(tracePath, "utf8")).traceEvents ?? [];
  const threads = new Map();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") threads.set(`${e.pid}:${e.tid}`, e.args.name);
  const perThread = new Map();
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue;
    const key = `${e.pid}:${e.tid}`;
    if (!perThread.has(key)) perThread.set(key, []);
    perThread.get(key).push(e);
  }
  const report = [];
  for (const [key, list] of perThread) {
    const name = threads.get(key) ?? "?";
    if (!/CrRendererMain|Compositor$|CrGpuMain|VizCompositorThread/.test(name)) continue;
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const self = new Map();
    const stack = [];
    let busy = 0;
    for (const e of list) {
      while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) stack.pop();
      if (stack.length) stack[stack.length - 1].child += e.dur;
      else busy += e.dur;
      const entry = { ts: e.ts, dur: e.dur, child: 0, name: e.name };
      stack.push(entry);
      e.entry = entry;
    }
    for (const e of list) self.set(e.name, (self.get(e.name) ?? 0) + Math.max(0, e.dur - e.entry.child) / 1000);
    report.push({ name, key, busy: busy / 1000, self });
  }
  report.sort((a, b) => b.busy - a.busy);

  // What each long frame was spent on: the longest pieces of work on any thread inside its window.
  const marks = events.filter((e) => typeof e.name === "string" && e.name.startsWith("long:") && (e.ph === "R" || e.ph === "I" || e.ph === "i" || e.ph === "n" || e.ph === "b"));
  const seen = new Set();
  for (const mark of marks) {
    if (seen.has(mark.name)) continue;
    seen.add(mark.name);
    const [, gap, at] = mark.name.split(":");
    const start = mark.ts - Number(gap) * 1000 - 20000;
    console.log(`long frame of ${gap} ms at scroll ${at}:`);
    const found = [];
    for (const [key, list] of perThread) {
      const thread = threads.get(key) ?? "?";
      for (const e of list) {
        if (e.dur < 12000 || e.ts + e.dur < start || e.ts > mark.ts) continue;
        if (/^(RunTask|ThreadControllerImpl::RunTask|Scheduler::RunTask|TaskGraphRunner::RunTask|ThreadPool_RunTask|SimpleWatcher::OnHandleReady|Receive mojo message|Closure)$/.test(e.name)) continue;
        found.push([e.dur / 1000, `${thread}: ${e.name}${e.args?.data?.url ? ` ${String(e.args.data.url).split("/").pop()}` : ""}${e.args?.data?.functionName ? ` ${e.args.data.functionName}` : ""}${e.args?.elementCount ? ` (${e.args.elementCount} elements)` : ""}${e.args?.beginData?.dirtyObjects !== undefined ? ` (${e.args.beginData.dirtyObjects} of ${e.args.beginData.totalObjects} objects)` : ""}`]);
      }
    }
    found.sort((a, b) => b[0] - a[0]);
    for (const [time, what] of found.slice(0, 12)) console.log(`  ${time.toFixed(0).padStart(6)} ms  ${what}`);
  }
  for (const thread of report.slice(0, 4)) {
    console.log(`thread ${thread.name} (${thread.key}): busy ${Math.round(thread.busy)} ms`);
    for (const [name, time] of [...thread.self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${time.toFixed(0).padStart(7)} ms  ${name}`);
  }
}
