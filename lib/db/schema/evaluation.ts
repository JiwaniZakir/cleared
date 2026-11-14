/**
 * Tenant plane, evaluation: what an employer judges. None of it is ever
 * shown to the candidate by default or to another employer.
 * Judgments and grades are labelled levels, never numbers.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, textArrayLiteral, tstz } from "@/lib/db/schema/columns";
import {
  gradeBandEnum,
  gradeReviewStatusEnum,
  interviewKindEnum,
  interviewSchedulingStatusEnum,
  judgeKindEnum,
  judgmentLevelEnum,
  overrideReasonEnum,
  ratingLevelEnum,
  verdictStatusEnum,
} from "@/lib/db/schema/enums";
import { memberRef } from "@/lib/db/schema/org";
import { application, requirement, requisition, workSampleSubmission } from "@/lib/db/schema/application";
import { VERDICT_FLAGS } from "@/lib/pipeline/vocab";

export const judgment = pgTable(
  "judgment",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    requirementId: uuid().notNull(),
    requirementVersion: smallint().notNull(),
    status: verdictStatusEnum().notNull().default("queued"),
    judgeKind: judgeKindEnum().notNull(),
    level: judgmentLevelEnum(),
    basisRef: text(), // E1…
    basisQuote: text(), // verified verbatim substring
    rationale: text(), // [FT] ≤ 300; NULL when the guard rejected it
    flags: text().array().notNull().default(sql`'{}'::text[]`),
    modelId: text(),
    promptVersion: text(),
    requestSha256: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    cacheReadTokens: integer(),
    stopReason: text(),
    rawOutput: jsonb(),
    overridesJudgmentId: uuid(),
    overrideReason: overrideReasonEnum(),
    reviewerMemberId: uuid(),
    runId: uuid(),
  },
  (t) => [
    foreignKey({ name: "judgment_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    foreignKey({ name: "judgment_requirement_fk", columns: [t.orgId, t.requirementId], foreignColumns: [requirement.orgId, requirement.id] }),
    foreignKey({ name: "judgment_overrides_fk", columns: [t.orgId, t.overridesJudgmentId], foreignColumns: [t.orgId, t.id] }),
    memberRef("judgment_reviewer_fk", t.orgId, t.reviewerMemberId),
    unique("judgment_org_id_id_key").on(t.orgId, t.id),
    index("judgment_application_requirement_status_idx").on(t.applicationId, t.requirementId, t.status),
    uniqueIndex("judgment_one_active_key").on(t.applicationId, t.requirementId).where(sql`status = 'active'`),
    check("judgment_rationale_len", sql`char_length(rationale) <= 300`),
    check("judgment_flags", sql`flags <@ ${textArrayLiteral(VERDICT_FLAGS)}`),
    check("judgment_human_override", sql`judge_kind <> 'human' OR reviewer_member_id IS NOT NULL`),
  ],
);

export const workSampleGrade = pgTable(
  "work_sample_grade",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    submissionId: uuid().notNull(),
    criterionKey: text().notNull(),
    specVersion: smallint(),
    status: verdictStatusEnum().notNull().default("queued"),
    judgeKind: judgeKindEnum().notNull(),
    band: gradeBandEnum(),
    basisQuote: text(),
    rationale: text(), // [FT] ≤ 300
    flags: text().array().notNull().default(sql`'{}'::text[]`),
    modelId: text(),
    promptVersion: text(),
    requestSha256: text(),
    inputTokens: integer(),
    outputTokens: integer(),
    cacheReadTokens: integer(),
    stopReason: text(),
    rawOutput: jsonb(),
    runId: uuid(),
    reviewStatus: gradeReviewStatusEnum().notNull().default("pending"),
    overridesGradeId: uuid(),
    reviewerMemberId: uuid(),
    overrideReason: overrideReasonEnum(),
  },
  (t) => [
    foreignKey({ name: "work_sample_grade_submission_fk", columns: [t.orgId, t.submissionId], foreignColumns: [workSampleSubmission.orgId, workSampleSubmission.id] }),
    foreignKey({ name: "work_sample_grade_overrides_fk", columns: [t.orgId, t.overridesGradeId], foreignColumns: [t.orgId, t.id] }),
    memberRef("work_sample_grade_reviewer_fk", t.orgId, t.reviewerMemberId),
    unique("work_sample_grade_org_id_id_key").on(t.orgId, t.id),
    index("work_sample_grade_submission_idx").on(t.submissionId),
    uniqueIndex("work_sample_grade_one_active_key").on(t.submissionId, t.criterionKey).where(sql`status = 'active'`),
    check("work_sample_grade_rationale_len", sql`char_length(rationale) <= 300`),
    check("work_sample_grade_flags", sql`flags <@ ${textArrayLiteral(VERDICT_FLAGS)}`),
  ],
);

export const interview = pgTable(
  "interview",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    applicationId: uuid().notNull(),
    round: smallint().notNull(),
    kind: interviewKindEnum().notNull(),
    /** [{ key, question, traced_to_quote, guidance }] from the existing guide generator. */
    guide: jsonb().notNull().default(sql`'[]'::jsonb`),
    interviewerMemberIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    schedulingStatus: interviewSchedulingStatusEnum().notNull().default("to_schedule"),
    slots: timestamp({ withTimezone: true }).array().notNull().default(sql`'{}'::timestamptz[]`),
    scheduledFor: tstz(),
    durationMin: smallint().notNull(),
    createdByMemberId: uuid().notNull(),
  },
  (t) => [
    foreignKey({ name: "interview_application_fk", columns: [t.orgId, t.applicationId], foreignColumns: [application.orgId, application.id] }),
    memberRef("interview_created_by_fk", t.orgId, t.createdByMemberId),
    unique("interview_org_id_id_key").on(t.orgId, t.id),
    index("interview_application_idx").on(t.applicationId),
    check("interview_round_range", sql`round BETWEEN 1 AND 3`),
  ],
);

export const interviewRating = pgTable(
  "interview_rating",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    interviewId: uuid().notNull(),
    interviewerMemberId: uuid().notNull(),
    questionKey: text().notNull(),
    level: ratingLevelEnum().notNull(),
    note: text(), // [FT] ≤ 500
    submittedAt: tstz().notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "interview_rating_interview_fk", columns: [t.orgId, t.interviewId], foreignColumns: [interview.orgId, interview.id] }),
    memberRef("interview_rating_interviewer_fk", t.orgId, t.interviewerMemberId),
    unique("interview_rating_org_id_id_key").on(t.orgId, t.id),
    unique("interview_rating_one_per_question_key").on(t.interviewId, t.interviewerMemberId, t.questionKey),
    check("interview_rating_note_len", sql`char_length(note) <= 500`),
  ],
);

export const rankingSnapshot = pgTable(
  "ranking_snapshot",
  {
    id: id(),
    createdAt: createdAt(),
    orgId: uuid().notNull(),
    requisitionId: uuid().notNull(),
    algorithmVersion: text().notNull(),
    weights: jsonb().notNull(),
    /** Position, tie group, components and coverage per application id: the record of what a person was shown. */
    entries: jsonb().notNull(),
    requestedByMemberId: uuid().notNull(),
    savedWeights: boolean().notNull().default(false),
  },
  (t) => [
    foreignKey({ name: "ranking_snapshot_requisition_fk", columns: [t.orgId, t.requisitionId], foreignColumns: [requisition.orgId, requisition.id] }),
    memberRef("ranking_snapshot_requested_by_fk", t.orgId, t.requestedByMemberId),
    unique("ranking_snapshot_org_id_id_key").on(t.orgId, t.id),
    index("ranking_snapshot_requisition_created_idx").on(t.requisitionId, t.createdAt),
  ],
);
