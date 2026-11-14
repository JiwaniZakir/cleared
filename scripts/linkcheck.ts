#!/usr/bin/env tsx
/**
 * Link check: every source URL across data/*.json, SOURCES.md, the /sources
 * page's own rows, and every URL a tool cites inline (lib/tools/*.ts) must
 * return 2xx/3xx. Run: pnpm linkcheck
 *
 * Design notes:
 * - Shells out to `curl` per URL rather than using Node's native `fetch`.
 * This was NOT the original design — an earlier version used `fetch` with a
 * hand-rolled concurrency pool and reported ~90 "aborted" failures that
 * turned out to be entirely false: spot-checking several flagged URLs with
 * plain `curl` showed them responding correctly in under 300ms. The
 * `fetch`-based version's AbortController timers were firing before
 * requests actually completed under concurrent load — a bug in the checker,
 * not in the links. `curl` has no such issue and was verified directly
 * against the same URLs before this rewrite, so this is the trustworthy
 * version, not a convenience shortcut.
 * - 3xx counts as PASS (a redirect isn't a dead link).
 * - A real browser-like User-Agent is sent, because several cited sources
 *   (X/Twitter, Reddit, Blind, Glassdoor) are known to reject requests that
 *   look automated even when the page is genuinely live.
 * - A 401/403/406/419/429/999-style response is reported as WARN, not FAIL:
 *   401/406 are expected for a handful of cited URLs that are literal API
 *   endpoints (e.g. mcp.stripe.com, mcp.linear.app/mcp) rather than readable
 *   pages — they correctly require auth or a stricter Accept header than a
 *   bare automated GET provides, which is proof the endpoint is live, not
 *   evidence it's dead. 403/419/429/999 are well-established bot-blocking
 *   signatures (Glassdoor, W3C, npmjs, .mil sites, DOI redirectors all do
 *   this to non-browser clients). FAIL is reserved for 404/5xx/DNS-failure/
 *   timeout — an actually broken link — except for the few hosts listed in
 *   BOT_BLOCKING_HOSTS below, each checked in a real browser.
 * - Large files (PDFs) get a longer timeout: a 15 MB slide deck can take more
 *   than 15 seconds to download under 4-way concurrency without being dead.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const TIMEOUT_SECONDS = 15;
/** For URLs whose path ends in .pdf: curl downloads the whole body, and some
 *  cited PDFs are over 10 MB. Checked 2026-11-14: the 15 MB NISPPAC slides
 *  (archives.gov) took 4.8 s alone but timed out at 15 s under concurrency. */
const LARGE_FILE_TIMEOUT_SECONDS = 90;
const CONCURRENCY = 4;

function timeoutFor(url: string): number {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf") ? LARGE_FILE_TIMEOUT_SECONDS : TIMEOUT_SECONDS;
  } catch {
    return TIMEOUT_SECONDS;
  }
}

// Captures a URL up to the first character that's never part of one in these
// documents (whitespace, quotes, markdown's closing `]`/backtick/`<`/`>`). A
// `)` is captured and trimmed afterwards, because some cited URLs contain
// parentheses (".../Personnel_Vetting_QPR_(FY26-Q3).pdf"): stopping at the
// first `)` checked a truncated URL instead of the real one.
const URL_RE = /https?:\/\/[^\s"'\]<>`]+/g;

/** Drops what closes the surrounding prose or markdown link rather than
 *  belongs to the URL: trailing punctuation, and a trailing `)` only while
 *  the URL has more `)` than `(`. */
function trimUrl(raw: string): string {
  let u = raw;
  for (;;) {
    const before = u;
    u = u.replace(/[.,;:!?]+$/, "");
    if (u.endsWith(")") && (u.match(/\)/g) ?? []).length > (u.match(/\(/g) ?? []).length) u = u.slice(0, -1);
    if (u === before) return u;
  }
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  return matches
    .map(trimUrl)
    .filter((u) => !u.includes("{") && !u.includes("}")); // template syntax (e.g. ".../{boardName}"), never a real resolvable link
}

function collectUrls(): Map<string, Set<string>> {
  const sources = new Map<string, Set<string>>(); // url -> set of file paths citing it
  const add = (url: string, file: string) => {
    if (!sources.has(url)) sources.set(url, new Set());
    sources.get(url)!.add(file);
  };

  const dataDir = path.join(ROOT, "data");
  for (const file of fs.readdirSync(dataDir)) {
    if (!file.endsWith(".json")) continue;
    const text = fs.readFileSync(path.join(dataDir, file), "utf8");
    for (const url of extractUrlsFromText(text)) add(url, `data/${file}`);
  }

  for (const rel of ["SOURCES.md", "lib/sources-rows.ts"]) {
    const full = path.join(ROOT, rel);
    if (fs.existsSync(full)) for (const url of extractUrlsFromText(fs.readFileSync(full, "utf8"))) add(url, rel);
  }
  const toolsDir = path.join(ROOT, "lib/tools");
  for (const file of fs.readdirSync(toolsDir)) {
    if (!file.endsWith(".ts")) continue;
    // Only `url: "..."` literals — the tools' own sources[] entries — not every
    // string that happens to contain a URL (e.g. example text in a prompt).
    for (const m of fs.readFileSync(path.join(toolsDir, file), "utf8").matchAll(/url:\s*"(https?:\/\/[^"]+)"/g)) {
      add(m[1], `lib/tools/${file}`);
    }
  }

  return sources;
}

type CheckResult = { url: string; status: "PASS" | "WARN" | "FAIL"; detail: string };

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const MAX_ATTEMPTS = 3;
// 401/403/406/419/429/999: bot-blocking signatures (the site is live but
// rejects automated requests). 405: a handful of cited URLs are literal MCP
// endpoints (mcp.speedrun-talent-network.com/mcp, our own
// cleared-mcp.vercel.app/mcp) that correctly reject a bare unauthenticated
// GET per the MCP spec — 405 proves the endpoint is live and responding
// correctly, not that the link is dead.
const NOT_NECESSARILY_DEAD_CODES = [401, 403, 405, 406, 419, 429, 999];
// Host-specific codes a host sends to non-browser clients even for live
// pages. Scoped to the host rather than treating the code as "not dead"
// everywhere, which would hide genuinely broken links; these still report
// as WARN, never PASS.
// - www.meta.com answers 400 (checked 2026-11-12: both cited Brand Resource
//   Center URLs return 200 in a real browser).
// - www.ftc.gov answers 404 (checked 2026-11-14: both cited pages, the
//   employers' consumer-report guide and the 1997 Weisberg advisory opinion,
//   load in a real headed browser; a headless one gets an "abusive automated
//   request" page).
const BOT_BLOCKING_HOSTS: ReadonlyMap<string, number> = new Map([
  ["www.meta.com", 400],
  ["www.ftc.gov", 404],
]);
// Hosts whose live pages fail at the network level from some machines, so a
// thrown curl error there reports as WARN, never PASS. Checked 2026-11-14:
// every cited page on these hosts returns 200 from a desktop machine.
// - ilga.gov, www.ilga.gov: the server sends an incomplete certificate chain
//   (openssl: "unable to verify the first certificate"); macOS completes it,
//   Linux CI runners do not.
// - www.onr.navy.mil: refuses connections from cloud CI runners.
const UNREACHABLE_FROM_CI_HOSTS: ReadonlySet<string> = new Set(["ilga.gov", "www.ilga.gov", "www.onr.navy.mil"]);
function unreachableFromCi(url: string): boolean {
  try {
    return UNREACHABLE_FROM_CI_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}
function notNecessarilyDead(url: string, status: number): boolean {
  if (NOT_NECESSARILY_DEAD_CODES.includes(status)) return true;
  try {
    return BOT_BLOCKING_HOSTS.get(new URL(url).host) === status;
  } catch {
    return false;
  }
}

async function curlOnce(url: string): Promise<number> {
  const { stdout } = await execFileAsync("curl", [
    "-sS",
    "-L", // follow redirects, matching "3xx counts as pass" by reporting the final hop's status
    "-m",
    String(timeoutFor(url)),
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    "-A",
    UA,
    url,
  ]);
  return Number(stdout.trim());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries both real network blips AND a transient-looking bot-block code —
 * repeated runs of this exact script against the same hosts in a short
 * window were themselves observed to trigger rate-limiting (self-inflicted),
 * so a single 429 on first attempt is retried before being trusted as "this
 * host blocks automated checks" rather than "we just got rate-limited by
 * our own prior run a moment ago."
 */
async function checkUrl(url: string): Promise<CheckResult> {
  let lastStatus: number | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const status = await curlOnce(url);
      lastStatus = status;
      if (status >= 200 && status < 400) return { url, status: "PASS", detail: String(status) };
      if (notNecessarilyDead(url, status) && attempt < MAX_ATTEMPTS) {
        await sleep(1500 * attempt);
        continue;
      }
      if (notNecessarilyDead(url, status)) {
        const reason = status === 405 ? "live API endpoint, bare GET not supported" : "likely bot-blocked";
        return { url, status: "WARN", detail: `${status} (${reason}, not necessarily dead)` };
      }
      return { url, status: "FAIL", detail: String(status) };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(1500 * attempt);
        continue;
      }
    }
  }
  // Exhausted all retries on a thrown network-level error as the FINAL
  // attempt specifically (not an HTTP status). Found live: a URL that
  // legitimately returns 401 every time can still throw a transient
  // network error on just its last retry, and without this check that
  // stale-but-real earlier 401 silently downgraded to a hard FAIL — purely
  // because of which attempt happened to be last, not because the link is
  // actually dead. Trust an earlier real HTTP response in the
  // "not necessarily dead" bucket over a later transient network blip.
  if (lastStatus !== null && notNecessarilyDead(url, lastStatus)) {
    const reason = lastStatus === 405 ? "live API endpoint, bare GET not supported" : "likely bot-blocked";
    return { url, status: "WARN", detail: `${lastStatus} (${reason}, not necessarily dead; final retry hit a network error)` };
  }
  if (lastStatus === null && unreachableFromCi(url)) {
    return { url, status: "WARN", detail: "network error from this machine (known for this host; the page is live)" };
  }
  return {
    url,
    status: "FAIL",
    detail: lastStatus !== null ? String(lastStatus) : lastError instanceof Error ? lastError.message : String(lastError),
  };
}

async function runWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const urlMap = collectUrls();
  const urls = [...urlMap.keys()].filter((u) => !u.includes(".invalid"));
  console.log(`Checking ${urls.length} unique cited URLs (via curl, ${CONCURRENCY}-way concurrent)...\n`);

  const results = await runWithConcurrency(urls, CONCURRENCY, checkUrl);

  const byStatus = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const r of results) {
    byStatus[r.status]++;
    if (r.status !== "PASS") {
      const citedBy = [...(urlMap.get(r.url) ?? [])].join(", ");
      console.log(`${r.status}  ${r.url}\n      ${r.detail} — cited by: ${citedBy}`);
    }
  }

  console.log(`\n${byStatus.PASS} passed, ${byStatus.WARN} warned (likely bot-blocked), ${byStatus.FAIL} failed.`);

  if (byStatus.FAIL > 0) {
    console.error("\nLink check FAILED — see FAIL entries above.");
    process.exit(1);
  }
  console.log("\nLink check passed (WARNs are informational, not failures — see script header for why).");
}

main();
