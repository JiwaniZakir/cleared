/**
 * The database client.
 *
 * - `DATABASE_URL` set (production: Neon's pooled endpoint): `pg` Pool with
 *   `max: 5`, registered with `attachDatabasePool` so Vercel releases idle
 *   clients before the instance suspends; Drizzle on top. Migrations are a
 *   separate step (`pnpm db:migrate`, unpooled connection string).
 * - Not set: an embedded PGlite (Postgres compiled to WebAssembly, in
 *   process, no account) at `PGLITE_DATA_DIR` or `.data/pglite`, migrated on
 *   first use. Never on Vercel: there the absence of DATABASE_URL is an error.
 *
 * Nothing here sets a row-level-security scope. Every pipeline query goes
 * through lib/db/tx.ts, which does.
 */
import path from "node:path";
import { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

export type Schema = typeof schema;
/** Either driver's database, typed by what they share. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
/** A transaction opened by lib/db/tx.ts (always scoped). */
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

/** Must match drizzle.config.ts so `drizzle-kit migrate` and the runtime agree. */
export const MIGRATIONS = { migrationsFolder: path.join(process.cwd(), "drizzle"), migrationsSchema: "drizzle", migrationsTable: "__drizzle_migrations" };

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. The embedded database runs only locally and in tests, never on Vercel.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let testOverride: Db | null = null;
let opening: Promise<Db> | null = null;

/** The process-wide database, opened on first use. */
export function getDb(): Promise<Db> {
  if (testOverride) return Promise.resolve(testOverride);
  opening ??= openDb().catch((err: unknown) => {
    opening = null;
    throw err;
  });
  return opening;
}

/** Tests install their own PGlite database (lib/db/test-db.ts); `null` removes it. */
export function setDbForTesting(db: Db | null): void {
  testOverride = db;
}

async function openDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: 5 });
    const { attachDatabasePool } = await import("@vercel/functions");
    attachDatabasePool(pool);
    return drizzleNodePg({ client: pool, schema, casing: "snake_case" });
  }
  if (process.env.VERCEL) throw new DatabaseNotConfiguredError();
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");
  return (await openPglite(dataDir)).db;
}

/**
 * Opens a PGlite database with the citext extension and applies every
 * migration in drizzle/. No `dataDir` means in memory (tests). The returned
 * `client` is PGlite's own session user, a superuser: it bypasses row-level
 * security, which is what test fixtures want and what application code must
 * never use (lib/db/tx.ts switches to the clearance_app role).
 */
export async function openPglite(dataDir?: string): Promise<{ db: Db; client: PGlite }> {
  const [{ PGlite }, { citext }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite/contrib/citext"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = dataDir ? new PGlite(dataDir, { extensions: { citext } }) : new PGlite({ extensions: { citext } });
  const db = drizzle({ client, schema, casing: "snake_case" });
  await migrate(db, MIGRATIONS);
  return { db, client };
}

/** Rows of a raw `execute()` result; both drivers return `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}
