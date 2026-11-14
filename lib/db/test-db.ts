/**
 * A fresh, migrated, in-memory PGlite database per test file.
 * Test files that use it declare `// @vitest-environment node`.
 *
 *   const t = await createTestDb();        // in beforeAll
 *   ...withOrgTx(orgId, …)                  // the helpers now use t.db
 *   await t.close();                        // in afterAll
 *
 * `t.client` is PGlite's superuser session: it bypasses row-level security,
 * so fixtures can seed several orgs at once. Assertions about what a scope
 * can see must go through lib/db/tx.ts, never through `t.client`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { openPglite, setDbForTesting, type Db } from "@/lib/db/client";

export interface TestDb {
  db: Db;
  client: PGlite;
  close(): Promise<void>;
}

export async function createTestDb(opts: { install?: boolean } = {}): Promise<TestDb> {
  const { db, client } = await openPglite();
  const install = opts.install ?? true;
  if (install) setDbForTesting(db);
  return {
    db,
    client,
    async close() {
      if (install) setDbForTesting(null);
      await client.close();
    },
  };
}
