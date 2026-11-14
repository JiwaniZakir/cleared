/**
 * Column helpers shared by every schema file. Column keys are camelCase in
 * TypeScript and snake_case in Postgres (`casing: "snake_case"` in
 * drizzle.config.ts and in every drizzle() call, lib/db/client.ts).
 */
import { customType, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";
import { newId } from "@/lib/db/ids";

/** Case-insensitive text (the `citext` extension, created by 0000_init.sql). */
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

/** Raw bytes. `pg` returns a Buffer and PGlite a Uint8Array; both are Uint8Arrays. */
export const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Every table's key: a random UUIDv4 from newId(), never a serial integer.
 * Deliberately no database default (`gen_random_uuid()`): about 1% of
 * raw random UUIDs are refused by the personal-data guard, so every id must
 * come from newId(), which draws until the guard accepts it (lib/db/ids.ts).
 * A raw INSERT without an id fails instead of minting an unsafe one.
 */
export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => newId());

/** Every table has created_at. */
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const tstz = () => timestamp({ withTimezone: true });

/** `ARRAY['a','b']::text[]` from a closed list in lib/pipeline/vocab.ts, for CHECK constraints. */
export function textArrayLiteral(values: readonly string[]): SQL {
  for (const v of values) {
    if (!/^[a-z0-9_:]+$/.test(v)) throw new Error(`vocab value not safe for a literal: ${v}`);
  }
  return sql.raw(`ARRAY[${values.map((v) => `'${v}'`).join(", ")}]::text[]`);
}
