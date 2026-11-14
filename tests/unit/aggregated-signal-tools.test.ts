import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/speedrun/client", () => ({ getJob: vi.fn(), getCompany: vi.fn() }));

let testStore: import("@/lib/signal/store").InMemorySignalStore;
vi.mock("@/lib/signal/store", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/signal/store")>();
  return { ...actual, getSignalStore: () => testStore };
});

import { getJob, getCompany } from "@/lib/speedrun/client";
import { InMemorySignalStore, MIN_CONTRIBUTORS, COOLDOWN_MS, getAggregate } from "@/lib/signal/store";
import { contributeAnonymousSignalTool } from "@/lib/tools/contribute-anonymous-signal";
import { getAggregatedSignalTool } from "@/lib/tools/get-aggregated-signal";

beforeEach(() => {
  testStore = new InMemorySignalStore();
  jobsById.clear();
});

// mockImplementation keyed by id (not mockResolvedValue, which sets a
// single persistent default regardless of the id argument passed in) --
// needed so two different job ids registered via two mockJob() calls in
// the same test each resolve by their own id, instead of the later call's
// response silently winning for every subsequent call regardless of which
// id was actually requested.
type MockedJobResponse = Awaited<ReturnType<typeof getJob>>;
const jobsById = new Map<string, MockedJobResponse>();
vi.mocked(getJob).mockImplementation(async (id: string) => {
  const found = jobsById.get(id);
  if (!found) throw new Error(`mockJob() was never called for id "${id}"`);
  return found;
});

function mockJob(id: string, companySlug: string | null = "acme-defense") {
  jobsById.set(id, {
    job: {
      id,
      title: "Autonomy Engineer",
      company: "Acme Defense",
      company_slug: companySlug,
      company_url: "https://x",
      url: "https://x/jobs/" + id,
      location: "Reston, VA",
      remote: false,
      function: "engineering",
      seniority: "mid",
      comp_min: null,
      comp_max: null,
      comp_currency: null,
      comp_period: null,
      published_at: "2026-01-01T00:00:00Z",
      stealth: companySlug === null,
      tier: "a16z",
      status: "open",
      apply: null,
      description_text: "We build things.",
      labels: {},
    },
  });
}

describe("contribute_anonymous_signal", () => {
  it("records a contribution and confirms it, with an output shape that has no field for any candidate identifier", async () => {
    mockJob("job-1");
    const result = await contributeAnonymousSignalTool.handler({
      role_id: "job-1",
      contribution: { clearance_level: "secret" },
    });
    expect(result.recorded).toBe(true);
    // The OutputSchema itself only has recorded/roleTitle/company/sources/
    // disclaimer -- nothing shaped to hold a name, contact info, or any
    // other per-candidate identifier.
    expect(Object.keys(result).sort()).toEqual(["company", "disclaimer", "recorded", "roleTitle", "sources"]);
  });

  // Regression: with no accounts, nothing stopped one script from pushing a
  // role's pool from 0 to 10 contributions in under 2 seconds. This cooldown
  // directly defeats that exact burst pattern.
  it("rejects a second contribution to the same role within the cooldown window, without throwing an error", async () => {
    mockJob("job-1");
    const first = await contributeAnonymousSignalTool.handler({
      role_id: "job-1",
      contribution: { clearance_level: "secret" },
    });
    expect(first.recorded).toBe(true);

    const second = await contributeAnonymousSignalTool.handler({
      role_id: "job-1",
      contribution: { clearance_level: "secret" },
    });
    expect(second.recorded).toBe(false);
    expect(second.disclaimer).toMatch(/not recorded/i);

    // The rejected attempt must not have been silently counted anyway — read
    // from the store itself, since the tool reports no count below the floor.
    const agg = await getAggregate(testStore, "role", "job-1");
    expect(agg.totalContributions).toBe(1);
    expect((await getAggregatedSignalTool.handler({ role_id: "job-1" })).contributionsReflected).toBeNull();
  });

  it("allows a new contribution once the cooldown window has passed", async () => {
    mockJob("job-1");
    await contributeAnonymousSignalTool.handler({ role_id: "job-1", contribution: { clearance_level: "secret" } });

    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(COOLDOWN_MS);
      const afterCooldown = await contributeAnonymousSignalTool.handler({
        role_id: "job-1",
        contribution: { clearance_level: "secret" },
      });
      expect(afterCooldown.recorded).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a different role's cooldown is independent -- contributing to one role never blocks another", async () => {
    mockJob("job-1");
    mockJob("job-2");
    await contributeAnonymousSignalTool.handler({ role_id: "job-1", contribution: { clearance_level: "secret" } });
    const result = await contributeAnonymousSignalTool.handler({
      role_id: "job-2",
      contribution: { clearance_level: "secret" },
    });
    expect(result.recorded).toBe(true);
  });

  it("rejects a call with no buckets at all", () => {
    const parsed = contributeAnonymousSignalTool.inputSchema.safeParse({ role_id: "job-1", contribution: {} });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown contribution key rather than silently dropping it", () => {
    const parsed = contributeAnonymousSignalTool.inputSchema.safeParse({
      role_id: "job-1",
      contribution: { favorite_color: "blue" },
    });
    expect(parsed.success).toBe(false);
  });

  it("notes the role-only scope (no company-wide rollup) for a stealth posting with no company slug", async () => {
    mockJob("stealth-job", null);
    const result = await contributeAnonymousSignalTool.handler({
      role_id: "stealth-job",
      contribution: { clearance_level: "secret" },
    });
    expect(result.disclaimer).toMatch(/stealth listing/i);
  });
});

describe("get_aggregated_signal", () => {
  it("rejects a call with both role_id and company_slug", () => {
    expect(
      getAggregatedSignalTool.inputSchema.safeParse({ role_id: "job-1", company_slug: "acme" }).success,
    ).toBe(false);
  });

  it("rejects a call with neither", () => {
    expect(getAggregatedSignalTool.inputSchema.safeParse({}).success).toBe(false);
  });

  it("reports meetsFloor:false and no percentages before MIN_CONTRIBUTORS", async () => {
    mockJob("job-1");
    await contributeAnonymousSignalTool.handler({ role_id: "job-1", contribution: { clearance_level: "secret" } });

    const result = await getAggregatedSignalTool.handler({ role_id: "job-1" });
    expect(result.meetsFloor).toBe(false);
    expect(result.percentages).toBeNull();
    expect(result.disclaimer).toMatch(/fewer than 5/i);
  });

  it("reports rounded percentages once MIN_CONTRIBUTORS is reached for a role", async () => {
    mockJob("job-1");
    vi.useFakeTimers();
    try {
      for (let i = 0; i < MIN_CONTRIBUTORS; i++) {
        // Each role has a short anti-burst cooldown -- advance past it between
        // contributions so this test exercises aggregation, not the cooldown
        // (which has its own dedicated test).
        if (i > 0) await vi.advanceTimersByTimeAsync(COOLDOWN_MS);
        await contributeAnonymousSignalTool.handler({ role_id: "job-1", contribution: { clearance_level: "secret" } });
      }
    } finally {
      vi.useRealTimers();
    }
    const result = await getAggregatedSignalTool.handler({ role_id: "job-1" });
    expect(result.meetsFloor).toBe(true);
    expect(result.percentages?.clearanceLevel).toEqual({ secret: 100 });
    expect(result.scope).toEqual({ type: "role", label: "Autonomy Engineer at Acme Defense" });
  });

  it("aggregates at the company level across multiple roles there", async () => {
    mockJob("job-1", "acme-defense");
    mockJob("job-2", "acme-defense");
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) {
        if (i > 0) await vi.advanceTimersByTimeAsync(COOLDOWN_MS);
        await contributeAnonymousSignalTool.handler({ role_id: "job-1", contribution: { clearance_level: "secret" } });
      }
      // A different role_id has its own, independent cooldown bucket, so
      // this one starts fresh without needing to advance time again.
      for (let i = 0; i < 2; i++) {
        if (i > 0) await vi.advanceTimersByTimeAsync(COOLDOWN_MS);
        await contributeAnonymousSignalTool.handler({ role_id: "job-2", contribution: { clearance_level: "secret" } });
      }
    } finally {
      vi.useRealTimers();
    }
    vi.mocked(getCompany).mockResolvedValueOnce({
      company: {
        slug: "acme-defense",
        name: "Acme Defense",
        url: "https://x",
        tier: "a16z",
        cohort: null,
        open_roles: 2,
        location: null,
        industries: [],
        blurb: null,
        logo: null,
        labels: {},
        jobs: [],
      },
    });

    const result = await getAggregatedSignalTool.handler({ company_slug: "acme-defense" });
    expect(result.contributionsReflected).toBe(5);
    expect(result.meetsFloor).toBe(true);
    expect(result.scope).toEqual({ type: "company", label: "Acme Defense" });
  });

  it("surfaces the non-durable-storage caveat when running on the in-memory fallback", async () => {
    mockJob("job-1");
    const result = await getAggregatedSignalTool.handler({ role_id: "job-1" });
    expect(result.disclaimer).toMatch(/non-durable/i);
  });
});

// Above the floor, the exact total plus rounded percentages let a reader take
// one read before and one after a single new contribution and recover that
// contributor's buckets. This plays the attack.
describe("get_aggregated_signal: two reads can't isolate the newest contributor", () => {
  const scope = { roleId: "job-1", companySlug: "acme-defense" };
  type C = import("@/lib/signal/store").SignalContribution;
  const KNOWN: C = { clearance_level: "secret", years_experience_bucket: "3-5" };
  const VICTIM: C = { clearance_level: "ts_sci", years_experience_bucket: "10+" };
  const OTHER: C = { clearance_level: "ts", years_experience_bucket: "6-10" };

  async function seed(contributions: C[]) {
    for (const c of contributions) await testStore.addContribution(scope, c);
  }
  const read = () => getAggregatedSignalTool.handler({ role_id: "job-1" });

  it("the read after one new contribution is identical to the read before it", async () => {
    mockJob("job-1");
    await seed([KNOWN, KNOWN, KNOWN, KNOWN, KNOWN]);
    const before = await read();
    expect(before.meetsFloor).toBe(true);

    await seed([VICTIM]);
    const after = await read();
    // The attack needs any difference between the two reads; there is none.
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toMatch(/ts_sci|10\+/);
    expect(after.totalContributionsBand).toEqual({ atLeast: 5, fewerThan: 10 });
  });

  it("the output changes only when a step of five completes", async () => {
    mockJob("job-1");
    await seed([KNOWN, KNOWN, KNOWN, KNOWN, KNOWN]);
    let previous = await read();
    for (let n = 6; n <= 15; n++) {
      await seed([n % 2 === 0 ? VICTIM : OTHER]);
      const current = await read();
      if (n % 5 === 0) expect(current.contributionsReflected).toBe(n);
      else expect(current, `n=${n}`).toEqual(previous);
      previous = current;
    }
  });

  it("when a step completes, the change is an aggregate of five: which one was the newcomer can't be told", async () => {
    mockJob("job-1");
    // World A: the victim is the 6th contributor; world B: the 9th. Same five
    // people in the step, different order — the reader sees the same thing.
    await seed([KNOWN, KNOWN, KNOWN, KNOWN, KNOWN, VICTIM, OTHER, OTHER, OTHER, OTHER]);
    const worldA = await read();
    testStore = new InMemorySignalStore();
    await seed([KNOWN, KNOWN, KNOWN, KNOWN, KNOWN, OTHER, OTHER, OTHER, VICTIM, OTHER]);
    const worldB = await read();
    expect(worldA).toEqual(worldB);
    // And a lone newcomer's bucket (1 of 10) never shows on its own: it is
    // folded into otherBelowFloor with anything else under five.
    expect(worldA.percentages?.clearanceLevel).not.toHaveProperty("ts_sci");
  });

  it("percentages are rounded to the nearest 5 and the total is a band, never the exact count", async () => {
    mockJob("job-1");
    await seed([KNOWN, KNOWN, KNOWN, KNOWN, KNOWN, KNOWN, OTHER, OTHER, OTHER, OTHER, OTHER, OTHER, OTHER]);
    const result = await read();
    expect(result.contributionsReflected).toBe(10);
    expect(result.totalContributionsBand).toEqual({ atLeast: 10, fewerThan: 15 });
    expect(result).not.toHaveProperty("totalContributions");
    for (const breakdown of Object.values(result.percentages ?? {})) {
      for (const pct of Object.values(breakdown ?? {})) expect(pct % 5).toBe(0);
    }
  });
});
