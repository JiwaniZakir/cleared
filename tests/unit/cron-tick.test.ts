// @vitest-environment node
/**
 * S1: the daily cron route. Only `Authorization: Bearer ${CRON_SECRET}` runs
 * it; with every job still a stub it runs none of them and touches no database.
 * runTick isolates a failing job.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/tick/route";
import { DAILY_JOBS, runTick } from "@/lib/jobs/tick";
import type { Job } from "@/lib/jobs/types";

const SECRET = "test-only-cron-secret";

function call(authorization?: string) {
  return GET(new Request("http://localhost/api/cron/tick", { headers: authorization ? { authorization } : {} }));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/tick", () => {
  it("is 401 without CRON_SECRET configured, whatever the caller sends", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
  });

  it("is 401 with no header or the wrong secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call(SECRET)).status).toBe(401);
  });

  it("runs the tick with the right secret; every job is a stub today, so none runs", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jobs).toEqual(DAILY_JOBS.map((j) => ({ job: j.name, status: "not_enabled" })));
    expect(DAILY_JOBS.map((j) => j.name)).toEqual(["outbox_drain", "judge_queue", "request_expiry", "offer_expiry", "bg_poll", "reminders", "retention_purge"]);
  });
});

describe("runTick", () => {
  it("runs enabled jobs in order and isolates a failure", async () => {
    const order: string[] = [];
    const job = (name: string, fail = false): Job => ({
      name,
      slice: "test",
      enabled: true,
      async run() {
        order.push(name);
        if (fail) throw new Error("boom");
        return { processed: 2, failed: 0 };
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await runTick({ now: new Date() }, [job("one"), job("two", true), job("three")]);
    spy.mockRestore();
    expect(order).toEqual(["one", "two", "three"]);
    expect(out).toEqual([
      { job: "one", status: "ok", processed: 2, failed: 0 },
      { job: "two", status: "error" },
      { job: "three", status: "ok", processed: 2, failed: 0 },
    ]);
  });
});
