/**
 * The notification outbox, write side (table notification). A
 * service queues a notification in the same transaction as the change that
 * causes it; after commit, `after()` drains it to email and the daily cron
 * drains anything left (lib/jobs/outbox-drain.ts, slice S2). The same rows
 * are the agents' inbox (`get_updates`).
 *
 * Templates, kinds and the sign-in-link redaction belong to lib/mail (S2).
 * `dedupe_key` makes a second queue of the same message a no-op.
 *
 * Row-level security: written in an org's scope, a notification must carry
 * that org as `orgId` (to anyone); in a person's own scope, it must be to that
 * person; the system may write any (drizzle/0001_rls_and_triggers.sql 3f).
 */
import { z } from "zod";
import { notification } from "@/lib/db/schema";
import { newId } from "@/lib/db/ids";
import type { Tx } from "@/lib/db/tx";

export const NotificationInputSchema = z
  .object({
    recipientAccountId: z.uuid().optional(),
    /** Only for mail to someone without an account yet (a first sign-in, an invite). */
    toEmail: z.email().optional(),
    orgId: z.uuid().optional(),
    applicationId: z.uuid().optional(),
    kind: z.string().regex(/^[a-z][a-z0-9_.]{0,63}$/),
    templateVersion: z.string().min(1).max(40),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(20_000),
    channelEmail: z.boolean(),
    dedupeKey: z.string().min(1).max(200),
  })
  .refine((n) => n.recipientAccountId !== undefined || n.toEmail !== undefined, {
    message: "A notification needs a recipient account or an email address.",
  })
  .refine((n) => n.applicationId === undefined || n.orgId !== undefined, {
    message: "A notification about an application names its org.",
  });
export type NotificationInput = z.infer<typeof NotificationInputSchema>;

/**
 * Queues one notification. Returns its id, or `null` when a notification with
 * the same dedupe key already exists (nothing is written then).
 */
export async function queueNotification(tx: Tx, input: NotificationInput): Promise<string | null> {
  const n = NotificationInputSchema.parse(input);
  const rows = await tx
    .insert(notification)
    .values({
      id: newId(),
      recipientAccountId: n.recipientAccountId ?? null,
      toEmail: n.toEmail ?? null,
      orgId: n.orgId ?? null,
      applicationId: n.applicationId ?? null,
      kind: n.kind,
      templateVersion: n.templateVersion,
      title: n.title,
      body: n.body,
      channelEmail: n.channelEmail,
      emailStatus: n.channelEmail ? "queued" : "not_applicable",
      nextAttemptAt: n.channelEmail ? new Date() : null,
      dedupeKey: n.dedupeKey,
    })
    .onConflictDoNothing({ target: notification.dedupeKey })
    .returning({ id: notification.id });
  return rows[0]?.id ?? null;
}
