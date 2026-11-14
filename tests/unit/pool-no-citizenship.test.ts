import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// The anonymous interest pool stops collecting and showing citizenship status.
// The contribute tool refuses it, the read tool never returns it, the store
// drops it from records written before the change, and
// scripts/strip-pool-citizenship.ts removes it from the stored records.

vi.mock("@/lib/speedrun/client", () => ({ getJob: vi.fn(), getCompany: vi.fn() }));

let testStore: import("@/lib/signal/store").SignalStore;
vi.mock("@/lib/signal/store", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/signal/store")>();
  return { ...actual, getSignalStore: () => testStore };
});

import { getJob } from "@/lib/speedrun/client";
import {
  InMemorySignalStore,
  MIN_CONTRIBUTORS,
  getAggregate,
  getReleasedAggregate,
  sanitizeContribution,
  type SignalStore,
} from "@/lib/signal/store";
import { stripEntry, planListRewrite, stripPoolCitizenship, POOL_LIST_PATTERNS, type PoolListClient } from "@/lib/signal/strip-citizenship";
import { contributeAnonymousSignalTool } from "@/lib/tools/contribute-anonymous-signal";
import { getAggregatedSignalTool } from "@/lib/tools/get-aggregated-signal";

const CITIZENSHIP = /citizenship|us_citizen|green_card|protected_individual|not_us_person/i;

vi.mocked(getJob).mockImplementation(async (id: string) => ({
  job: {
    id,
    title: "Autonomy Engineer",
    company: "Acme Defense",
    company_slug: "acme-defense",
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
    stealth: false,
    tier: "a16z",
    status: "open",
    apply: null,
    description_text: "We build things.",
    labels: {},
  },
}));

// Records as a contribution written before that change sits in Redis: the
// client returns parsed objects, or the raw JSON string.
const LEGACY = [
  { clearance_level: "secret", citizenship_status: "us_citizen", years_experience_bucket: "3-5" },
  { clearance_level: "secret", citizenship_status: "green_card" },
  JSON.stringify({ clearance_level: "secret", citizenship_status: "not_us_person", years_experience_bucket: "3-5" }),
  { citizenship_status: "other_protected_individual" },
  { clearance_level: "secret", citizenship_status: "us_citizen", years_experience_bucket: "3-5" },
];

beforeEach(() => {
  testStore = new InMemorySignalStore();
});

describe("contribute_anonymous_signal no longer accepts citizenship status", () => {
  it("refuses a contribution that carries citizenship_status, alone or with other buckets", () => {
    const schema = contributeAnonymousSignalTool.inputSchema;
    expect(schema.safeParse({ role_id: "job-1", contribution: { citizenship_status: "us_citizen" } }).success).toBe(false);
    expect(
      schema.safeParse({ role_id: "job-1", contribution: { clearance_level: "secret", citizenship_status: "green_card" } }).success,
    ).toBe(false);
    // The two buckets that remain still work.
    expect(schema.safeParse({ role_id: "job-1", contribution: { clearance_level: "secret", years_experience_bucket: "0-2" } }).success).toBe(true);
  });

  it("does not mention citizenship in its description or its published input schema", () => {
    expect(contributeAnonymousSignalTool.description).not.toMatch(CITIZENSHIP);
    const jsonSchema = JSON.stringify(z.toJSONSchema(contributeAnonymousSignalTool.inputSchema as z.ZodType, { io: "input" }));
    expect(jsonSchema).not.toMatch(CITIZENSHIP);
    expect(jsonSchema).toContain("clearance_level");
  });

  it("stores nothing beyond the closed buckets even if a caller slips an extra field past the types", async () => {
    const store = new InMemorySignalStore();
    const sneaky = { clearance_level: "secret", citizenship_status: "us_citizen" } as unknown as Parameters<SignalStore["addContribution"]>[1];
    await store.addContribution({ roleId: "r1", companySlug: "acme" }, sneaky);
    expect(await store.getRawContributions("role", "r1")).toEqual([{ clearance_level: "secret" }]);
  });
});

describe("get_aggregated_signal no longer returns citizenship status", () => {
  it("has no citizenship key in its published output schema", () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(getAggregatedSignalTool.outputSchema as z.ZodType, { io: "output" }));
    expect(jsonSchema).not.toMatch(CITIZENSHIP);
    expect(jsonSchema).toContain("clearanceLevel");
  });

  it("shows no citizenship breakdown even when every stored record still carries the field", async () => {
    // A store whose raw read hands back legacy records untouched: the
    // aggregate and the tool must not build a citizenship breakdown from them.
    const legacyStore: SignalStore = {
      backend: "in-memory",
      addContribution: async () => {},
      tryAcquireCooldown: async () => true,
      getRawContributions: async () => LEGACY as unknown as Awaited<ReturnType<SignalStore["getRawContributions"]>>,
    };
    for (const agg of [await getAggregate(legacyStore, "role", "job-1"), await getReleasedAggregate(legacyStore, "role", "job-1")]) {
      expect(agg.meetsFloor).toBe(true);
      expect(Object.keys(agg)).not.toContain("citizenshipStatus");
      expect(JSON.stringify(agg)).not.toMatch(CITIZENSHIP);
    }
    testStore = legacyStore;
    const result = await getAggregatedSignalTool.handler({ role_id: "job-1" });
    expect(result.meetsFloor).toBe(true);
    expect(Object.keys(result.percentages ?? {}).sort()).toEqual(["clearanceLevel", "yearsExperience"]);
    expect(JSON.stringify(result)).not.toMatch(CITIZENSHIP);
  });
});

describe("the store ignores citizenship status in records already stored", () => {
  it("drops the field when reading legacy entries, keeping each record and the order", async () => {
    const store = new InMemorySignalStore();
    for (const entry of LEGACY) store.seedRawEntry({ roleId: "r1", companySlug: "acme" }, entry);
    const read = await store.getRawContributions("role", "r1");
    expect(read).toHaveLength(LEGACY.length);
    expect(JSON.stringify(read)).not.toMatch(CITIZENSHIP);
    expect(read[0]).toEqual({ clearance_level: "secret", years_experience_bucket: "3-5" });
    expect(read[3]).toEqual({});
    const agg = await getAggregate(store, "company", "acme");
    expect(agg.totalContributions).toBe(MIN_CONTRIBUTORS);
    expect(agg.clearanceLevel).toEqual({ otherBelowFloor: 4 });
  });

  it("sanitizeContribution keeps only the closed buckets with known values", () => {
    expect(sanitizeContribution({ clearance_level: "ts", citizenship_status: "us_citizen" })).toEqual({ clearance_level: "ts" });
    expect(sanitizeContribution('{"years_experience_bucket":"10+","citizenship_status":"green_card"}')).toEqual({ years_experience_bucket: "10+" });
    expect(sanitizeContribution({ clearance_level: "galactic" })).toEqual({});
    expect(sanitizeContribution("not json")).toEqual({});
    expect(sanitizeContribution(null)).toEqual({});
  });
});

/** An in-memory stand-in for the Upstash client, holding raw strings as Redis does. */
function fakeRedis(initial: Record<string, string[] | string>) {
  const data = new Map<string, string[] | string>(Object.entries(initial));
  const writes: { key: string; index: number; value: string }[] = [];
  const glob = (pattern: string) => new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  const client: PoolListClient = {
    // Two pages, to exercise the cursor loop.
    scan: async (cursor, { match }) => {
      const keys = [...data.keys()].filter((k) => glob(match).test(k)).sort();
      const half = Math.ceil(keys.length / 2);
      return cursor === "0" ? [keys.length > half ? "7" : "0", keys.slice(0, half)] : ["0", keys.slice(half)];
    },
    lrange: async (key) => {
      const value = data.get(key);
      if (!Array.isArray(value)) throw new Error("WRONGTYPE");
      return [...value];
    },
    lset: async (key, index, value) => {
      const list = data.get(key);
      if (!Array.isArray(list) || index >= list.length) throw new Error("ERR index out of range");
      list[index] = value;
      writes.push({ key, index, value });
      return "OK";
    },
  };
  return { client, data, writes };
}

describe("scripts/strip-pool-citizenship.ts transformation", () => {
  it("stripEntry removes only citizenship_status and leaves everything else as it was", () => {
    expect(stripEntry('{"clearance_level":"secret","citizenship_status":"us_citizen","years_experience_bucket":"3-5"}')).toEqual({
      kind: "stripped",
      payload: '{"clearance_level":"secret","years_experience_bucket":"3-5"}',
    });
    expect(stripEntry({ citizenship_status: "green_card" })).toEqual({ kind: "stripped", payload: "{}" });
    expect(stripEntry('{"clearance_level":"secret"}')).toEqual({ kind: "unchanged" });
    expect(stripEntry("{broken")).toEqual({ kind: "unreadable" });
    expect(stripEntry("[1,2]")).toEqual({ kind: "unreadable" });
  });

  it("plans writes only for the entries that change, by index", () => {
    const plan = planListRewrite(['{"clearance_level":"ts"}', '{"citizenship_status":"us_citizen","clearance_level":"none"}', "{broken"]);
    expect(plan).toEqual({ writes: [{ index: 1, payload: '{"clearance_level":"none"}' }], unreadable: 1 });
  });

  it("matches exactly the lists the store writes to, never the cooldown keys", () => {
    expect([...POOL_LIST_PATTERNS]).toEqual(["clearance-lens:signal:role:*", "clearance-lens:signal:company:*"]);
  });

  const fixture = () =>
    fakeRedis({
      "clearance-lens:signal:role:job-1": [
        '{"clearance_level":"secret","citizenship_status":"us_citizen"}',
        '{"clearance_level":"ts","years_experience_bucket":"6-10"}',
        '{"citizenship_status":"green_card"}',
      ],
      "clearance-lens:signal:role:job-2": ['{"clearance_level":"none"}'],
      "clearance-lens:signal:company:acme-defense": [
        '{"clearance_level":"secret","citizenship_status":"us_citizen"}',
        '{"clearance_level":"ts","years_experience_bucket":"6-10"}',
        '{"citizenship_status":"green_card"}',
        "{broken",
      ],
      "clearance-lens:signal:cooldown:job-1": "1",
      "some-other-app:key": ['{"citizenship_status":"us_citizen"}'],
    });

  it("a dry run counts what would change and writes nothing", async () => {
    const { client, writes, data } = fixture();
    const before = JSON.stringify([...data]);
    const summary = await stripPoolCitizenship(client, { apply: false });
    expect(summary).toEqual({ applied: false, listsScanned: 3, listsChanged: 2, entriesChanged: 4, entriesUnreadable: 1 });
    expect(writes).toEqual([]);
    expect(JSON.stringify([...data])).toBe(before);
  });

  it("--apply rewrites the field away, keeping every list's length and order, and a second run changes nothing", async () => {
    const { client, data } = fixture();
    await stripPoolCitizenship(client, { apply: true });
    expect(data.get("clearance-lens:signal:role:job-1")).toEqual([
      '{"clearance_level":"secret"}',
      '{"clearance_level":"ts","years_experience_bucket":"6-10"}',
      "{}",
    ]);
    expect(data.get("clearance-lens:signal:company:acme-defense")).toEqual([
      '{"clearance_level":"secret"}',
      '{"clearance_level":"ts","years_experience_bucket":"6-10"}',
      "{}",
      "{broken",
    ]);
    expect(data.get("clearance-lens:signal:role:job-2")).toEqual(['{"clearance_level":"none"}']);
    expect(data.get("clearance-lens:signal:cooldown:job-1")).toBe("1");
    expect(data.get("some-other-app:key")).toEqual(['{"citizenship_status":"us_citizen"}']);

    const again = await stripPoolCitizenship(client, { apply: true });
    expect(again.entriesChanged).toBe(0);
  });

  it("the summary carries counts only, never record contents", async () => {
    const { client } = fixture();
    const summary = await stripPoolCitizenship(client, { apply: true });
    expect(JSON.stringify(summary)).not.toMatch(CITIZENSHIP);
    expect(JSON.stringify(summary)).not.toMatch(/secret|job-1|acme/);
  });

  it("the script itself is a thin, dry-run-by-default wrapper over that transformation", () => {
    const script = fs.readFileSync(path.join(process.cwd(), "scripts/strip-pool-citizenship.ts"), "utf8");
    expect(script).toContain("stripPoolCitizenship");
    expect(script).toMatch(/process\.argv\.includes\("--apply"\)/);
  });
});

describe("the /try playground no longer offers or shows citizenship in the pool tabs", () => {
  const page = fs.readFileSync(path.join(process.cwd(), "app/try/page.tsx"), "utf8");
  const types = fs.readFileSync(path.join(process.cwd(), "lib/try-tool-types.ts"), "utf8");

  it("has no citizenship field on the Contribute signal form and no citizenship row on the Aggregated signal tab", () => {
    expect(page).not.toContain('id="signal-citizenship"');
    expect(page).not.toContain("percentages.citizenshipStatus");
  });

  it("its types for the two pool tools carry no citizenship field", () => {
    const contribution = /export interface SignalContributionFields \{[^}]*\}/.exec(types)?.[0] ?? "";
    expect(contribution).toContain("clearance_level");
    expect(contribution).not.toMatch(CITIZENSHIP);
    const aggregated = /export interface GetAggregatedSignalOutput \{[\s\S]*?\n\}/.exec(types)?.[0] ?? "";
    expect(aggregated).toContain("clearanceLevel");
    expect(aggregated).not.toMatch(CITIZENSHIP);
  });
});
