// @vitest-environment node
/**
 * S1: a fresh PGlite migrates; the database has exactly the 34 tables of the
 * schema; its enums equal lib/pipeline/vocab.ts; the closed text lists' CHECKs
 * equal vocab; the migrated columns equal the TypeScript schema; and every
 * owned table has row-level security enabled and forced.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { isTable } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { MIGRATIONS } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { CHECKED_TEXT_LISTS, PG_ENUMS } from "@/lib/pipeline/vocab";
import { GLOBAL_TABLES, RLS_TABLES, TENANT_TABLES } from "./fixtures";

const EXPECTED_TABLES = [
  // account plane
  "account",
  "email_token",
  "web_session",
  "access_token",
  "profile_evidence",
  // global
  "notice_version",
  "processed_webhook",
  // tenant: organisation
  "org",
  "org_member",
  "provider_connection",
  "legal_hold",
  "impact_report",
  "data_request",
  // tenant: role and application
  "requisition",
  "requirement",
  "work_sample_spec",
  "application",
  "evidence_item",
  "candidate_statement",
  "candidate_request",
  "work_sample_submission",
  // tenant: evaluation
  "judgment",
  "work_sample_grade",
  "interview",
  "interview_rating",
  "ranking_snapshot",
  // tenant: decisions and after
  "proposal",
  "decision",
  "offer",
  "bg_check",
  "adverse_action",
  "checklist_item",
  // cross-cutting
  "notification",
  "audit_event",
];

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb({ install: false });
}, 60_000);
afterAll(async () => {
  await t?.close();
});

async function q<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await t.client.query<T>(text, params)).rows;
}

describe("migrations on a fresh embedded database", () => {
  it("creates exactly the 34 tables of the design", async () => {
    const rows = await q<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toHaveLength(34);
    expect(new Set(names)).toEqual(new Set(EXPECTED_TABLES));
  });

  it("the TypeScript schema declares the same 34 tables", () => {
    const tables = Object.values(schema).filter((v) => isTable(v)) as PgTable[];
    expect(new Set(tables.map((tb) => getTableConfig(tb).name))).toEqual(new Set(EXPECTED_TABLES));
  });

  it("every table's columns in the database equal the TypeScript schema's", async () => {
    const tables = Object.values(schema).filter((v) => isTable(v)) as PgTable[];
    for (const table of tables) {
      const cfg = getTableConfig(table);
      const rows = await q<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [cfg.name],
      );
      expect(new Set(rows.map((r) => r.column_name)), cfg.name).toEqual(new Set(cfg.columns.map((c) => snake(c.name))));
    }
  });

  it("every Postgres enum equals lib/pipeline/vocab.ts, labels and order", async () => {
    const rows = await q<{ typname: string; labels: string[] }>(
      `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
         FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname`,
    );
    const inDb = Object.fromEntries(rows.map((r) => [r.typname, r.labels]));
    const fromVocab = Object.fromEntries(Object.entries(PG_ENUMS).map(([k, v]) => [k, [...v]]));
    expect(inDb).toEqual(fromVocab);
  });

  it("each closed text list's CHECK constraint holds exactly the vocab list", async () => {
    for (const [key, values] of Object.entries(CHECKED_TEXT_LISTS)) {
      const [table, column] = key.split(".");
      const rows = await q<{ def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
          WHERE r.relname = $1 AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%' || $2 || ' <@%'`,
        [table, column],
      );
      expect(rows, key).toHaveLength(1);
      const listed = [...rows[0].def.matchAll(/'([a-z0-9_:]+)'::text/g)].map((m) => m[1]);
      expect(listed, key).toEqual([...values]);
    }
  });

  it("no id column has a database default (every id comes from newId())", async () => {
    const rows = await q<{ table_name: string }>(
      "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'id' AND column_default IS NOT NULL",
    );
    expect(rows).toEqual([]);
  });

  it("every owned table has row-level security enabled and forced, with a policy; global tables have none", async () => {
    const rows = await q<{ relname: string; rls: boolean; force: boolean; policies: number }>(
      `SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS force,
              (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    );
    const byName = Object.fromEntries(rows.map((r) => [r.relname, r]));
    expect(RLS_TABLES.length + GLOBAL_TABLES.length).toBe(34);
    for (const name of RLS_TABLES) {
      expect(byName[name], name).toMatchObject({ rls: true, force: true });
      expect(byName[name].policies, name).toBeGreaterThan(0);
    }
    for (const name of GLOBAL_TABLES) expect(byName[name], name).toMatchObject({ rls: false, policies: 0 });
  });

  it("every tenant table has org_id NOT NULL and UNIQUE (org_id, id)", async () => {
    for (const name of TENANT_TABLES) {
      const col = await q<{ is_nullable: string }>(
        "SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'org_id'",
        [name],
      );
      expect(col[0]?.is_nullable, name).toBe("NO");
      const uq = await q<{ def: string }>(
        `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid
          WHERE r.relname = $1 AND c.contype = 'u'`,
        [name],
      );
      expect(uq.map((u) => u.def), name).toContain("UNIQUE (org_id, id)");
    }
  });

  it("the application role exists without superuser or BYPASSRLS, and owns nothing", async () => {
    const [role] = await q<{ rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean }>(
      "SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'clearance_app'",
    );
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, rolcanlogin: false });
    const owned = await q<{ relname: string }>(
      "SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'clearance_app'",
    );
    expect(owned).toEqual([]);
  });

  it("running the migrator again is a no-op", async () => {
    await expect(migrate(t.db as unknown as PgliteDatabase<typeof schema>, MIGRATIONS)).resolves.toBeUndefined();
    const rows = await q<{ n: number }>("SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations");
    expect(rows[0].n).toBe(2);
  });
});
