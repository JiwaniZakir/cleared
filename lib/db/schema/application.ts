/**
 * Tenant plane, role and application. Each row belongs to one employer
 * org. An application is a snapshot, not a reference: evidence is copied from
 * the candidate's profile at submission.
 */
import { sql } from "drizzle-orm";
import {
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { citext, createdAt, id, tstz } from "@/lib/db/schema/columns";
import {
  accessClassEnum,
  aiModeEnum,
  applicationStageEnum,
  candidateRequestKindEnum,
  candidateRequestStatusEnum,
  channelEnum,
  evidenceAddedViaEnum,
  questionKeyEnum,
  requirementCategoryEnum,
  requirementPriorityEnum,
  requisitionStatusEnum,
  signalBasisEnum,
  sourceTypeEnum,
  statementKindEnum,
  withdrawnReasonEnum,
} from "@/lib/db/schema/enums";
import { account } from "@/lib/db/schema/account";
import { noticeVersion } from "@/lib/db/schema/global";
import { memberRef, orgRef } from "@/lib/db/schema/org";

export const requisition = pgTable(
  "requisition",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    speedrunRoleId: text().notNull(), // the posting's UUID
    status: requisitionStatusEnum().notNull().default("draft"),
    /** Title, company, location, comp, labels, signals, apply link, published_at, description SHA-256. */
    roleSnapshot: jsonb().notNull(),
    postingText: text().notNull(), // public posting text, kept for the Illinois posting record
    workCountry: text(),
    workState: text(),
    workCity: text(),
    accessClass: accessClassEnum().notNull().default("none"),
    accessClassProposedFrom: text().array().notNull().default(sql`'{}'::text[]`),
    accessClassConfirmedByMemberId: uuid(),
    accessClassConfirmedAt: tstz(),
    /** { use_work_sample, work_sample_minutes, interview_rounds, interview_minutes } */
    plan: jsonb().notNull().default(sql`'{}'::jsonb`),
    componentWeights: jsonb().notNull().default(sql`'{"requirements":1,"work_sample":1,"interview":1}'::jsonb`),
    aiNoticePostedOn: date(),
    openedByMemberId: uuid().notNull(),
    closedAt: tstz(),
    retentionAnchorAt: tstz(),
    purgeAfter: date(),
  },
  (t) => [
    orgRef("requisition_org_fk", t.orgId),
    memberRef("requisition_access_class_confirmed_by_fk", t.orgId, t.accessClassConfirmedByMemberId),
    memberRef("requisition_opened_by_fk", t.orgId, t.openedByMemberId),
    unique("requisition_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("requisition_org_role_open_key").on(t.orgId, t.speedrunRoleId).where(sql`status <> 'closed'`),
    index("requisition_org_status_idx").on(t.orgId, t.status),
    check("requisition_work_country", sql`work_country IS NULL OR work_country = 'US'`),
    check("requisition_work_state", sql`work_state IS NULL OR work_state ~ '^[A-Z]{2}$'`),
  ],
);

export const requirement = pgTable(
  "requirement",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requisitionId: uuid().notNull(),
    ordinal: smallint().notNull(),
    quote: text().notNull(), // verbatim posting bullet; never edited
    category: requirementCategoryEnum().notNull(),
    signalValue: text(), // eligibility only, e.g. us_person_required
    signalBasis: signalBasisEnum(),
    priority: requirementPriorityEnum().notNull(),
    weight: smallint().notNull(),
    version: smallint().notNull().default(1),
  },
  (t) => [
    foreignKey({ name: "requirement_requisition_fk", columns: [t.orgId, t.requisitionId], foreignColumns: [requisition.orgId, requisition.id] }),
    unique("requirement_org_id_id_key").on(t.orgId, t.id),
    unique("requirement_requisition_ordinal_key").on(t.requisitionId, t.ordinal),
    check("requirement_weight_range", sql`weight BETWEEN 0 AND 5`),
    // Eligibility is never scored, so its weight is always 0.
    check("requirement_eligibility_unweighted", sql`category <> 'eligibility' OR weight = 0`),
    check("requirement_signal_only_eligibility", sql`category = 'eligibility' OR (signal_value IS NULL AND signal_basis IS NULL)`),
  ],
);

export const workSampleSpec = pgTable(
  "work_sample_spec",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requisitionId: uuid().notNull(),
    minutes: smallint().notNull(),
    brief: text().notNull(),
    /** [{ key, criterion, traced_to_quote, bands: { exceptional, proficient, developing, not_demonstrated } }] */
    rubric: jsonb().notNull(),
    generatorVersion: text().notNull(),
    approvedByMemberId: uuid(),
    approvedAt: tstz(),
    version: smallint().notNull().default(1),
  },
  (t) => [
    foreignKey({ name: "work_sample_spec_requisition_fk", columns: [t.orgId, t.requisitionId], foreignColumns: [requisition.orgId, requisition.id] }),
    memberRef("work_sample_spec_approved_by_fk", t.orgId, t.approvedByMemberId),
    unique("work_sample_spec_org_id_id_key").on(t.orgId, t.id),
    index("work_sample_spec_requisition_idx").on(t.requisitionId),
  ],
);

export const application = pgTable(
  "application",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requisitionId: uuid().notNull(),
    /** SET NULL when the candidate deletes their account; the snapshot below stays. */
    candidateAccountId: uuid(),
    applicantName: text().notNull(), // [PD] snapshot at submission
    applicantEmail: citext().notNull(), // [PD] snapshot at submission
    stage: applicationStageEnum().notNull().default("applied"),
    stageChangedAt: tstz().notNull().defaultNow(),
    aiMode: aiModeEnum().notNull(),
    accommodationRequested: boolean().notNull().default(false),
    availabilityFrom: date(),
    availabilityTo: date(),
    submittedAt: tstz().notNull().defaultNow(),
    /** The agent-generated idempotency key of submit_application: a replay returns the first result. */
    submissionIdempotencyKey: uuid(),
    withdrawnAt: tstz(),
    withdrawnReason: withdrawnReasonEnum(),
    outcomeNotifiedAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "application_requisition_fk", columns: [t.orgId, t.requisitionId], foreignColumns: [requisition.orgId, requisition.id] }),
    foreignKey({ name: "application_candidate_account_fk", columns: [t.candidateAccountId], foreignColumns: [account.id] }).onDelete("set null"),
    unique("application_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("application_requisition_candidate_active_key")
      .on(t.requisitionId, t.candidateAccountId)
      .where(sql`withdrawn_at IS NULL`),
    uniqueIndex("application_idempotency_key").on(t.candidateAccountId, t.submissionIdempotencyKey),
    index("application_org_requisition_stage_idx").on(t.orgId, t.requisitionId, t.stage),
    index("application_candidate_idx").on(t.candidateAccountId),
    check(
      "application_availability_month",
      sql`(availability_from IS NULL OR extract(day from availability_from) = 1) AND (availability_to IS NULL OR extract(day from availability_to) = 1)`,
    ),
    check("application_withdrawn_fields", sql`(withdrawn_at IS NULL) = (withdrawn_reason IS NULL)`),
  ],
);

export const evidenceItem = pgTable(
  "evidence_item",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    ref: text().notNull(), // E1…E20, stable per application
    requirementId: uuid(), // the requirement the candidate meant it for; advisory
    sourceType: sourceTypeEnum().notNull(),
    claim: text().notNull(), // [FT] ≤ 1,200
    linkUrl: text(),
    sourceProfileEvidenceId: uuid(), // no FK: the profile row may be deleted
    addedVia: evidenceAddedViaEnum().notNull(),
    supersedesId: uuid(),
  },
  (t) => [
    foreignKey({ name: "evidence_item_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    foreignKey({ name: "evidence_item_requirement_fk", columns: [t.orgId, t.requirementId], foreignColumns: [requirement.orgId, requirement.id] }),
    foreignKey({ name: "evidence_item_supersedes_fk", columns: [t.orgId, t.supersedesId], foreignColumns: [t.orgId, t.id] }),
    unique("evidence_item_org_id_id_key").on(t.orgId, t.id),
    unique("evidence_item_application_ref_key").on(t.applicationId, t.ref),
    check("evidence_item_ref_shape", sql`ref ~ '^E([1-9]|1[0-9]|20)$'`),
    check("evidence_item_claim_len", sql`char_length(claim) BETWEEN 1 AND 1200`),
    check("evidence_item_link_scheme", sql`link_url IS NULL OR link_url ~ '^https?://'`),
  ],
);

export const candidateStatement = pgTable(
  "candidate_statement",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid(),
    requisitionId: uuid().notNull(),
    /** SET NULL when the candidate deletes their account; the employer's record stays. */
    accountId: uuid(),
    kind: statementKindEnum().notNull(),
    noticeVersionId: uuid(),
    questionKey: questionKeyEnum(),
    answer: text(), // closed per question key, checked in code
    channel: channelEnum().notNull(),
    tokenId: uuid(),
    sessionId: uuid(),
    statedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "candidate_statement_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    foreignKey({ name: "candidate_statement_requisition_fk", columns: [t.orgId, t.requisitionId], foreignColumns: [requisition.orgId, requisition.id] }),
    foreignKey({ name: "candidate_statement_account_fk", columns: [t.accountId], foreignColumns: [account.id] }).onDelete("set null"),
    foreignKey({ name: "candidate_statement_notice_version_fk", columns: [t.noticeVersionId], foreignColumns: [noticeVersion.id] }),
    unique("candidate_statement_org_id_id_key").on(t.orgId, t.id),
    index("candidate_statement_application_idx").on(t.applicationId),
    index("candidate_statement_account_idx").on(t.accountId),
    check("candidate_statement_question", sql`(kind = 'eligibility_answer') = (question_key IS NOT NULL)`),
    check("candidate_statement_channel_ref", sql`(channel = 'agent' AND token_id IS NOT NULL) OR (channel = 'web' AND session_id IS NOT NULL)`),
  ],
);

export const candidateRequest = pgTable(
  "candidate_request",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    kind: candidateRequestKindEnum().notNull(),
    /** Closed per kind: spec id; requirement ids; slot list; provider link. Never employer-written text. */
    payload: jsonb().notNull(),
    status: candidateRequestStatusEnum().notNull().default("open"),
    dueAt: tstz(),
    extendedUntil: tstz(),
    createdByMemberId: uuid(),
    answeredAt: tstz(),
  },
  (t) => [
    foreignKey({ name: "candidate_request_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("candidate_request_created_by_fk", t.orgId, t.createdByMemberId),
    unique("candidate_request_org_id_id_key").on(t.orgId, t.id),
    index("candidate_request_application_status_idx").on(t.applicationId, t.status),
    index("candidate_request_org_status_due_idx").on(t.orgId, t.status, t.dueAt),
  ],
);

export const workSampleSubmission = pgTable(
  "work_sample_submission",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requestId: uuid().notNull(),
    body: text().notNull(), // [FT] ≤ 50,000
    linkUrl: text(),
    bodySha256: text().notNull(),
    /** The candidate attests no export-controlled, classified or personal data. */
    attestedClean: boolean().notNull(),
    late: boolean().notNull().default(false),
    submittedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "work_sample_submission_request_fk", columns: [t.orgId, t.requestId], foreignColumns: [candidateRequest.orgId, candidateRequest.id] }),
    unique("work_sample_submission_org_id_id_key").on(t.orgId, t.id),
    unique("work_sample_submission_request_key").on(t.requestId),
    check("work_sample_submission_body_len", sql`char_length(body) BETWEEN 1 AND 50000`),
    check("work_sample_submission_attested", sql`attested_clean`),
    check("work_sample_submission_link_scheme", sql`link_url IS NULL OR link_url ~ '^https?://'`),
  ],
);
