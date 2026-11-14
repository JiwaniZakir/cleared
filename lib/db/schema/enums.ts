/**
 * One Postgres enum per entry of PG_ENUMS in lib/pipeline/vocab.ts, the single
 * source of every value. tests/unit/db/migrations.test.ts checks the
 * migrated database against PG_ENUMS.
 */
import { pgEnum } from "drizzle-orm/pg-core";
import { PG_ENUMS as E } from "@/lib/pipeline/vocab";

export const memberRoleEnum = pgEnum("member_role", E.member_role);
export const sideEnum = pgEnum("side", E.side);
export const accountStatusEnum = pgEnum("account_status", E.account_status);
export const emailTokenPurposeEnum = pgEnum("email_token_purpose", E.email_token_purpose);
export const tokenRevokedReasonEnum = pgEnum("token_revoked_reason", E.token_revoked_reason);
export const actorKindEnum = pgEnum("actor_kind", E.actor_kind);
export const channelEnum = pgEnum("channel", E.channel);
export const sourceTypeEnum = pgEnum("source_type", E.source_type);
export const noticeKindEnum = pgEnum("notice_kind", E.notice_kind);
export const bgProviderEnum = pgEnum("bg_provider", E.bg_provider);
export const orgVerificationEnum = pgEnum("org_verification", E.org_verification);
export const fclStatusEnum = pgEnum("fcl_status", E.fcl_status);
export const orgStatusEnum = pgEnum("org_status", E.org_status);
export const providerConnectionStatusEnum = pgEnum("provider_connection_status", E.provider_connection_status);
export const legalHoldScopeEnum = pgEnum("legal_hold_scope", E.legal_hold_scope);
export const legalHoldReasonEnum = pgEnum("legal_hold_reason", E.legal_hold_reason);
export const impactStepEnum = pgEnum("impact_step", E.impact_step);
export const dataRequestKindEnum = pgEnum("data_request_kind", E.data_request_kind);
export const dataRequestStatusEnum = pgEnum("data_request_status", E.data_request_status);
export const requisitionStatusEnum = pgEnum("requisition_status", E.requisition_status);
export const accessClassEnum = pgEnum("access_class", E.access_class);
export const requirementCategoryEnum = pgEnum("requirement_category", E.requirement_category);
export const signalBasisEnum = pgEnum("signal_basis", E.signal_basis);
export const requirementPriorityEnum = pgEnum("requirement_priority", E.requirement_priority);
export const applicationStageEnum = pgEnum("application_stage", E.application_stage);
export const aiModeEnum = pgEnum("ai_mode", E.ai_mode);
export const withdrawnReasonEnum = pgEnum("withdrawn_reason", E.withdrawn_reason);
export const evidenceAddedViaEnum = pgEnum("evidence_added_via", E.evidence_added_via);
export const statementKindEnum = pgEnum("statement_kind", E.statement_kind);
export const questionKeyEnum = pgEnum("question_key", E.question_key);
export const candidateRequestKindEnum = pgEnum("candidate_request_kind", E.candidate_request_kind);
export const candidateRequestStatusEnum = pgEnum("candidate_request_status", E.candidate_request_status);
export const verdictStatusEnum = pgEnum("verdict_status", E.verdict_status);
export const judgeKindEnum = pgEnum("judge_kind", E.judge_kind);
export const judgmentLevelEnum = pgEnum("judgment_level", E.judgment_level);
export const gradeBandEnum = pgEnum("grade_band", E.grade_band);
export const gradeReviewStatusEnum = pgEnum("grade_review_status", E.grade_review_status);
export const overrideReasonEnum = pgEnum("override_reason", E.override_reason);
export const interviewKindEnum = pgEnum("interview_kind", E.interview_kind);
export const interviewSchedulingStatusEnum = pgEnum("interview_scheduling_status", E.interview_scheduling_status);
export const ratingLevelEnum = pgEnum("rating_level", E.rating_level);
export const proposalKindEnum = pgEnum("proposal_kind", E.proposal_kind);
export const proposalStatusEnum = pgEnum("proposal_status", E.proposal_status);
export const decisionOutcomeEnum = pgEnum("decision_outcome", E.decision_outcome);
export const offerStatusEnum = pgEnum("offer_status", E.offer_status);
export const offerExtendedViaEnum = pgEnum("offer_extended_via", E.offer_extended_via);
export const bgCheckStatusEnum = pgEnum("bg_check_status", E.bg_check_status);
export const bgReviewStatusEnum = pgEnum("bg_review_status", E.bg_review_status);
export const adverseActionStatusEnum = pgEnum("adverse_action_status", E.adverse_action_status);
export const preadverseChannelEnum = pgEnum("preadverse_channel", E.preadverse_channel);
export const checklistPhaseEnum = pgEnum("checklist_phase", E.checklist_phase);
export const checklistKindEnum = pgEnum("checklist_kind", E.checklist_kind);
export const checklistStatusEnum = pgEnum("checklist_status", E.checklist_status);
export const emailStatusEnum = pgEnum("email_status", E.email_status);
