/**
 * Removes the `citizenship_status` field from contributions already stored in
 * the anonymous interest pool. The pool stopped collecting the field; reads already ignore it
 * (sanitizeContribution in ./store.ts). This rewrites the stored records so
 * the field is gone from the database too.
 *
 * Run once by the owner through scripts/strip-pool-citizenship.ts. Kept here,
 * apart from the script, so tests exercise the exact transformation on
 * fixtures without a Redis connection.
 *
 * What it does to each list:
 * - Every entry keeps its position, so the oldest-first order the read side
 *   releases in (getReleasedAggregate) and every list's length are unchanged.
 * - An entry with the field is rewritten without it, other fields untouched.
 *   An entry whose only field was citizenship_status becomes `{}`: it stays a
 *   counted contribution, so totals and release steps do not shift.
 * - An entry without the field, or one that is not readable JSON, is left
 *   exactly as it is (the latter is counted and reported, never guessed at).
 * - Writes are LSET on the changed indexes only. The app only ever appends
 *   to these lists, so a contribution arriving during the run lands after the
 *   indexes being rewritten and is not disturbed.
 */

import { ROLE_LIST_PREFIX, COMPANY_LIST_PREFIX } from "@/lib/signal/store";

export const LEGACY_FIELD = "citizenship_status";

/** The subset of a Redis client this needs; @upstash/redis satisfies it. */
export interface PoolListClient {
  scan(cursor: string, opts: { match: string; count: number }): Promise<[string, string[]]>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  lset(key: string, index: number, value: string): Promise<unknown>;
}

export type EntryResult =
  | { kind: "unchanged" }
  | { kind: "unreadable" }
  | { kind: "stripped"; payload: string };

/** One stored entry, as the client returns it (a JSON string, or an object
 *  when the client parses JSON itself). */
export function stripEntry(entry: unknown): EntryResult {
  let value: unknown = entry;
  if (typeof entry === "string") {
    try {
      value = JSON.parse(entry);
    } catch {
      return { kind: "unreadable" };
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { kind: "unreadable" };
  if (!Object.prototype.hasOwnProperty.call(value, LEGACY_FIELD)) return { kind: "unchanged" };
  const rest: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete rest[LEGACY_FIELD];
  return { kind: "stripped", payload: JSON.stringify(rest) };
}

/** The writes one list needs: index and new payload for each changed entry. */
export function planListRewrite(entries: unknown[]): {
  writes: { index: number; payload: string }[];
  unreadable: number;
} {
  const writes: { index: number; payload: string }[] = [];
  let unreadable = 0;
  entries.forEach((entry, index) => {
    const result = stripEntry(entry);
    if (result.kind === "stripped") writes.push({ index, payload: result.payload });
    else if (result.kind === "unreadable") unreadable += 1;
  });
  return { writes, unreadable };
}

export const POOL_LIST_PATTERNS = [`${ROLE_LIST_PREFIX}*`, `${COMPANY_LIST_PREFIX}*`] as const;

export interface StripSummary {
  applied: boolean;
  listsScanned: number;
  listsChanged: number;
  entriesChanged: number;
  entriesUnreadable: number;
}

async function scanAll(client: PoolListClient, match: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [next, batch] = await client.scan(cursor, { match, count: 500 });
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== "0");
  return keys;
}

/** Dry run unless `apply` is true. Reports counts only, never entry contents. */
export async function stripPoolCitizenship(client: PoolListClient, { apply }: { apply: boolean }): Promise<StripSummary> {
  const summary: StripSummary = { applied: apply, listsScanned: 0, listsChanged: 0, entriesChanged: 0, entriesUnreadable: 0 };
  const keys = new Set<string>();
  for (const pattern of POOL_LIST_PATTERNS) for (const key of await scanAll(client, pattern)) keys.add(key);

  for (const key of [...keys].sort()) {
    const entries = await client.lrange(key, 0, -1);
    summary.listsScanned += 1;
    const { writes, unreadable } = planListRewrite(entries);
    summary.entriesUnreadable += unreadable;
    if (writes.length === 0) continue;
    summary.listsChanged += 1;
    summary.entriesChanged += writes.length;
    if (!apply) continue;
    for (const { index, payload } of writes) await client.lset(key, index, payload);
  }
  return summary;
}
