/**
 * Scoped transactions: the only way pipeline code reaches the database.
 * Each helper opens one transaction, switches to the
 * `clearance_app` role, and sets the row-level-security scope with
 * `set_config(…, true)` (transaction-local, safe behind a transaction-mode
 * pooler). The policies in drizzle/0001_rls_and_triggers.sql read it.
 *
 * Why SET LOCAL ROLE: a superuser or a BYPASSRLS role skips row-level
 * security in every Postgres, FORCE or not, and PGlite's only user is a
 * superuser. clearance_app is neither, owns nothing, and has only the grants
 * the migration gives it, so the policies apply whatever role the connection
 * logged in as.
 *
 * The scope never comes from tool input: service functions take it from the
 * Actor.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/lib/db/client";

export type { Tx } from "@/lib/db/client";

/** The database role every scoped transaction runs as (created by 0001_rls_and_triggers.sql). */
export const APP_DB_ROLE = "clearance_app";

const UuidSchema = z.uuid();

interface TxScope {
  orgId: string | null;
  accountId: string | null;
  system: boolean;
}

function checkedId(value: string, what: string): string {
  if (!UuidSchema.safeParse(value).success) throw new Error(`${what} must be a UUID`);
  return value;
}

async function setScope(tx: Tx, scope: TxScope): Promise<void> {
  // Every key is set every time, so nothing from an earlier transaction on a
  // pooled connection can leak in (an unset key reads as '' → NULL in SQL).
  await tx.execute(sql`SELECT
    set_config('app.org_id', ${scope.orgId ?? ""}, true),
    set_config('app.account_id', ${scope.accountId ?? ""}, true),
    set_config('app.system', ${scope.system ? "on" : "off"}, true)`);
}

async function runScoped<T>(scope: TxScope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${APP_DB_ROLE}`));
    await setScope(tx, scope);
    return fn(tx);
  });
}

/**
 * One employer org's scope: tenant rows of that org only. `accountId` adds
 * the acting person's own account-plane rows (for example a candidate
 * submitting to that org, or a member reading their own token).
 */
export async function withOrgTx<T>(orgId: string, fn: (tx: Tx) => Promise<T>, opts: { accountId?: string } = {}): Promise<T> {
  return runScoped(
    { orgId: checkedId(orgId, "orgId"), accountId: opts.accountId ? checkedId(opts.accountId, "accountId") : null, system: false },
    fn,
  );
}

/**
 * One person's scope: their account-plane rows, plus the two documented
 * cross-scope reads (their own applications and statements).
 * No tenant row of any org is visible unless `orgId` is given.
 */
export async function withAccountTx<T>(accountId: string, fn: (tx: Tx) => Promise<T>, opts: { orgId?: string } = {}): Promise<T> {
  return runScoped(
    { orgId: opts.orgId ? checkedId(opts.orgId, "orgId") : null, accountId: checkedId(accountId, "accountId"), system: false },
    fn,
  );
}

/**
 * The system's scope (timers, webhooks, sign-in): account-plane lookups by
 * hash, the org list, the notification outbox and the audit log. It does NOT
 * open tenant tables: a job that works on employer data loops over orgs and
 * calls withOrgTx for each one.
 */
export async function withSystemTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runScoped({ orgId: null, accountId: null, system: true }, fn);
}

/**
 * Narrows an open transaction to one org, keeping its account scope. For a
 * service that first reads a row the person may see (their own application)
 * and then works inside that application's org. The org must come from such
 * a row, never from input.
 */
export async function enterOrgScope(tx: Tx, orgId: string): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.org_id', ${checkedId(orgId, "orgId")}, true)`);
}
