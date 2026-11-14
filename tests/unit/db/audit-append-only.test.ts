// @vitest-environment node
/**
 * S1 (audit_event): the audit log is append-only, enforced in the database. The
 * app role has no UPDATE or DELETE grant; a trigger refuses UPDATE, DELETE and
 * TRUNCATE for every role, superuser and table owner included; the one
 * exception is purge_audit_events(), the retention purge, which runs inside one
 * org's scope and leaves no way open behind it. Also: recordAudit's own rules
 * (closed actions, no free text) and the database CHECK that every event names
 * its actor.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/lib/db/test-db";
import { withAccountTx, withOrgTx, withSystemTx } from "@/lib/db/tx";
import { rowsOf } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import * as s from "@/lib/db/schema";
import { AuditInputError, recordAudit } from "@/lib/pipeline/audit";
import { queueNotification } from "@/lib/pipeline/notify";
import type { Actor } from "@/lib/pipeline/actor";
import { seedOrgWorld, type OrgWorld } from "./fixtures";

let t: TestDb;
let A: OrgWorld;
let B: OrgWorld;
const timer: Actor = { kind: "system_timer", job: "test" };

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

const superCount = async (where = "true", params: unknown[] = []) =>
  (await t.client.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_event WHERE ${where}`, params)).rows[0].n;

beforeAll(async () => {
  t = await createTestDb();
  A = await seedOrgWorld(t.db, "a");
  B = await seedOrgWorld(t.db, "b");
}, 60_000);

afterAll(async () => {
  await t?.close();
});

describe("recordAudit", () => {
  it("writes one event in the caller's transaction with the actor's columns", async () => {
    const actor: Actor = { kind: "person_agent", accountId: A.memberAccountId, tokenId: newId(), side: "employer", orgId: A.orgId, memberId: A.memberId, roles: ["recruiter"] };
    const id = await withOrgTx(A.orgId, (tx) =>
      recordAudit(tx, actor, {
        action: "application.stage_changed",
        entityType: "application",
        entityId: A.applicationId,
        orgId: A.orgId,
        applicationId: A.applicationId,
        before: { stage: "in_review" },
        after: { stage: "work_sample", changedAt: "2026-11-13T09:00:00Z" },
        reasonCodes: ["meets_must_haves"],
      }),
    );
    const row = (await t.client.query<Record<string, unknown>>("SELECT * FROM audit_event WHERE id = $1", [id])).rows[0];
    expect(row).toMatchObject({ actor_kind: "person_agent", actor_account_id: A.memberAccountId, actor_member_id: A.memberId, org_id: A.orgId });
  });

  it("rolls back with the change it records", async () => {
    const before = await superCount();
    await errorText(
      withOrgTx(A.orgId, async (tx) => {
        await recordAudit(tx, timer, { action: "offer.expired", entityType: "offer", entityId: newId(), orgId: A.orgId });
        throw new Error("the change failed");
      }),
    );
    expect(await superCount()).toBe(before);
  });

  it("writes an account-plane event (no org) from the person's own scope", async () => {
    const actor: Actor = { kind: "person_web", accountId: A.candidateAccountId, sessionId: newId(), side: "candidate", roles: [] };
    const id = await withAccountTx(A.candidateAccountId, (tx) =>
      recordAudit(tx, actor, { action: "token.created", entityType: "access_token", entityId: newId(), accountId: A.candidateAccountId }),
    );
    expect(await superCount("id = $1", [id])).toBe(1);
    // …and an org's scope cannot read it.
    expect(await withOrgTx(A.orgId, async (tx) => (await tx.select().from(s.auditEvent).where(sql`id = ${id}`)).length)).toBe(0);
  });

  it("refuses an action outside the closed list, a non-table entity, and free text, names or emails in before/after", async () => {
    const bad = [
      { action: "application.renamed", entityType: "application", entityId: A.applicationId },
      { action: "application.submitted", entityType: "applications", entityId: A.applicationId },
      { action: "application.submitted", entityType: "application", entityId: A.applicationId, after: { note: "Candidate said they are great" } },
      { action: "application.submitted", entityType: "application", entityId: A.applicationId, after: { name: "Fixture Candidate" } },
      { action: "application.submitted", entityType: "application", entityId: A.applicationId, after: { email: "candidate-a@example.test" } },
      { action: "application.submitted", entityType: "application", entityId: A.applicationId, after: { nested: { stage: "in_review" } } },
      { action: "application.submitted", entityType: "application", entityId: A.applicationId, reasonCodes: ["Not a code"] },
    ];
    for (const input of bad) {
      await expect(
        withOrgTx(A.orgId, (tx) => recordAudit(tx, timer, { orgId: A.orgId, ...input } as Parameters<typeof recordAudit>[2])),
      ).rejects.toBeInstanceOf(AuditInputError);
    }
  });

  it("the database requires every event to name its actor in the columns that fit the actor kind", async () => {
    const msg = await errorText(
      t.client.query(
        "INSERT INTO audit_event (id, actor_kind, actor_account_id, action, entity_type, entity_id) VALUES ($1, 'person_agent', $2, 'offer.extended', 'offer', $3)",
        [newId(), A.memberAccountId, newId()],
      ),
    );
    expect(msg).toMatch(/audit_event_actor/);
  });
});

describe("the audit log is append-only", () => {
  it("the app role cannot UPDATE or DELETE an event (no grant)", async () => {
    const upd = await errorText(withOrgTx(A.orgId, (tx) => tx.execute(sql`UPDATE audit_event SET action = 'offer.accepted' WHERE org_id = ${A.orgId}`)));
    expect(upd).toMatch(/permission denied/);
    const del = await errorText(withOrgTx(A.orgId, (tx) => tx.execute(sql`DELETE FROM audit_event WHERE org_id = ${A.orgId}`)));
    expect(del).toMatch(/permission denied/);
    const sys = await errorText(withSystemTx((tx) => tx.execute(sql`DELETE FROM audit_event`)));
    expect(sys).toMatch(/permission denied/);
  });

  it("even a superuser cannot UPDATE, DELETE or TRUNCATE: the trigger refuses", async () => {
    const before = await superCount();
    expect(await errorText(t.client.query("UPDATE audit_event SET action = 'offer.accepted'"))).toMatch(/append-only: UPDATE refused/);
    expect(await errorText(t.client.query("DELETE FROM audit_event"))).toMatch(/append-only: DELETE refused/);
    expect(await errorText(t.client.query("TRUNCATE audit_event"))).toMatch(/append-only: TRUNCATE refused/);
    expect(await superCount()).toBe(before);
  });

  it("the retention purge deletes only the named org's events for one requisition, and only inside that org's scope", async () => {
    const reqEvents = async (orgId: string, requisitionId: string) => superCount("org_id = $1 AND requisition_id = $2", [orgId, requisitionId]);
    expect(await reqEvents(A.orgId, A.requisitionId)).toBeGreaterThan(0);
    const otherA = await superCount("org_id = $1 AND requisition_id IS NULL", [A.orgId]);
    const allB = await superCount("org_id = $1", [B.orgId]);

    const purged = await withOrgTx(A.orgId, async (tx) =>
      rowsOf<{ n: number }>(await tx.execute(sql`SELECT purge_audit_events(${A.orgId}::uuid, ${A.requisitionId}::uuid, NULL) AS n`))[0].n,
    );
    expect(purged).toBeGreaterThan(0);
    expect(await reqEvents(A.orgId, A.requisitionId)).toBe(0);
    expect(await superCount("org_id = $1 AND requisition_id IS NULL", [A.orgId])).toBe(otherA);
    expect(await superCount("org_id = $1", [B.orgId])).toBe(allB);
  });

  it("the purge refuses another org's events and a call with no requisition or cut-off", async () => {
    const cross = await errorText(withOrgTx(A.orgId, (tx) => tx.execute(sql`SELECT purge_audit_events(${B.orgId}::uuid, ${B.requisitionId}::uuid, NULL)`)));
    expect(cross).toMatch(/only inside that org's scope/);
    const unbounded = await errorText(withOrgTx(A.orgId, (tx) => tx.execute(sql`SELECT purge_audit_events(${A.orgId}::uuid, NULL, NULL)`)));
    expect(unbounded).toMatch(/needs an org and a requisition or a cut-off/);
  });

  it("the purge leaves no door open behind it: a DELETE later in the same transaction is still refused", async () => {
    await t.client.exec("BEGIN");
    try {
      await t.client.query("SELECT set_config('app.org_id', $1, true)", [B.orgId]);
      await t.client.query("SELECT purge_audit_events($1::uuid, NULL, now() - interval '1 day')", [B.orgId]);
      const msg = await errorText(t.client.query("DELETE FROM audit_event WHERE org_id = $1", [B.orgId]));
      expect(msg).toMatch(/append-only: DELETE refused/);
    } finally {
      await t.client.exec("ROLLBACK");
    }
  });

  it("a non-superuser owner of the table is refused by the trigger too", async () => {
    await t.client.exec("CREATE ROLE audit_probe_owner NOLOGIN NOSUPERUSER NOBYPASSRLS");
    await t.client.exec("ALTER TABLE audit_event OWNER TO audit_probe_owner");
    await t.client.exec("BEGIN");
    try {
      await t.client.exec("SET LOCAL ROLE audit_probe_owner");
      await t.client.query("SELECT set_config('app.org_id', $1, true)", [B.orgId]);
      const msg = await errorText(t.client.query("UPDATE audit_event SET action = 'offer.accepted' WHERE org_id = $1", [B.orgId]));
      expect(msg).toMatch(/append-only: UPDATE refused/);
    } finally {
      await t.client.exec("ROLLBACK");
    }
  });
});

describe("the notification outbox writer", () => {
  it("queues a notification in the change's transaction; the same dedupe key queues nothing", async () => {
    const dedupeKey = `test-${newId()}`;
    const input = {
      recipientAccountId: A.candidateAccountId,
      orgId: A.orgId,
      applicationId: A.applicationId,
      kind: "application.received",
      templateVersion: "v1",
      title: "Application received",
      body: "A made-up body.",
      channelEmail: true,
      dedupeKey,
    };
    const first = await withOrgTx(A.orgId, (tx) => queueNotification(tx, input));
    const second = await withOrgTx(A.orgId, (tx) => queueNotification(tx, input));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toBeNull();
    const rows = (await t.client.query<{ email_status: string }>("SELECT email_status FROM notification WHERE dedupe_key = $1", [dedupeKey])).rows;
    expect(rows).toEqual([{ email_status: "queued" }]);
    // The recipient reads it in their own scope (the agents' inbox).
    const inbox = await withAccountTx(A.candidateAccountId, async (tx) => (await tx.select().from(s.notification).where(sql`dedupe_key = ${dedupeKey}`)).length);
    expect(inbox).toBe(1);
  });

  it("an org cannot queue a notification tagged with another org", async () => {
    const msg = await errorText(
      withOrgTx(A.orgId, (tx) =>
        queueNotification(tx, {
          recipientAccountId: B.candidateAccountId,
          orgId: B.orgId,
          kind: "application.received",
          templateVersion: "v1",
          title: "x",
          body: "x",
          channelEmail: false,
          dedupeKey: `test-${newId()}`,
        }),
      ),
    );
    expect(msg).toMatch(/row-level security/);
  });
});
