// Takes a snapshot of the pool the page shows at the far end of the bridge: the companies with open defense
// and space roles on the a16z speedrun Talent Network's public listing, and how many roles each has.
//
//   pnpm pool:refresh
//
// It reads the listing's public API one page at a time with a pause between pages (and a longer wait when it
// is asked to slow down), sends nothing that
// identifies this project, and writes data/pool.json: the date, the total number of roles, and each company's
// name and role count, largest first. The snapshot is committed, so a build never needs the network and the
// page itself makes no request to anyone. If any page fails, the old file is kept as it is.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://speedrun-talent-network.com/api/v1/jobs?industry=defense_space&page=";
const OUT = fileURLToPath(new URL("../data/pool.json", import.meta.url));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const counts = new Map();
let roles = 0;
try {
  for (let page = 1, more = true; more && page <= 200; page++) {
    // Asked to slow down, it waits as long as it is told (or a growing while) and asks again, a few times.
    let response;
    for (let attempt = 0; ; attempt++) {
      response = await fetch(API + page, { headers: { accept: "application/json" } });
      if (response.status !== 429 || attempt >= 4) break;
      await pause(Math.min(60000, (Number(response.headers.get("retry-after")) || 8 * (attempt + 1)) * 1000));
    }
    if (!response.ok) throw new Error(`page ${page}: HTTP ${response.status}`);
    const body = await response.json();
    const jobs = body.jobs ?? body.data ?? body.results ?? [];
    if (!Array.isArray(jobs)) throw new Error(`page ${page}: no list of jobs in the response`);
    for (const job of jobs) {
      const name = typeof job.company === "string" ? job.company.trim() : job.company?.name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      roles++;
    }
    more = body.has_more === true && jobs.length > 0;
    if (more) await pause(1500);
  }
  if (roles === 0) throw new Error("the listing came back empty");
} catch (error) {
  console.error(`Snapshot not taken (${error.message}). data/pool.json is unchanged.`);
  process.exit(1);
}

const companies = [...counts.entries()].map(([name, n]) => ({ name, roles: n })).sort((a, b) => b.roles - a.roles || a.name.localeCompare(b.name));
const snapshot = { source: "a16z speedrun Talent Network, public listings (defense and space)", date: new Date().toISOString().slice(0, 10), roles, companies };
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`${companies.length} companies, ${roles} open roles, as of ${snapshot.date}. Largest: ${companies.slice(0, 6).map((c) => `${c.name} (${c.roles})`).join(", ")}`);
