/**
 * Cross-cutting tables: the notification outbox (also the agents'
 * inbox) and the append-only audit log. Both are written in the same
 * transaction as the change they record (a transactional outbox).
 * audit_event has no foreign keys on purpose: it must outlive the rows it
 * describes, and it is never updated (0001_rls_and_triggers.sql).
 */
import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, jsonb, pgTable, smallint, text, unique, uuid } from "drizzle-orm/pg-core";
import { citext, createdAt, id, tstz } from "@/lib/db/schema/columns";
import { actorKindEnum, emailStatusEnum } from "@/lib/db/schema/enums";
import { account } from "@/lib/db/schema/account";
import { orgRef } from "@/lib/db/schema/org";
import { application } from "@/lib/db/schema/application";

export const notification = pgTable(
  "notification",
  {
    id: id(),
    createdAt: createdAt(),
    recipientAccountId: uuid(),
    toEmail: citext(), // [PD] only for mail to someone without an account (first sign-in, invite)
    orgId: uuid(),
    applicationId: uuid(),
    kind: text().notNull(), // closed list in lib/mail/templates.ts (S2)
    templateVersion: text().notNull(),
    title: text().notNull(),
    body: text().notNull(), // [PD: may name the recipient]; sign-in links stored as [sign-in link]
    channelEmail: boolean().notNull().default(false),
    emailStatus: emailStatusEnum().notNull().default("not_applicable"),
    attempts: smallint().notNull().default(0),
    /** When the drain may try this row again (retries at 1 min, 5 min, 30 min, 2 h, 6 h, 24 h). */
    nextAttemptAt: tstz(),
    lastErrorCode: text(),
    providerMessageId: text(),
    sentAt: tstz(),
    readAt: tstz(),
    dedupeKey: text().notNull(),
  },
  (t) => [
    foreignKey({ name: "notification_recipient_fk", columns: [t.recipientAccountId], foreignColumns: [account.id] }).onDelete("cascade"),
    orgRef("notification_org_fk", t.orgId),
    foreignKey({ name: "notification_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    unique("notification_dedupe_key_key").on(t.dedupeKey),
    index("notification_recipient_created_idx").on(t.recipientAccountId, t.createdAt),
    index("notification_queued_idx").on(t.emailStatus).where(sql`email_status = 'queued'`),
    check("notification_has_recipient", sql`recipient_account_id IS NOT NULL OR to_email IS NOT NULL`),
    check("notification_email_status", sql`channel_email OR email_status = 'not_applicable'`),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid(),
    accountId: uuid(), // the subject, when the event is about a person's own account
    requisitionId: uuid(),
    applicationId: uuid(),
    actorKind: actorKindEnum().notNull(),
    actorAccountId: uuid(),
    actorMemberId: uuid(),
    actorTokenId: uuid(),
    actorSessionId: uuid(),
    actorJob: text(),
    action: text().notNull(), // dotted, closed list (lib/pipeline/vocab.ts AUDIT_ACTIONS)
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    before: jsonb(), // closed-vocabulary fields and ids only; never names, emails or free text
    after: jsonb(),
    reasonCodes: text().array().notNull().default(sql`'{}'::text[]`),
    modelId: text(),
    promptVersion: text(),
    requestId: text(),
  },
  (t) => [
    unique("audit_event_org_id_id_key").on(t.orgId, t.id),
    index("audit_event_org_created_idx").on(t.orgId, t.createdAt),
    index("audit_event_application_idx").on(t.applicationId),
    index("audit_event_entity_idx").on(t.entityType, t.entityId),
    index("audit_event_requisition_idx").on(t.requisitionId),
    // Every event names who acted, in the columns that fit the kind of actor.
    check(
      "audit_event_actor",
      sql`CASE actor_kind
        WHEN 'person_agent' THEN actor_account_id IS NOT NULL AND actor_token_id IS NOT NULL
        WHEN 'person_web' THEN actor_account_id IS NOT NULL AND actor_session_id IS NOT NULL
        ELSE actor_job IS NOT NULL
      END`,
    ),
    check("audit_event_action_shape", sql`action ~ '^[a-z_]+\\.[a-z_]+$'`),
  ],
);
