/**
 * Tenant plane, organisation. Every row belongs to one employer org;
 * row-level security scopes it to `app.org_id` (0001_rls_and_triggers.sql).
 * Every tenant table carries UNIQUE (org_id, id) so children can point at it
 * with a composite foreign key (org_id, parent_id), which makes a row pointing
 * at another org's parent impossible. Member references are
 * composite too, so a decision can only name a member of the same org.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, id, tstz } from "@/lib/db/schema/columns";
import {
  bgProviderEnum,
  dataRequestKindEnum,
  dataRequestStatusEnum,
  fclStatusEnum,
  impactStepEnum,
  legalHoldReasonEnum,
  legalHoldScopeEnum,
  memberRoleEnum,
  orgStatusEnum,
  orgVerificationEnum,
  providerConnectionStatusEnum,
} from "@/lib/db/schema/enums";
import { account } from "@/lib/db/schema/account";

export const org = pgTable(
  "org",
  {
    id: id(),
    createdAt: createdAt(),
    name: text().notNull(), // [FT, personal_name allowed]
    speedrunCompanySlug: text().notNull(),
    verifiedDomain: text(),
    /** NULL while the org waits for operator approval. */
    verification: orgVerificationEnum(),
    fclStatus: fclStatusEnum().notNull().default("unknown"),
    everifyEnrolled: boolean().notNull().default(false),
    federalContractor: boolean().notNull().default(false),
    retentionYears: smallint().notNull().default(4),
    status: orgStatusEnum().notNull().default("active"),
  },
  (t) => [
    unique("org_speedrun_company_slug_key").on(t.speedrunCompanySlug),
    check("org_retention_years_min", sql`retention_years >= 4`),
  ],
);

export const orgMember = pgTable(
  "org_member",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    accountId: uuid().notNull(),
    roles: memberRoleEnum().array().notNull(),
    invitedByMemberId: uuid(),
    joinedAt: tstz().notNull().defaultNow(),
    removedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "org_member_org_fk", columns: [t.orgId], foreignColumns: [org.id] }),
    foreignKey({ name: "org_member_account_fk", columns: [t.accountId], foreignColumns: [account.id] }),
    foreignKey({ name: "org_member_invited_by_fk", columns: [t.orgId, t.invitedByMemberId], foreignColumns: [t.orgId, t.id] }),
    unique("org_member_org_id_id_key").on(t.orgId, t.id),
    unique("org_member_org_account_key").on(t.orgId, t.accountId),
    index("org_member_account_idx").on(t.accountId),
    check("org_member_roles_nonempty", sql`cardinality(roles) >= 1`),
  ],
);

/** A composite reference to a member of the same org. */
export function memberRef(name: string, orgIdColumn: AnyPgColumn, memberIdColumn: AnyPgColumn) {
  return foreignKey({ name, columns: [orgIdColumn, memberIdColumn], foreignColumns: [orgMember.orgId, orgMember.id] });
}

/** A plain reference to the org, for tables whose parent is the org itself. */
export function orgRef(name: string, orgIdColumn: AnyPgColumn) {
  return foreignKey({ name, columns: [orgIdColumn], foreignColumns: [org.id] });
}

export const providerConnection = pgTable(
  "provider_connection",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    provider: bgProviderEnum().notNull(),
    status: providerConnectionStatusEnum().notNull().default("pending"),
    externalAccountId: text(),
    accessTokenCiphertext: bytea(), // AES-256-GCM, key in PROVIDER_TOKEN_KEY; never leaves the server
    connectedByMemberId: uuid(),
    connectedAt: tstz(),
    credentialedAt: tstz(),
    deauthorizedAt: tstz(),
  },
  (t) => [
    orgRef("provider_connection_org_fk", t.orgId),
    memberRef("provider_connection_connected_by_fk", t.orgId, t.connectedByMemberId),
    unique("provider_connection_org_id_id_key").on(t.orgId, t.id),
    unique("provider_connection_org_provider_key").on(t.orgId, t.provider),
  ],
);

export const legalHold = pgTable(
  "legal_hold",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    scope: legalHoldScopeEnum().notNull(),
    targetId: uuid(), // requisition or application id; NULL for scope = org
    reason: legalHoldReasonEnum().notNull(),
    placedByMemberId: uuid().notNull(),
    placedAt: tstz().notNull().defaultNow(),
    releasedByMemberId: uuid(),
    releasedAt: tstz(),
  },
  (t) => [
    orgRef("legal_hold_org_fk", t.orgId),
    memberRef("legal_hold_placed_by_fk", t.orgId, t.placedByMemberId),
    memberRef("legal_hold_released_by_fk", t.orgId, t.releasedByMemberId),
    unique("legal_hold_org_id_id_key").on(t.orgId, t.id),
    index("legal_hold_org_released_idx").on(t.orgId, t.releasedAt),
    check("legal_hold_target", sql`(scope = 'org') = (target_id IS NULL)`),
  ],
);

export const impactReport = pgTable(
  "impact_report",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requisitionId: uuid(),
    periodStart: date().notNull(),
    periodEnd: date().notNull(),
    step: impactStepEnum().notNull(),
    /** [{ category_key, applicants, selected }] — totals the employer types in; no per-person row exists. */
    rows: jsonb().notNull(),
    computed: jsonb().notNull(),
    enteredByMemberId: uuid().notNull(),
  },
  (t) => [
    orgRef("impact_report_org_fk", t.orgId),
    memberRef("impact_report_entered_by_fk", t.orgId, t.enteredByMemberId),
    unique("impact_report_org_id_id_key").on(t.orgId, t.id),
    index("impact_report_org_idx").on(t.orgId),
    check("impact_report_period", sql`period_end >= period_start`),
  ],
);

export const dataRequest = pgTable(
  "data_request",
  {
    id: id(),
    createdAt: createdAt(),
    /** NULL = a request to the product itself (account plane). */
    orgId: uuid(),
    /** SET NULL when the account is deleted: the employer's record of the request stays. */
    accountId: uuid(),
    kind: dataRequestKindEnum().notNull(),
    status: dataRequestStatusEnum().notNull().default("received"),
    retainedUntil: date(),
    handledByMemberId: uuid(),
    completedAt: tstz(),
  },
  (t) => [
    orgRef("data_request_org_fk", t.orgId),
    foreignKey({ name: "data_request_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("set null"),
    memberRef("data_request_handled_by_fk", t.orgId, t.handledByMemberId),
    index("data_request_org_status_idx").on(t.orgId, t.status),
    index("data_request_account_idx").on(t.accountId),
  ],
);
