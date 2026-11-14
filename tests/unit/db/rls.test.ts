// @vitest-environment node
/**
 * S1: separation is enforced by the database, and proven here on the embedded
 * Postgres (PGlite) with two orgs.
 *
 * - Each tenant table returns only the scoped org's rows; none when no org is
 *   set; a write naming another org is refused.
 * - The account plane returns only the scoped person's rows.
 * - The two documented second readers (a candidate's own applications and
 *   statements) work, and open nothing else.
 * - FORCE ROW LEVEL SECURITY applies to the owner role: with a non-superuser
 *   owner, the policies filter; without FORCE, the owner sees everything.
 * - Why the helpers SET LOCAL ROLE: PGlite's session user is a superuser,
 *   and superusers bypass row-level security in every Postgres.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { APP_DB_ROLE, enterOrgScope, withAccountTx, withOrgTx, withSystemTx, type Tx } from "@/lib/db/tx";
import { rowsOf } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import * as s from "@/lib/db/schema";
import { ACCOUNT_TABLES, GLOBAL_TABLES, RLS_TABLES, seedGlobal, seedOrgWorld, TENANT_TABLES, type OrgWorld } from "./fixtures";

let t: TestDb;
let A: OrgWorld;
let B: OrgWorld;
/** Candidate A also applied to org B: the cross-org row a candidate may read and org A may not. */
let crossApplicationId: string;

async function errorText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    const parts: string[] = [];
    let e: unknown = err;
    while (e instanceof Error) {
      parts.push(e.message);
      e = (e as { cause?: unknown }).cause;
    }
    return parts.join(" | ");
  }
  return "NO ERROR";
}

async function orgIdsIn(tx: Tx, table: string): Promise<string[]> {
  const col = table === "org" ? "id" : "org_id";
  return rowsOf<{ o: string | null }>(await tx.execute(sql.raw(`SELECT ${col}::text AS o FROM "${table}"`))).map((r) => r.o ?? "NULL");
}

async function countIn(tx: Tx, table: string): Promise<number> {
  return rowsOf<{ n: number }>(await tx.execute(sql.raw(`SELECT count(*)::int AS n FROM "${table}"`)))[0].n;
}

/** Rows per org as the superuser sees them (ground truth). */
async function superCount(table: string, orgId: string): Promise<number> {
  const col = table === "org" ? "id" : "org_id";
  return (await t.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}" WHERE ${col} = $1`, [orgId])).rows[0].n;
}

beforeAll(async () => {
  t = await createTestDb();
  A = await seedOrgWorld(t.db, "a");
  B = await seedOrgWorld(t.db, "b");
  await seedGlobal(t.db);
  crossApplicationId = newId();
  await t.db.insert(s.application).values({
    id: crossApplicationId,
    orgId: B.orgId,
    requisitionId: B.requisitionId,
    candidateAccountId: A.candidateAccountId,
    applicantName: "Fixture Candidate A",
    applicantEmail: "candidate-a@example.test",
    aiMode: "human_only",
  });
}, 60_000);

afterAll(async () => {
  await t?.close();
});

describe("tenant tables: one org's rows only", () => {
  it("the fixture put rows for both orgs in every tenant table and in org, notification and audit_event", async () => {
    for (const table of [...TENANT_TABLES, "org", "notification", "audit_event", "data_request"]) {
      expect(await superCount(table, A.orgId), table).toBeGreaterThan(0);
      expect(await superCount(table, B.orgId), table).toBeGreaterThan(0);
    }
  });

  it("with org A set, every tenant table returns exactly org A's rows", async () => {
    for (const table of [...TENANT_TABLES, "org"]) {
      const seen = await withOrgTx(A.orgId, (tx) => orgIdsIn(tx, table));
      expect(new Set(seen), table).toEqual(new Set([A.orgId]));
      expect(seen.length, table).toBe(await superCount(table, A.orgId));
    }
  });

  it("with org B set, every tenant table returns exactly org B's rows", async () => {
    for (const table of [...TENANT_TABLES, "org"]) {
      const seen = await withOrgTx(B.orgId, (tx) => orgIdsIn(tx, table));
      expect(new Set(seen), table).toEqual(new Set([B.orgId]));
      expect(seen.length, table).toBe(await superCount(table, B.orgId));
    }
  });

  it("with nothing set, every row-level-secured table returns no rows", async () => {
    const counts = await t.db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${APP_DB_ROLE}`));
      const out: Record<string, number> = {};
      for (const table of RLS_TABLES) out[table] = await countIn(tx, table);
      return out;
    });
    for (const table of RLS_TABLES) expect(counts[table], table).toBe(0);
  });

  it("the system scope opens no tenant table: jobs must loop org by org", async () => {
    for (const table of TENANT_TABLES) {
      expect(await withSystemTx((tx) => countIn(tx, table)), table).toBe(0);
    }
    // …but it can list the orgs to loop over.
    expect(new Set(await withSystemTx((tx) => orgIdsIn(tx, "org")))).toEqual(new Set([A.orgId, B.orgId]));
  });

  it("a row naming another org cannot be inserted", async () => {
    const msg = await errorText(
      withOrgTx(A.orgId, (tx) =>
        tx.insert(s.requirement).values({
          orgId: B.orgId,
          requisitionId: B.requisitionId,
          ordinal: 9,
          quote: "Injected across orgs",
          category: "qualification",
          priority: "nice",
          weight: 1,
        }),
      ),
    );
    expect(msg).toMatch(/row-level security/);
    expect(await superCount("requirement", B.orgId)).toBe(1);
  });

  it("a row cannot be moved to another org, and another org's rows cannot be touched", async () => {
    const moved = await errorText(withOrgTx(A.orgId, (tx) => tx.execute(sql`UPDATE requirement SET org_id = ${B.orgId} WHERE id = ${A.requirementId}`)));
    expect(moved).toMatch(/row-level security|violates foreign key/);
    const updated = await withOrgTx(A.orgId, async (tx) => {
      const r = await tx.update(s.requirement).set({ weight: 5 }).where(sql`id = ${B.requirementId}`).returning({ id: s.requirement.id });
      return r.length;
    });
    expect(updated).toBe(0);
    const deleted = await withOrgTx(A.orgId, async (tx) => (await tx.delete(s.offer).where(sql`org_id = ${B.orgId}`).returning({ id: s.offer.id })).length);
    expect(deleted).toBe(0);
    expect(await superCount("offer", B.orgId)).toBe(1);
  });
});

describe("account plane: one person's rows only", () => {
  it("a person sees their own account-plane rows and no one else's", async () => {
    for (const table of ACCOUNT_TABLES) {
      const col = table === "account" ? "id" : "account_id";
      const own = await withAccountTx(A.memberAccountId, async (tx) =>
        rowsOf<{ a: string }>(await tx.execute(sql.raw(`SELECT ${col}::text AS a FROM "${table}"`))).map((r) => r.a),
      );
      const expected = (await t.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}" WHERE ${col} = $1`, [A.memberAccountId])).rows[0].n;
      expect(own.length, table).toBe(expected);
      expect(new Set(own), table).toEqual(expected ? new Set([A.memberAccountId]) : new Set());
    }
  });

  it("an org scope shows its members' accounts (name and email, §2.3) and no other account", async () => {
    const ids = await withOrgTx(A.orgId, async (tx) => (await tx.select({ id: s.account.id }).from(s.account)).map((r) => r.id));
    expect(ids).toEqual([A.memberAccountId]);
  });

  it("an org scope shows no tokens, sessions, sign-in links or profile evidence", async () => {
    for (const table of ["email_token", "web_session", "access_token", "profile_evidence"]) {
      expect(await withOrgTx(A.orgId, (tx) => countIn(tx, table)), table).toBe(0);
    }
  });

  it("the system scope reads across accounts (sign-in links, sessions and tokens are looked up by hash)", async () => {
    expect(await withSystemTx((tx) => countIn(tx, "access_token"))).toBe(2);
    expect(await withSystemTx((tx) => countIn(tx, "account"))).toBe(4);
  });
});

describe("the documented second readers (§2.2 item 3)", () => {
  it("a candidate reads their own applications in every org, and nothing else of the employers'", async () => {
    const apps = await withAccountTx(A.candidateAccountId, async (tx) =>
      (await tx.select({ id: s.application.id, orgId: s.application.orgId }).from(s.application)).map((r) => r.id),
    );
    expect(new Set(apps)).toEqual(new Set([A.applicationId, crossApplicationId]));
    for (const table of ["judgment", "work_sample_grade", "interview_rating", "decision", "ranking_snapshot", "evidence_item", "requisition"]) {
      expect(await withAccountTx(A.candidateAccountId, (tx) => countIn(tx, table)), table).toBe(0);
    }
  });

  it("a candidate reads the statements they made", async () => {
    const n = await withAccountTx(A.candidateAccountId, (tx) => countIn(tx, "candidate_statement"));
    expect(n).toBe(1);
    expect(await withAccountTx(B.candidateAccountId, (tx) => countIn(tx, "candidate_statement"))).toBe(1);
  });

  it("org A never sees candidate A's application to org B", async () => {
    const apps = await withOrgTx(A.orgId, async (tx) => (await tx.select({ id: s.application.id }).from(s.application)).map((r) => r.id));
    expect(apps).toEqual([A.applicationId]);
  });

  it("a candidate cannot change their application without entering its org scope", async () => {
    const changed = await withAccountTx(A.candidateAccountId, async (tx) =>
      (await tx.update(s.application).set({ accommodationRequested: true }).where(sql`id = ${crossApplicationId}`).returning({ id: s.application.id })).length,
    );
    expect(changed).toBe(0);
    const inScope = await withAccountTx(A.candidateAccountId, async (tx) => {
      const [app] = await tx.select({ orgId: s.application.orgId }).from(s.application).where(sql`id = ${crossApplicationId}`);
      await enterOrgScope(tx, app.orgId);
      return (await tx.update(s.application).set({ accommodationRequested: true }).where(sql`id = ${crossApplicationId}`).returning({ id: s.application.id })).length;
    });
    expect(inScope).toBe(1);
  });

  it("a member sees their own memberships, not other orgs' members", async () => {
    const own = await withAccountTx(A.memberAccountId, async (tx) => (await tx.select({ orgId: s.orgMember.orgId }).from(s.orgMember)).map((r) => r.orgId));
    expect(own).toEqual([A.orgId]);
    const orgs = await withAccountTx(A.memberAccountId, (tx) => orgIdsIn(tx, "org"));
    expect(orgs).toEqual([A.orgId]);
  });
});

describe("scope does not leak between transactions", () => {
  it("after an org transaction the setting reads empty, and a later transaction neither errors nor sees that org", async () => {
    await withOrgTx(A.orgId, (tx) => countIn(tx, "requirement"));
    // Without NULLIF in the policy helpers this would raise: ''::uuid is invalid.
    expect(await withAccountTx(B.candidateAccountId, (tx) => countIn(tx, "requirement"))).toBe(0);
    const after = await t.client.query<{ v: string | null }>("SELECT current_setting('app.org_id', true) AS v");
    expect(after.rows[0].v ?? "").toBe("");
  });

  it("the helpers refuse an org or account id that is not a UUID", async () => {
    await expect(withOrgTx("not-a-uuid", async () => 1)).rejects.toThrow(/UUID/);
    await expect(withAccountTx("1 OR 1=1", async () => 1)).rejects.toThrow(/UUID/);
  });

  it("scoped transactions run as clearance_app, not as the session user", async () => {
    const who = await withOrgTx(A.orgId, async (tx) => rowsOf<{ u: string }>(await tx.execute(sql`SELECT current_user AS u`))[0].u);
    expect(who).toBe(APP_DB_ROLE);
  });
});

describe("grants", () => {
  it("global tables are readable in any scope; notice texts are seeded by migration only", async () => {
    for (const table of GLOBAL_TABLES) expect(await withOrgTx(A.orgId, (tx) => countIn(tx, table)), table).toBe(1);
    const msg = await errorText(
      withSystemTx((tx) => tx.insert(s.noticeVersion).values({ kind: "ai_use", version: "x.1", body: "x", bodySha256: "x", publishedAt: new Date() })),
    );
    expect(msg).toMatch(/permission denied/);
  });

  it("submitted evidence is immutable", async () => {
    const msg = await errorText(withOrgTx(A.orgId, (tx) => tx.update(s.evidenceItem).set({ claim: "Changed after submission." }).where(sql`id = ${A.evidenceItemId}`)));
    expect(msg).toMatch(/permission denied/);
  });
});

describe("observed on PGlite: why the helpers switch role (§14 Q13)", () => {
  it("PGlite's session user is a superuser with BYPASSRLS and sees every org's rows, FORCE or not", async () => {
    const [me] = (await t.client.query<{ su: boolean; byp: boolean }>(
      "SELECT rolsuper AS su, rolbypassrls AS byp FROM pg_roles WHERE rolname = current_user",
    )).rows;
    expect(me).toEqual({ su: true, byp: true });
    await t.client.query("SELECT set_config('app.org_id', $1, false)", [A.orgId]);
    const seen = (await t.client.query<{ o: string }>("SELECT DISTINCT org_id::text AS o FROM requirement")).rows.map((r) => r.o);
    await t.client.query("SELECT set_config('app.org_id', '', false)");
    expect(new Set(seen)).toEqual(new Set([A.orgId, B.orgId]));
  });
});

describe("FORCE ROW LEVEL SECURITY applies to the owner role", () => {
  let owned: TestDb;
  let OA: OrgWorld;
  let OB: OrgWorld;

  beforeAll(async () => {
    owned = await createTestDb({ install: false });
    OA = await seedOrgWorld(owned.db, "a");
    OB = await seedOrgWorld(owned.db, "b");
    // A non-superuser, non-BYPASSRLS role takes ownership of every owned table,
    // as the migrating role does on a managed Postgres.
    await owned.client.exec("CREATE ROLE rls_probe_owner NOLOGIN NOSUPERUSER NOBYPASSRLS");
    for (const table of RLS_TABLES) await owned.client.exec(`ALTER TABLE "${table}" OWNER TO rls_probe_owner`);
  }, 60_000);

  afterAll(async () => {
    await owned?.close();
  });

  async function asOwner<T>(orgId: string | null, fn: () => Promise<T>): Promise<T> {
    await owned.client.exec("BEGIN");
    try {
      await owned.client.exec("SET LOCAL ROLE rls_probe_owner");
      await owned.client.query("SELECT set_config('app.org_id', $1, true)", [orgId ?? ""]);
      return await fn();
    } finally {
      await owned.client.exec("ROLLBACK");
    }
  }

  const ownerCount = async (table: string) => (await owned.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
  const ownerOrgs = async (table: string) =>
    (await owned.client.query<{ o: string }>(`SELECT DISTINCT ${table === "org" ? "id" : "org_id"}::text AS o FROM "${table}"`)).rows.map((r) => r.o);

  it("the owner role owns every row-level-secured table and is neither superuser nor BYPASSRLS", async () => {
    const rows = (await owned.client.query<{ relname: string }>(
      "SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'rls_probe_owner' AND c.relkind = 'r'",
    )).rows;
    expect(rows).toHaveLength(RLS_TABLES.length);
  });

  it("as the owner with org A set, every tenant table returns only org A's rows", async () => {
    for (const table of [...TENANT_TABLES, "org"]) {
      const seen = await asOwner(OA.orgId, () => ownerOrgs(table));
      expect(seen, table).toEqual([OA.orgId]);
    }
  });

  it("as the owner with nothing set, every row-level-secured table returns no rows", async () => {
    for (const table of RLS_TABLES) {
      expect(await asOwner(null, () => ownerCount(table)), table).toBe(0);
    }
  });

  it("without FORCE the owner sees every org's rows: FORCE is what makes the difference", async () => {
    await owned.client.exec('ALTER TABLE "requirement" NO FORCE ROW LEVEL SECURITY');
    const seen = await asOwner(OA.orgId, () => ownerOrgs("requirement"));
    await owned.client.exec('ALTER TABLE "requirement" FORCE ROW LEVEL SECURITY');
    expect(new Set(seen)).toEqual(new Set([OA.orgId, OB.orgId]));
    expect(await asOwner(OA.orgId, () => ownerOrgs("requirement"))).toEqual([OA.orgId]);
  });
});
