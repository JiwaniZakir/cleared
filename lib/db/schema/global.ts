/**
 * Global tables: no owner, no row-level security.
 * notice_version is public text seeded by migration; processed_webhook is
 * system-only de-duplication (bodies are never stored).
 */
import { index, pgTable, text, unique } from "drizzle-orm/pg-core";
import { createdAt, id, tstz } from "@/lib/db/schema/columns";
import { bgProviderEnum, noticeKindEnum } from "@/lib/db/schema/enums";

export const noticeVersion = pgTable(
  "notice_version",
  {
    id: id(),
    createdAt: createdAt(),
    kind: noticeKindEnum().notNull(),
    version: text().notNull(), // e.g. ai-use-2026-11.1
    body: text().notNull(), // Markdown, always rendered as text, never as HTML
    bodySha256: text().notNull(),
    publishedAt: tstz().notNull(),
    retiredAt: tstz(),
  },
  (t) => [unique("notice_version_kind_version_key").on(t.kind, t.version)],
);

export const processedWebhook = pgTable(
  "processed_webhook",
  {
    id: id(),
    createdAt: createdAt(),
    provider: bgProviderEnum().notNull(),
    eventId: text().notNull(),
    eventType: text().notNull(),
    receivedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    unique("processed_webhook_provider_event_key").on(t.provider, t.eventId),
    index("processed_webhook_received_idx").on(t.receivedAt),
  ],
);
