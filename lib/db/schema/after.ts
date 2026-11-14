/**
 * Tenant plane, decisions and after. A decision row exists only as the
 * effect of a proposal a named person confirmed on the web, so
 * decision.proposal_id is NOT NULL. bg_check has no result, record or
 * adjudication field: the report stays with the provider.
 */
import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, jsonb, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, textArrayLiteral, tstz } from "@/lib/db/schema/columns";
import {
  adverseActionStatusEnum,
  applicationStageEnum,
  bgCheckStatusEnum,
  bgProviderEnum,
  bgReviewStatusEnum,
  channelEnum,
  checklistKindEnum,
  checklistPhaseEnum,
  checklistStatusEnum,
  decisionOutcomeEnum,
  memberRoleEnum,
  offerExtendedViaEnum,
  offerStatusEnum,
  preadverseChannelEnum,
  proposalKindEnum,
  proposalStatusEnum,
} from "@/lib/db/schema/enums";
import { memberRef } from "@/lib/db/schema/org";
import { application } from "@/lib/db/schema/application";
import { rankingSnapshot } from "@/lib/db/schema/evaluation";
import { DECISION_REASON_CODES, OFFER_CONTINGENCIES } from "@/lib/pipeline/vocab";

export const proposal = pgTable(
  "proposal",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    kind: proposalKindEnum().notNull(),
    payload: jsonb().notNull(), // closed per kind
    proposedByAccountId: uuid().notNull(),
    proposedVia: channelEnum().notNull(),
    confirmerRole: memberRoleEnum().notNull(),
    confirmerMemberId: uuid(), // a specific person, else anyone with the role
    batchId: uuid().notNull(),
    status: proposalStatusEnum().notNull().default("pending"),
    expiresAt: tstz().notNull(), // 7 days
    resolvedByMemberId: uuid(),
    resolvedAt: tstz(),
    resolvedSessionId: uuid(), // resolution happens only through a web session
  },
  (t) => [
    foreignKey({ name: "proposal_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("proposal_confirmer_fk", t.orgId, t.confirmerMemberId),
    memberRef("proposal_resolved_by_fk", t.orgId, t.resolvedByMemberId),
    unique("proposal_org_id_id_key").on(t.orgId, t.id),
    index("proposal_org_status_role_idx").on(t.orgId, t.status, t.confirmerRole),
    index("proposal_batch_idx").on(t.batchId),
    check("proposal_web_resolution", sql`status NOT IN ('confirmed', 'declined') OR (resolved_session_id IS NOT NULL AND resolved_by_member_id IS NOT NULL)`),
  ],
);

export const decision = pgTable(
  "decision",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    fromStage: applicationStageEnum().notNull(),
    outcome: decisionOutcomeEnum().notNull(),
    reasonCodes: text().array().notNull(),
    requirementIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    note: text(), // [FT] ≤ 500
    decidedByMemberId: uuid().notNull(),
    proposalId: uuid().notNull(),
    rankingSnapshotId: uuid(), // what the person saw
    decidedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "decision_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    foreignKey({ name: "decision_proposal_fk", columns: [t.orgId, t.proposalId], foreignColumns: [proposal.orgId, proposal.id] }),
    foreignKey({ name: "decision_ranking_snapshot_fk", columns: [t.orgId, t.rankingSnapshotId], foreignColumns: [rankingSnapshot.orgId, rankingSnapshot.id] }),
    memberRef("decision_decided_by_fk", t.orgId, t.decidedByMemberId),
    unique("decision_org_id_id_key").on(t.orgId, t.id),
    index("decision_application_idx").on(t.applicationId),
    check("decision_reason_codes", sql`cardinality(reason_codes) BETWEEN 1 AND 4 AND reason_codes <@ ${textArrayLiteral(DECISION_REASON_CODES)}`),
    check("decision_note_len", sql`char_length(note) <= 500`),
  ],
);

export const offer = pgTable(
  "offer",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    status: offerStatusEnum().notNull().default("drafting"),
    startDate: date(),
    expiresOn: date(),
    contingencies: text().array().notNull().default(sql`'{}'::text[]`),
    extendedOn: date(),
    extendedVia: offerExtendedViaEnum(),
    extendedRecordedByMemberId: uuid(),
    esignCompletedOn: date(),
    acceptedAt: tstz(), // from the candidate's web statement only
    declinedAt: tstz(),
    rescindedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "offer_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("offer_extended_recorded_by_fk", t.orgId, t.extendedRecordedByMemberId),
    unique("offer_org_id_id_key").on(t.orgId, t.id),
    unique("offer_application_key").on(t.applicationId),
    check("offer_contingencies", sql`contingencies <@ ${textArrayLiteral(OFFER_CONTINGENCIES)}`),
  ],
);

export const bgCheck = pgTable(
  "bg_check",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    provider: bgProviderEnum().notNull(),
    package: text().notNull(),
    providerCandidateId: text(),
    providerInvitationId: text(),
    providerReportId: text(),
    invitationUrl: text(),
    dashboardUrl: text(),
    status: bgCheckStatusEnum().notNull().default("not_ordered"),
    eta: date(),
    orderedByMemberId: uuid().notNull(),
    orderedAt: tstz().notNull().defaultNow(),
    lastEventAt: tstz(),
    reviewStatus: bgReviewStatusEnum().notNull().default("not_reviewed"),
  },
  (t) => [
    foreignKey({ name: "bg_check_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("bg_check_ordered_by_fk", t.orgId, t.orderedByMemberId),
    unique("bg_check_org_id_id_key").on(t.orgId, t.id),
    unique("bg_check_application_key").on(t.applicationId),
    index("bg_check_provider_report_idx").on(t.provider, t.providerReportId),
  ],
);

export const adverseAction = pgTable(
  "adverse_action",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    bgCheckId: uuid().notNull(),
    applicationId: uuid().notNull(),
    status: adverseActionStatusEnum().notNull().default("preadverse_proposed"),
    preadverseSentAt: tstz(),
    preadverseChannel: preadverseChannelEnum(),
    candidateDisputedAt: tstz(),
    earliestFinalAt: tstz(),
    finalSentAt: tstz(),
    startedByMemberId: uuid().notNull(),
    finalByMemberId: uuid(),
    timingAlert: boolean().notNull().default(false),
  },
  (t) => [
    foreignKey({ name: "adverse_action_bg_check_fk", columns: [t.orgId, t.bgCheckId], foreignColumns: [bgCheck.orgId, bgCheck.id] }),
    foreignKey({ name: "adverse_action_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("adverse_action_started_by_fk", t.orgId, t.startedByMemberId),
    memberRef("adverse_action_final_by_fk", t.orgId, t.finalByMemberId),
    unique("adverse_action_org_id_id_key").on(t.orgId, t.id),
    unique("adverse_action_bg_check_key").on(t.bgCheckId),
  ],
);

export const checklistItem = pgTable(
  "checklist_item",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    phase: checklistPhaseEnum().notNull(),
    kind: checklistKindEnum().notNull(),
    ownerRole: memberRoleEnum().notNull(),
    applies: boolean().notNull().default(true),
    status: checklistStatusEnum().notNull().default("pending"),
    outcome: text(), // closed per kind (vocab CHECKLIST_OUTCOMES), checked in code
    dueAt: tstz(),
    doneAt: tstz(),
    doneByMemberId: uuid(),
  },
  (t) => [
    foreignKey({ name: "checklist_item_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("checklist_item_done_by_fk", t.orgId, t.doneByMemberId),
    unique("checklist_item_org_id_id_key").on(t.orgId, t.id),
    unique("checklist_item_application_kind_key").on(t.applicationId, t.kind),
    index("checklist_item_org_status_due_idx").on(t.orgId, t.status, t.dueAt),
  ],
);
