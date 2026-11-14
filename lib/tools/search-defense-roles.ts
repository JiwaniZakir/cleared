import { z } from "zod";
import { searchJobs } from "@/lib/speedrun/client";
import { extractRequirementSignals } from "@/lib/speedrun/infer";
import type { SpeedrunJobSearchParams, SpeedrunJobSummary } from "@/lib/speedrun/types";
import { SPEEDRUN_SOURCE, matchesClearanceFilter, looksItarRestricted } from "@/lib/tools/role-shared";
import { getJob } from "@/lib/speedrun/client";
import { DISCLAIMERS } from "@/lib/disclaimers";
import { SourceRefSchema, type ToolDef } from "@/lib/tools/wrap";

const LEVELS = ["intern", "new_grad", "junior", "mid", "senior", "staff_principal", "lead_manager", "director", "vp", "c_level", "founder"] as const;
const EXPERIENCE_BANDS = ["0", "under_1", "1_2", "3_5", "6_9", "10_14", "15_plus"] as const;
const ENGAGEMENTS = ["full_time", "part_time", "contract", "internship"] as const;

const InputSchema = z.object({
  query: z.string().max(200).optional().describe("Free-text search, e.g. \"autonomy\" or \"software engineer\"."),
  clearance: z
    .enum(["none", "secret", "ts", "ts_sci"])
    .optional()
    .describe("Filter to roles whose detected clearance signal matches this level. \"none\" = no clearance signal detected."),
  itar_only: z.boolean().optional().describe("Only roles that appear to require US-person/citizenship status (including citizenship implied by a required clearance)."),
  location: z.string().max(100).optional(),
  remote: z.boolean().optional(),
  // Upstream filters that exist but used to be unexposed — a student
  // couldn't ask for internships, and a team couldn't ask for its own roles.
  level: z
    .array(z.enum(LEVELS))
    .min(1)
    .max(LEVELS.length)
    .optional()
    .describe("Seniority level(s), any of: intern, new_grad, junior, mid, senior, staff_principal, lead_manager, director, vp, c_level, founder. Classified by the Talent Network; roles with no level label are left out."),
  min_experience: z
    .array(z.enum(EXPERIENCE_BANDS))
    .min(1)
    .max(EXPERIENCE_BANDS.length)
    .optional()
    .describe("Minimum years of experience the posting asks for, any of: 0 (none required), under_1, 1_2, 3_5, 6_9, 10_14, 15_plus."),
  employment_type: z
    .array(z.enum(ENGAGEMENTS))
    .min(1)
    .max(ENGAGEMENTS.length)
    .optional()
    .describe("Any of: full_time, part_time, contract, internship."),
  company: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Only this company's roles: its name exactly as roles[].company gives it (e.g. \"Anduril Industries\"); the upstream matches the exact name, case included."),
  page: z
    .number()
    .int()
    .min(0)
    .max(200)
    .optional()
    .describe("Start at this upstream results page (0-based, 50 postings a page). To continue a search, pass nextCursor as cursor instead."),
  cursor: z
    .string()
    .regex(/^\d{1,5}$/, "cursor must be a nextCursor value from a previous search_defense_roles result")
    .optional()
    .describe("nextCursor from a previous call with the same search terms and filters: continues exactly where that call stopped. Takes precedence over page."),
  limit: z.number().int().min(1).max(25).optional().default(10),
});

const RequirementSignalSchema = z.object({
  kind: z.string(),
  value: z.string(),
  basis: z.enum(["stated", "inferred"]),
  evidence: z.string(),
  // For clearance signals: whether the posting needs the clearance already
  // held, only the ability to obtain one, or maybe not at all.
  clearanceStage: z.enum(["must_already_hold", "must_be_able_to_obtain", "may_be_required"]).optional(),
});

const RoleResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  companySlug: z.string().nullable(), // null for a stealth posting — no public company page to slug
  url: z.string(),
  location: z.string().nullable(),
  remote: z.boolean(),
  workplaceType: z.string().nullable(),
  compMin: z.number().nullable(),
  compMax: z.number().nullable(),
  compCurrency: z.string().nullable(),
  publishedAt: z.string(),
  requirementSignals: z.array(RequirementSignalSchema),
});

const OutputSchema = z.object({
  roles: z.array(RoleResultSchema),
  // A filtered search used to check at most 25 postings and give no way to
  // go on, so it was a sample presented as a search ("software
  // engineer" + clearance "none": 2 roles out of 200 scanned). It now says
  // how many postings match, which of them this call examined, and returns a
  // cursor for the rest. Replaces `rolesScanned`, which counted fetched
  // summaries — a number that matched neither.
  matchedTotal: z.number().describe("Postings on the Talent Network matching the search terms and upstream filters (query, location, level, experience, employment type, company, remote)."),
  examined: z.object({
    from: z.number().describe("1-based position, in matchedTotal's order, of the first posting this call examined."),
    to: z.number().describe("Position of the last posting this call examined (from - 1 when none)."),
    count: z.number().describe("Postings checked against every filter you set — those whose requirement signals failed to load are not counted."),
  }),
  nextCursor: z.string().nullable().describe("Pass as cursor, with the same search terms and filters, to examine the next postings; null once every matching posting has been examined."),
  // Only up to MAX_DETAIL_FETCHES postings per call get their requirement signals
  // checked (bounds latency). Kept as its own number so a calling agent can
  // see it without parsing prose.
  requirementSignalsCheckedCount: z.number(),
  note: z.string(),
  sources: z.array(SourceRefSchema),
  disclaimer: z.string(),
});

const MAX_PAGES_SCANNED = 4; // 4 * 50 = up to 200 postings — handles upstream pagination robustly
const MAX_DETAIL_FETCHES = 25; // bounds latency: at most this many parallel per-job detail calls
// Each page fetch has its own retry/backoff budget (lib/speedrun/client.ts,
// up to 3 attempts with up to ~3s of backoff on a transient 429/5xx), and
// this loop can fetch up to MAX_PAGES_SCANNED of them SEQUENTIALLY (two
// calls once took 22.4s and 11.0s against an otherwise sub-400ms baseline,
// traced to a transient upstream slowdown, not a query-specific issue —
// identical re-queries moments later were fast). A deadline on the page-scan
// phase bounds the worst case to roughly one slow page's own retry budget
// rather than up to four of them compounding, which matters because that
// total is close enough to common MCP-client tool-call timeout budgets that
// an un-bounded worst case would read as a hang.
const PAGE_SCAN_DEADLINE_MS = 8000;
// The deadline above was only checked between pages, so it couldn't stop a
// page already in flight, and nothing bounded the detail-fetch phase at all
// — found by a self-run probe with the upstream slow (4-6s per page, a 5.7s
// median and 24.7s max per detail fetch): a plain "rust" search took 15.6s
// and an empty one 32s. Now every request carries the deadline down to the fetch
// itself (lib/speedrun/client.ts), and the whole call has one budget. When
// the upstream is healthy (sub-second) none of this engages.
const SEARCH_BUDGET_MS = 13000;
/** The detail phase always gets at least this long, even after a slow page scan. */
const MIN_DETAIL_PHASE_MS = 3000;

/** The upstream's page size (openapi.json: "50 items per page"). */
const UPSTREAM_PAGE_SIZE = 50;

interface Candidate {
  /** 0-based position in the matched list. */
  position: number;
  summary: SpeedrunJobSummary;
}

// Root-caused directly against the upstream: the speedrun API
// intermittently returns HTTP 500 {"code":"internal",
// "message":"query failed"} on individual pages of an otherwise-working
// query. A later page failing after retries used to throw out of this
// loop and fail the whole tool call — discarding every result already
// fetched from earlier pages — and that page's retry backoff ran past the
// deadline above (a measured 26s before failing). Now: the first page
// still retries and still surfaces a real error if it fails (there's
// nothing to return without it), but a later page gets one attempt, and
// if it fails the scan stops and returns what it has, with a note saying so.
//
// The scan starts at `start` (a cursor or page) and stops as soon as
// it has `wanted` candidates, so the caller can continue from exactly where
// it stopped; `seenThrough` is the position after the last posting looked at.
async function fetchCandidateSummaries(
  params: Omit<SpeedrunJobSearchParams, "page">,
  start: number,
  wanted: number,
  keep: (summary: SpeedrunJobSummary) => boolean,
  startedAt: number,
) {
  const candidates: Candidate[] = [];
  let page = Math.floor(start / UPSTREAM_PAGE_SIZE);
  let seenThrough = start;
  let matchedTotal = 0;
  let exhausted = false;
  const deadline = startedAt + PAGE_SCAN_DEADLINE_MS;
  let truncatedByDeadline = false;
  let truncatedByUpstreamError = false;
  for (let i = 0; i < MAX_PAGES_SCANNED && candidates.length < wanted; i++) {
    if (Date.now() > deadline) {
      truncatedByDeadline = true;
      break;
    }
    const pageParams = { ...params, page };
    let res: Awaited<ReturnType<typeof searchJobs>>;
    try {
      res = i === 0 ? await searchJobs(pageParams, { deadline }) : await searchJobs(pageParams, { maxAttempts: 1, deadline });
    } catch (err) {
      if (i === 0) throw err;
      // A later page that ran out of time is a slow upstream, not an error —
      // say which, since the two notes give different advice.
      if (Date.now() >= deadline - 1000) truncatedByDeadline = true;
      else truncatedByUpstreamError = true;
      break;
    }
    if (i === 0) matchedTotal = res.total;
    const pageStart = res.page * (res.page_size || UPSTREAM_PAGE_SIZE);
    for (let j = 0; j < res.jobs.length; j++) {
      const position = pageStart + j;
      if (position < start) continue;
      seenThrough = position + 1;
      if (keep(res.jobs[j])) candidates.push({ position, summary: res.jobs[j] });
      if (candidates.length >= wanted) break;
    }
    if (candidates.length >= wanted) break;
    if (!res.has_more || res.next_page == null) {
      exhausted = true;
      break;
    }
    page = res.next_page;
  }
  return { candidates, matchedTotal, seenThrough, exhausted, truncatedByDeadline, truncatedByUpstreamError };
}

export const searchDefenseRolesTool: ToolDef<z.infer<typeof InputSchema>, z.infer<typeof OutputSchema>> = {
  name: "search_defense_roles",
  title: "Search defense-tech roles",
  description:
    "Searches live defense/hard-tech roles from the a16z speedrun Talent Network's public API. Each result includes requirement signals labeled 'stated' (a verbatim quote from the posting) or 'inferred' (a pattern-based judgment call to confirm with the employer) — never a guess presented as fact. " +
    "Filter by level, min_experience, employment_type (e.g. internship) and company upstream; clearance and itar_only are checked on each posting's text, up to 25 postings per call. Every result says how many postings match (matchedTotal) and which of them this call examined (examined); pass nextCursor back as cursor, with the same filters, to examine the rest. Positions can shift slightly if postings are added or filled between calls.",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async ({ query, clearance, itar_only, location, remote, level, min_experience, employment_type, company, page, cursor, limit }) => {
    const startedAt = Date.now();
    const start = cursor !== undefined ? Number(cursor) : (page ?? 0) * UPSTREAM_PAGE_SIZE;
    const signalFiltered = Boolean(clearance || itar_only);
    // A signal filter is checked on up to MAX_DETAIL_FETCHES postings a call;
    // without one, only the roles being returned need their signals loaded.
    const wanted = signalFiltered ? MAX_DETAIL_FETCHES : limit;
    const keep = (c: SpeedrunJobSummary) => (remote === true ? c.remote : remote === false ? !c.remote : true);
    const scan = await fetchCandidateSummaries(
      {
        q: query,
        industry: "defense_space",
        loc: location,
        scope: "portfolio",
        remote: remote === true ? true : undefined,
        lvl: level?.join(","),
        yoe: min_experience?.join(","),
        eng: employment_type?.join(","),
        company,
      },
      start,
      wanted,
      keep,
      startedAt,
    );
    const { candidates, matchedTotal, truncatedByDeadline, truncatedByUpstreamError } = scan;

    const detailDeadline = Math.max(Date.now() + MIN_DETAIL_PHASE_MS, startedAt + SEARCH_BUDGET_MS);
    const detailed = await Promise.allSettled(
      candidates.map(async (candidate) => {
        const { job } = await getJob(candidate.summary.id, { deadline: detailDeadline });
        const signals = extractRequirementSignals(job.description_text, {
          industry: "defense_space",
          location: job.location,
        });
        return { ...candidate, signals };
      }),
    );

    // Walk in order, so the cursor can stop right after the last role
    // returned: matches past `limit` are examined by the next call, not lost.
    type Checked = Candidate & { signals: ReturnType<typeof extractRequirementSignals> };
    const results: Checked[] = [];
    let nextPosition = scan.seenThrough;
    let signalsChecked = 0;
    let signalsMissing = 0;
    for (let i = 0; i < detailed.length; i++) {
      const outcome = detailed[i];
      // A detail fetch that failed used to drop its
      // role silently while the checked count still counted it.
      if (outcome.status === "rejected") {
        signalsMissing++;
        continue;
      }
      signalsChecked++;
      const r = outcome.value;
      if (clearance && !matchesClearanceFilter(r.signals, clearance, r.summary.location)) continue;
      if (itar_only && !looksItarRestricted(r.signals)) continue;
      results.push(r);
      if (results.length >= limit) {
        nextPosition = r.position + 1;
        break;
      }
    }
    const examinedFrom = start + 1;
    const examinedTo = Math.max(start, Math.min(nextPosition, matchedTotal || nextPosition));
    const examinedCount = Math.max(0, examinedTo - start - signalsMissing);
    const finished = (scan.exhausted && nextPosition >= scan.seenThrough) || examinedTo >= matchedTotal;
    const nextCursor = finished ? null : String(examinedTo);
    const roles = results;

    const filterNames = [clearance ? "clearance" : null, itar_only ? "itar_only" : null, remote !== undefined ? "remote" : null].filter(
      (f): f is string => f !== null,
    );
    const notes: string[] = [];
    if (matchedTotal > 0) {
      const range = examinedTo >= examinedFrom ? `postings ${examinedFrom}–${examinedTo}` : "no postings";
      notes.push(
        `${matchedTotal} posting${matchedTotal === 1 ? "" : "s"} match your search terms; this call examined ${range} (${examinedCount} checked against ${filterNames.length > 0 ? `the ${filterNames.join(", ")} filter${filterNames.length === 1 ? "" : "s"}` : "your search"}) and returned ${roles.length}.` +
          (nextCursor
            ? ` ${matchedTotal - examinedTo} not yet examined — call again with cursor "${nextCursor}" and the same filters to continue.`
            : " Every matching posting has now been examined."),
      );
    }
    if (truncatedByDeadline) {
      notes.push(
        "The upstream job network responded slowly, so this scan stopped early rather than keep waiting — results above may be incomplete. Try again, or narrow the search.",
      );
    }
    if (truncatedByUpstreamError) {
      notes.push(
        "The upstream job network returned an error partway through this scan, so results above cover only the postings it returned before that — they may be incomplete. Retrying often succeeds (these upstream errors are intermittent), as does a more specific search term.",
      );
    }
    if (signalsMissing > 0) {
      notes.push(
        `Requirement signals couldn't be loaded in time for ${signalsMissing} of the ${signalsChecked + signalsMissing} postings checked (the upstream job network was slow or returned errors), so ${signalsMissing === 1 ? "that posting isn't" : "those postings aren't"} in the results above or the examined count — repeating this same call retries ${signalsMissing === 1 ? "it" : "them"}.`,
      );
    }

    // A specific company's own public name (e.g. "Shield AI", "Castelion")
    // routinely returns zero hits even when that company is real and does
    // post roles elsewhere on the board — the underlying search appears to
    // match only a narrow set of indexed fields, not the full description
    // body. With no guidance, a zero-result reads as "that company/role
    // doesn't exist" rather than "this specific query didn't match." Say so
    // explicitly rather than let an empty list speak for itself.
    //
    // When BOTH query and location are set, a zero result's real cause could be
    // either one (confirmed live: a state name like "Texas" zeroes
    // location matching while the exact same query alone returns plenty)
    // — confidently blaming query alone, as the original fix did, is
    // actively misleading when location was the actual cause. Name
    // whichever filter(s) are actually active rather than guessing which
    // one is at fault.
    if (matchedTotal === 0 && (query || location || company || level || min_experience || employment_type)) {
      // Named, never echoed: a marking ("CUI//SP-EXPT …") sent as a query
      // used to come back in this note. The caller already knows
      // what it searched for.
      const activeFilters = [
        query ? "your keyword" : null,
        location ? "your location filter" : null,
        company ? "your company filter" : null,
        level || min_experience || employment_type ? "your level, experience, or employment-type filter" : null,
      ].filter(
        (f): f is string => f !== null,
      );
      const filterList = activeFilters.join(" and ");
      const requirementWordNote =
        query && /\b(?:itar|clearance|secret|ts\/?sci|polygraph|poly|citizen\w*|u\.?s\.? person|export)\b/i.test(query)
          ? " Requirement words like ITAR, clearance levels, or polygraph aren't matched as keywords (the keyword search covers role titles and companies) — use the clearance or itar_only filters instead, with a role type as the keyword."
          : "";
      const suggestion =
        query && location
          ? `Try removing one filter at a time to isolate which is causing the mismatch — a company name alone often won't match on keyword, and a state/region name (vs. an exact city) often won't match on location.`
          : location
            ? `Location matching looks for an exact city string (e.g. "Austin, TX"), not a state or region name — try the specific city, or drop the location filter to browse all locations.`
            : `A company name alone often won't match — try a role type instead (e.g. "autonomy engineer" or "manufacturing engineer"), drop the query to browse everything in this industry, or check get_company_profile for that company directly. A real company can still have zero live postings right now even when it's actively hiring elsewhere.`;
      // Searches for well-known defense employers returned zero results with
      // no signal that this tool's universe is one talent network's roster,
      // not the defense-tech market — a reader could reasonably conclude a
      // company simply has no openings. Generic on purpose: this doesn't
      // assert any specific company is absent from the network.
      const scopeNote =
        "This searches only companies in the a16z speedrun Talent Network — an employer outside that network won't appear here at all, however it's searched.";
      notes.push(`No postings matched ${filterList} at all.${requirementWordNote} ${suggestion} ${scopeNote}`);
    } else if (roles.length === 0 && matchedTotal > 0 && filterNames.length > 0) {
      notes.push(
        nextCursor
          ? `None of the postings examined so far passed the ${filterNames.join(", ")} filter — continue with the cursor, or try loosening or removing it.`
          : `None of the matching postings passed the ${filterNames.join(", ")} filter — try loosening or removing it.`,
      );
    }

    return {
      roles: roles.map(({ summary, signals }) => ({
        id: summary.id,
        title: summary.title,
        company: summary.company,
        companySlug: summary.company_slug,
        url: summary.url,
        location: summary.location,
        remote: summary.remote,
        workplaceType: summary.workplace_type ?? null,
        compMin: summary.comp_min,
        compMax: summary.comp_max,
        compCurrency: summary.comp_currency,
        publishedAt: summary.published_at,
        requirementSignals: signals,
      })),
      matchedTotal,
      examined: { from: examinedFrom, to: examinedTo, count: examinedCount },
      nextCursor,
      requirementSignalsCheckedCount: signalsChecked,
      note: notes.join(" "),
      sources: [SPEEDRUN_SOURCE],
      disclaimer: DISCLAIMERS.statedVsInferred,
    };
  },
};
