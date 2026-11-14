import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/speedrun/client", () => ({
  searchJobs: vi.fn(),
  getJob: vi.fn(),
}));

import { searchJobs, getJob } from "@/lib/speedrun/client";
import { searchDefenseRolesTool } from "@/lib/tools/search-defense-roles";
import type { SpeedrunJobSummary, SpeedrunJobDetailResponse } from "@/lib/speedrun/types";

function summary(overrides: Partial<SpeedrunJobSummary> = {}): SpeedrunJobSummary {
  return {
    id: "job-1",
    title: "Engineer",
    company: "Acme Defense",
    company_slug: "acme-defense",
    company_url: "https://speedrun-talent-network.com/companies/acme-defense",
    url: "https://speedrun-talent-network.com/jobs/job-1",
    location: "Reston, VA",
    workplace_type: "Onsite",
    employment_type: "FullTime",
    function: "engineering",
    seniority: "mid",
    remote: false,
    comp_min: null,
    comp_max: null,
    comp_currency: null,
    comp_period: null,
    published_at: "2026-01-01T00:00:00Z",
    stealth: false,
    tier: "a16z",
    cohort: null,
    ...overrides,
  };
}

function detail(descriptionText: string, overrides: Partial<SpeedrunJobSummary> = {}): SpeedrunJobDetailResponse {
  // SpeedrunJobDetail genuinely has no `cohort` field (see lib/speedrun/types.ts) —
  // omit it explicitly when spreading from summary(), which does have one.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded on purpose
  const { cohort: _cohort, ...summaryWithoutCohort } = summary(overrides);
  return {
    job: {
      ...summaryWithoutCohort,
      status: "open",
      apply: null,
      description_text: descriptionText,
      labels: {},
    },
  };
}

describe("search_defense_roles", () => {
  it("scans pages until has_more is false and returns requirement signals per role", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 1,
      page: 0,
      page_size: 50,
      total_pages: 1,
      has_more: false,
      next_page: null,
      jobs: [summary({ id: "job-1" })],
    });
    vi.mocked(getJob).mockResolvedValueOnce(detail("Must be a U.S. Citizen. Active Secret clearance required."));

    const result = await searchDefenseRolesTool.handler({ limit: 10 });
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].requirementSignals.map((s) => s.value)).toEqual(
      expect.arrayContaining(["us_citizen_required", "secret"]),
    );
    expect(result.sources.length).toBeGreaterThan(0);
  });

  // Regression (root-caused against the live upstream, which intermittently
  // returns HTTP 500 "query failed" on individual pages): a later page failing
  // used to fail the whole call and discard every result already fetched.
  it("keeps earlier pages' results when a later page fails upstream, and says the scan was cut short", async () => {
    vi.mocked(searchJobs)
      .mockResolvedValueOnce({
        total: 100,
        page: 0,
        page_size: 50,
        total_pages: 2,
        has_more: true,
        next_page: 1,
        jobs: [summary({ id: "job-1" })],
      })
      .mockRejectedValueOnce(new Error("Speedrun API returned 500"));
    vi.mocked(getJob).mockResolvedValueOnce(detail("Build autonomy software."));

    const result = await searchDefenseRolesTool.handler({ limit: 10 });
    expect(result.roles.map((r) => r.id)).toEqual(["job-1"]);
    expect(result.note).toMatch(/returned an error partway through this scan/i);
  });

  it("only the first page retries — a later page gets one attempt, since losing it now degrades gracefully", async () => {
    vi.mocked(searchJobs)
      .mockResolvedValueOnce({
        total: 100,
        page: 0,
        page_size: 50,
        total_pages: 2,
        has_more: true,
        next_page: 1,
        jobs: [summary({ id: "job-1" })],
      })
      .mockResolvedValueOnce({
        total: 100,
        page: 1,
        page_size: 50,
        total_pages: 2,
        has_more: false,
        next_page: null,
        jobs: [],
      });
    vi.mocked(getJob).mockResolvedValueOnce(detail("Build autonomy software."));

    const before = Date.now();
    await searchDefenseRolesTool.handler({ limit: 10 });
    const calls = vi.mocked(searchJobs).mock.calls;
    const first = calls.at(-2)?.[1];
    const later = calls.at(-1)?.[1];
    expect(first?.maxAttempts).toBeUndefined(); // first page: default retry budget
    expect(later?.maxAttempts).toBe(1); // later page: one attempt
    // Both carry the same page-scan deadline down to the fetch itself.
    expect(first?.deadline).toBe(later?.deadline);
    expect(first!.deadline! - before).toBeGreaterThanOrEqual(7900);
    expect(first!.deadline! - before).toBeLessThanOrEqual(8100);
  });

  it("counts only the roles whose requirement signals actually loaded, and says how many didn't", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 3, page: 0, page_size: 50, total_pages: 1, has_more: false, next_page: null,
      jobs: [summary({ id: "job-1" }), summary({ id: "job-2" }), summary({ id: "job-3" })],
    });
    vi.mocked(getJob).mockImplementation(async (id: string) => {
      if (id === "job-2") throw new Error("Speedrun API unreachable or too slow to respond");
      return detail("Build autonomy software.", { id });
    });
    const result = await searchDefenseRolesTool.handler({ limit: 10 });
    expect(result.matchedTotal).toBe(3);
    expect(result.requirementSignalsCheckedCount).toBe(2); // was 3 — counted the failure as checked
    expect(result.examined).toEqual({ from: 1, to: 3, count: 2 });
    expect(result.roles.map((r) => r.id)).toEqual(["job-1", "job-3"]);
    expect(result.note).toMatch(/couldn't be loaded in time for 1 of the 3 postings/);
  });

  it("passes the detail phase a deadline within the overall search budget", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 1, page: 0, page_size: 50, total_pages: 1, has_more: false, next_page: null, jobs: [summary({ id: "job-1" })],
    });
    vi.mocked(getJob).mockResolvedValueOnce(detail("Build autonomy software."));
    const before = Date.now();
    await searchDefenseRolesTool.handler({ limit: 10 });
    const options = vi.mocked(getJob).mock.calls.at(-1)?.[1];
    expect(options?.deadline).toBeDefined();
    expect(options!.deadline! - before).toBeLessThanOrEqual(13100);
  });

  it("still surfaces a real error when the FIRST page fails — there's nothing to return without it", async () => {
    vi.mocked(searchJobs).mockRejectedValueOnce(new Error("Speedrun API returned 500"));
    await expect(searchDefenseRolesTool.handler({ limit: 10 })).rejects.toThrow();
  });

  it("zero-result guidance states that only the a16z speedrun network's companies are searched", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 0,
      page: 0,
      page_size: 50,
      total_pages: 0,
      has_more: false,
      next_page: null,
      jobs: [],
    });
    const result = await searchDefenseRolesTool.handler({ query: "some prime contractor", limit: 10 });
    expect(result.note).toMatch(/only companies in the a16z speedrun Talent Network/i);
  });

  it("stops scanning at the page cap even if has_more stays true (the historical 159-of-209 pagination bug this guards against)", async () => {
    vi.mocked(searchJobs).mockImplementation(async ({ page }) => ({
      total: 1000,
      page: page ?? 0,
      page_size: 50,
      total_pages: 20,
      has_more: true,
      next_page: (page ?? 0) + 1,
      jobs: [summary({ id: `job-${page}` })],
    }));
    vi.mocked(getJob).mockImplementation(async (id: string) => detail("No requirements stated.", { id }));

    await searchDefenseRolesTool.handler({ limit: 25 });
    // 4 page fetches (MAX_PAGES_SCANNED), not an unbounded/infinite loop.
    expect(vi.mocked(searchJobs)).toHaveBeenCalledTimes(4);
  });

  // Regression: up to 4 sequential page fetches, each with its own
  // retry/backoff budget, could compound to a 20+ second worst case on a
  // transient upstream slowdown (reproduced live: 22.4s and 11.0s outliers
  // against a sub-400ms baseline). A deadline on the page-scan loop bounds
  // this.
  it("stops scanning early and notes it when the upstream responds too slowly (deadline guard)", async () => {
    let callCount = 0;
    const dateNowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      callCount++;
      // Call 1 computes the deadline (returns 0 -> deadline = 8000ms). Every
      // call after that simulates 5 seconds having passed since the
      // previous page fetch, so the loop's 2nd deadline check (10000ms) is
      // already past it.
      return callCount === 1 ? 0 : (callCount - 1) * 5000;
    });
    try {
      vi.mocked(searchJobs).mockImplementation(async ({ page }) => ({
        total: 1000,
        page: page ?? 0,
        page_size: 50,
        total_pages: 20,
        has_more: true,
        next_page: (page ?? 0) + 1,
        jobs: [summary({ id: `job-${page}` })],
      }));
      vi.mocked(getJob).mockImplementation(async (id: string) => detail("No requirements stated.", { id }));

      const result = await searchDefenseRolesTool.handler({ limit: 25 });
      expect(vi.mocked(searchJobs)).toHaveBeenCalledTimes(1);
      expect(result.note).toContain("responded slowly");
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("filters by clearance level using detected signals, not upstream facets (upstream has no clearance param)", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 2,
      page: 0,
      page_size: 50,
      total_pages: 1,
      has_more: false,
      next_page: null,
      jobs: [summary({ id: "secret-job" }), summary({ id: "no-clearance-job" })],
    });
    vi.mocked(getJob).mockImplementation(async (id: string) =>
      id === "secret-job"
        ? detail("Requires an active Secret clearance.", { id })
        : detail("Build dashboards, no clearance needed.", { id }),
    );

    const result = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10 });
    expect(result.roles.map((r) => r.id)).toEqual(["secret-job"]);
  });

  // Regression: only the first MAX_DETAIL_FETCHES (25) postings per call get a
  // detail fetch and requirement-signal check -- previously that gap was
  // disclosed only in `note`'s prose. rolesScanned has since been replaced with
  // matchedTotal, examined, and nextCursor.
  it("reports the checked count separately from the matched total when more postings match than were detail-checked", async () => {
    const jobs = Array.from({ length: 40 }, (_, i) => summary({ id: `job-${i}` }));
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 40,
      page: 0,
      page_size: 50,
      total_pages: 1,
      has_more: false,
      next_page: null,
      jobs,
    });
    vi.mocked(getJob).mockImplementation(async (id: string) => detail("General engineering role.", { id }));

    const result = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 25 });
    expect(result.matchedTotal).toBe(40);
    expect(result.requirementSignalsCheckedCount).toBe(25);
    expect(result.requirementSignalsCheckedCount).toBeLessThan(result.matchedTotal);
    expect(result.examined).toEqual({ from: 1, to: 25, count: 25 });
    expect(result.nextCursor).toBe("25");
  });

  it("tolerates an individual job-detail fetch failure without failing the whole search", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 2,
      page: 0,
      page_size: 50,
      total_pages: 1,
      has_more: false,
      next_page: null,
      jobs: [summary({ id: "ok-job" }), summary({ id: "broken-job" })],
    });
    vi.mocked(getJob).mockImplementation(async (id: string) => {
      if (id === "broken-job") throw new Error("boom");
      return detail("No requirements stated.", { id });
    });

    const result = await searchDefenseRolesTool.handler({ limit: 10 });
    expect(result.roles.map((r) => r.id)).toEqual(["ok-job"]);
  });

  it("a zero-result query gets actionable broadening guidance, not a bare empty list (regression — a real company name routinely returns zero hits with no explanation)", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 0,
      page: 0,
      page_size: 50,
      total_pages: 0,
      has_more: false,
      next_page: null,
      jobs: [],
    });

    const result = await searchDefenseRolesTool.handler({ query: "Shield AI", limit: 10 });
    expect(result.roles).toEqual([]);
    // Names the filter without echoing it back (a query can carry a marking or
    // PII).
    expect(result.note).toContain("your keyword");
    expect(result.note).not.toContain("Shield AI");
    expect(result.note.toLowerCase()).toContain("role type");
    expect(result.note).toContain("get_company_profile");
  });

  // Regression: a location-only zero-result used to be blamed on the keyword
  // (e.g. "No postings matched \"engineer\"") even when the keyword was never
  // the actual cause — reproduced live: filtering on a state name like "Texas"
  // zeroes results while the identical keyword alone returns plenty.
  it("a zero-result caused by location alone blames the location, not an absent or unrelated keyword", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 0,
      page: 0,
      page_size: 50,
      total_pages: 0,
      has_more: false,
      next_page: null,
      jobs: [],
    });

    const result = await searchDefenseRolesTool.handler({ location: "Texas", limit: 10 });
    expect(result.note).toContain("your location filter");
    expect(result.note).not.toContain("Texas");
    expect(result.note).not.toContain("your keyword");
    expect(result.note.toLowerCase()).toContain("exact city string");
  });

  it("a zero-result with BOTH a keyword and a location names both as possible causes, rather than confidently blaming just one", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 0,
      page: 0,
      page_size: 50,
      total_pages: 0,
      has_more: false,
      next_page: null,
      jobs: [],
    });

    const result = await searchDefenseRolesTool.handler({ query: "engineer", location: "Texas", limit: 10 });
    expect(result.note).toContain("your keyword and your location filter");
    expect(result.note.toLowerCase()).toContain("one filter at a time");
  });

  it("results that exist but are all filtered out by clearance/itar_only get their own distinct guidance (not the zero-match message)", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({
      total: 1,
      page: 0,
      page_size: 50,
      total_pages: 1,
      has_more: false,
      next_page: null,
      jobs: [summary({ id: "no-clearance-job" })],
    });
    vi.mocked(getJob).mockResolvedValueOnce(detail("Build dashboards, no clearance needed.", { id: "no-clearance-job" }));

    const result = await searchDefenseRolesTool.handler({ clearance: "ts_sci", limit: 10 });
    expect(result.roles).toEqual([]);
    expect(result.note).not.toContain("No postings matched");
    expect(result.note.toLowerCase()).toContain("loosening or removing it");
  });

  it("tells someone searching a requirement word (ITAR, polygraph) to use the filters instead", async () => {
    vi.mocked(searchJobs).mockResolvedValueOnce({ total: 0, page: 0, page_size: 50, total_pages: 0, has_more: false, next_page: null, jobs: [] });
    const result = await searchDefenseRolesTool.handler({ query: "ITAR", limit: 10 });
    expect(result.note).toMatch(/use the clearance or itar_only filters/);
  });
});

// A filtered search once checked at most 25 postings with no way to continue
// (live: "software engineer" + clearance "none" returned 2 roles out of 200
// scanned), and the upstream's level, experience, employment-type, company and
// page filters weren't exposed.
describe("search_defense_roles: upstream filters, and a cursor that covers every match", () => {
  function pagedUpstream(total: number) {
    const all = Array.from({ length: total }, (_, i) => summary({ id: `job-${i}` }));
    vi.mocked(searchJobs).mockImplementation(async ({ page = 0 }) => {
      const jobs = all.slice(page * 50, page * 50 + 50);
      const hasMore = (page + 1) * 50 < total;
      return { total, page, page_size: 50, total_pages: Math.ceil(total / 50), has_more: hasMore, next_page: hasMore ? page + 1 : null, jobs };
    });
  }
  const SECRET = new Set(["job-10", "job-30", "job-55"]);
  function detailBySecret() {
    vi.mocked(getJob).mockImplementation(async (id: string) =>
      detail(SECRET.has(id) ? "Requires an active Secret clearance." : "Build dashboards, no clearance needed.", { id }),
    );
  }

  it("passes level, experience, employment type, company and remote to the upstream", async () => {
    pagedUpstream(1);
    detailBySecret();
    await searchDefenseRolesTool.handler({
      query: "software",
      level: ["new_grad", "junior"],
      min_experience: ["0", "under_1"],
      employment_type: ["internship"],
      company: "Anduril Industries",
      remote: true,
      limit: 10,
    });
    expect(vi.mocked(searchJobs).mock.calls.at(-1)?.[0]).toMatchObject({
      q: "software",
      lvl: "new_grad,junior",
      yoe: "0,under_1",
      eng: "internship",
      company: "Anduril Industries",
      remote: true,
      industry: "defense_space",
      scope: "portfolio",
      page: 0,
    });
  });

  it("a filtered search, continued by cursor, examines every matching posting and finds every match", async () => {
    pagedUpstream(60);
    detailBySecret();
    const first = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10 });
    expect(first.roles.map((r) => r.id)).toEqual(["job-10"]);
    expect(first.matchedTotal).toBe(60);
    expect(first.examined).toEqual({ from: 1, to: 25, count: 25 });
    expect(first.nextCursor).toBe("25");
    expect(first.note).toMatch(/60 postings match your search terms; this call examined postings 1–25 \(25 checked against the clearance filter\) and returned 1\. 35 not yet examined — call again with cursor "25"/);

    const second = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10, cursor: first.nextCursor! });
    expect(second.roles.map((r) => r.id)).toEqual(["job-30"]);
    expect(second.examined).toEqual({ from: 26, to: 50, count: 25 });
    expect(second.nextCursor).toBe("50");

    const third = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10, cursor: second.nextCursor! });
    expect(third.roles.map((r) => r.id)).toEqual(["job-55"]);
    expect(third.examined).toEqual({ from: 51, to: 60, count: 10 });
    expect(third.nextCursor).toBeNull();
    expect(third.note).toMatch(/Every matching posting has now been examined/);
  });

  it("when more matches than limit turn up, the cursor stops after the last one returned, so none are skipped", async () => {
    pagedUpstream(30);
    vi.mocked(getJob).mockImplementation(async (id: string) => detail("Requires an active Secret clearance.", { id }));
    const first = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10 });
    expect(first.roles).toHaveLength(10);
    expect(first.examined).toEqual({ from: 1, to: 10, count: 10 });
    expect(first.nextCursor).toBe("10");
    const second = await searchDefenseRolesTool.handler({ clearance: "secret", limit: 10, cursor: "10" });
    expect(second.roles[0].id).toBe("job-10");
  });

  it("page starts the scan at that upstream page", async () => {
    pagedUpstream(120);
    detailBySecret();
    const result = await searchDefenseRolesTool.handler({ page: 1, limit: 5 });
    expect(vi.mocked(searchJobs).mock.calls.at(-1)?.[0]).toMatchObject({ page: 1 });
    expect(result.roles.map((r) => r.id)).toEqual(["job-50", "job-51", "job-52", "job-53", "job-54"]);
    expect(result.examined).toEqual({ from: 51, to: 55, count: 5 });
    expect(result.nextCursor).toBe("55");
  });

  it("refuses a cursor that isn't one this tool returned", () => {
    expect(searchDefenseRolesTool.inputSchema.safeParse({ cursor: "abc" }).success).toBe(false);
    expect(searchDefenseRolesTool.inputSchema.safeParse({ cursor: "25" }).success).toBe(true);
    expect(searchDefenseRolesTool.inputSchema.safeParse({ level: ["principal"] }).success).toBe(false);
  });

  it("a zero-result caused by a company filter names that filter, without echoing it", async () => {
    pagedUpstream(0);
    const result = await searchDefenseRolesTool.handler({ company: "Not A Real Co", limit: 10 });
    expect(result.note).toContain("your company filter");
    expect(result.note).not.toContain("Not A Real Co");
  });
});
