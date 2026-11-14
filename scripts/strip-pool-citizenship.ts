#!/usr/bin/env tsx
/**
 * One-off: remove `citizenship_status` from every contribution stored in the
 * anonymous interest pool.
 * The tools stopped collecting and showing it, and reads already ignore it;
 * this removes it from the stored records themselves.
 *
 * The owner runs it once against production. It reads the same variables the
 * app does (KV_REST_API_URL, KV_REST_API_TOKEN), for example after
 * `vercel env pull .env.local`:
 *
 *   pnpm tsx --env-file=.env.local scripts/strip-pool-citizenship.ts          # dry run: counts only
 *   pnpm tsx --env-file=.env.local scripts/strip-pool-citizenship.ts --apply  # rewrite
 *
 * It prints counts, never record contents. Each list keeps its length and
 * order; see lib/signal/strip-citizenship.ts for exactly what changes.
 * Running it a second time finds nothing to change.
 */
import { Redis } from "@upstash/redis";
import { stripPoolCitizenship } from "../lib/signal/strip-citizenship";

async function main() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.error("KV_REST_API_URL and KV_REST_API_TOKEN must be set (the pool's Upstash Redis). Nothing was read or changed.");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  // Raw strings in and out, exactly as addContribution writes them.
  const redis = new Redis({ url, token, automaticDeserialization: false });
  const summary = await stripPoolCitizenship(
    {
      scan: (cursor, opts) => redis.scan(cursor, opts),
      lrange: (key, start, stop) => redis.lrange<string>(key, start, stop),
      lset: (key, index, value) => redis.lset(key, index, value),
    },
    { apply },
  );
  console.log(JSON.stringify(summary, null, 2));
  if (!apply && summary.entriesChanged > 0) {
    console.log(`Dry run: ${summary.entriesChanged} entries in ${summary.listsChanged} lists would change. Re-run with --apply to write.`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
