/**
 * Account plane: rows owned by one person. Row-level security
 * scopes them to `app.account_id` (drizzle/0001_rls_and_triggers.sql).
 * [PD] personal data; [FT] free text scanned by the guard before it is written.
 */
import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { bytea, citext, createdAt, id, textArrayLiteral, tstz } from "@/lib/db/schema/columns";
import {
  accountStatusEnum,
  emailTokenPurposeEnum,
  memberRoleEnum,
  sideEnum,
  sourceTypeEnum,
  tokenRevokedReasonEnum,
} from "@/lib/db/schema/enums";
import { TOKEN_SCOPES } from "@/lib/pipeline/vocab";

export const account = pgTable(
  "account",
  {
    id: id(),
    createdAt: createdAt(),
    email: citext().notNull(), // [PD]
    displayName: text(), // [PD] [FT, personal_name allowed] ≤ 80
    emailVerifiedAt: tstz(),
    lastSignInAt: tstz(),
    status: accountStatusEnum().notNull().default("active"),
    notifyEmail: boolean().notNull().default(true),
    profileHeadline: text(), // [FT] ≤ 200
    availabilityFrom: date(), // month precision: always the 1st
    availabilityTo: date(),
  },
  (t) => [
    unique("account_email_key").on(t.email),
    check("account_display_name_len", sql`char_length(display_name) <= 80`),
    check("account_profile_headline_len", sql`char_length(profile_headline) <= 200`),
    check(
      "account_availability_month",
      sql`(availability_from IS NULL OR extract(day from availability_from) = 1) AND (availability_to IS NULL OR extract(day from availability_to) = 1)`,
    ),
  ],
);

export const emailToken = pgTable(
  "email_token",
  {
    id: id(),
    createdAt: createdAt(),
    email: citext().notNull(), // [PD]
    accountId: uuid(),
    purpose: emailTokenPurposeEnum().notNull(),
    tokenHash: bytea().notNull(), // SHA-256; the token itself is never stored
    orgId: uuid(), // org_invite only
    inviteRoles: memberRoleEnum().array(),
    invitedByMemberId: uuid(),
    expiresAt: tstz().notNull(),
    consumedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "email_token_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("cascade"),
    unique("email_token_token_hash_key").on(t.tokenHash),
    index("email_token_email_created_idx").on(t.email, t.createdAt),
    check("email_token_invite_fields", sql`(purpose = 'org_invite') = (org_id IS NOT NULL AND invite_roles IS NOT NULL)`),
  ],
);

export const webSession = pgTable(
  "web_session",
  {
    id: id(),
    createdAt: createdAt(),
    accountId: uuid().notNull(),
    tokenHash: bytea().notNull(),
    expiresAt: tstz().notNull(), // 30 days absolute
    lastSeenAt: tstz().notNull().defaultNow(), // 7-day idle timeout
    revokedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "web_session_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("cascade"),
    unique("web_session_token_hash_key").on(t.tokenHash),
    index("web_session_account_idx").on(t.accountId),
  ],
);

export const accessToken = pgTable(
  "access_token",
  {
    id: id(),
    createdAt: createdAt(),
    accountId: uuid().notNull(),
    side: sideEnum().notNull(),
    orgId: uuid(), // required when side = employer
    label: text().notNull(), // [FT] ≤ 60
    displayPrefix: text().notNull(), // first 8 characters after `clp_`
    tokenHash: bytea().notNull(), // SHA-256 of the whole token
    scopes: text().array().notNull(),
    expiresAt: tstz().notNull(), // default 90 days, at most 365
    lastUsedAt: tstz(),
    revokedAt: tstz(),
    revokedReason: tokenRevokedReasonEnum(),
  },
  (t) => [
    foreignKey({ name: "access_token_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("cascade"),
    unique("access_token_token_hash_key").on(t.tokenHash),
    index("access_token_account_idx").on(t.accountId),
    check("access_token_side_org", sql`(side = 'employer') = (org_id IS NOT NULL)`),
    check("access_token_label_len", sql`char_length(label) BETWEEN 1 AND 60`),
    check("access_token_display_prefix_len", sql`char_length(display_prefix) = 8`),
    check("access_token_scopes", sql`cardinality(scopes) >= 1 AND scopes <@ ${textArrayLiteral(TOKEN_SCOPES)}`),
    check("access_token_max_lifetime", sql`expires_at <= created_at + interval '365 days'`),
    check("access_token_revoked_reason", sql`(revoked_at IS NULL) = (revoked_reason IS NULL)`),
  ],
);

export const profileEvidence = pgTable(
  "profile_evidence",
  {
    id: id(),
    createdAt: createdAt(),
    accountId: uuid().notNull(),
    sourceType: sourceTypeEnum().notNull(),
    claim: text().notNull(), // [FT] ≤ 1,200
    linkUrl: text(), // http/https only
    tags: text().array().notNull().default(sql`'{}'::text[]`), // [FT] ≤ 10 tags, each ≤ 40
    updatedAt: tstz().notNull().defaultNow(),
    deletedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "profile_evidence_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("cascade"),
    index("profile_evidence_account_idx").on(t.accountId),
    check("profile_evidence_claim_len", sql`char_length(claim) BETWEEN 1 AND 1200`),
    check("profile_evidence_link_scheme", sql`link_url IS NULL OR link_url ~ '^https?://'`),
    check("profile_evidence_tags_count", sql`cardinality(tags) <= 10`),
  ],
);
