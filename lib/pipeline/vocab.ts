/**
 * The pipeline's closed vocabulary: the one TypeScript source every Postgres
 * enum, every zod enum and every closed text list is generated from.
 *
 * Rules:
 * - Order matters: a Postgres enum's labels are created in this order, and
 *   tests/unit/db/migrations.test.ts checks the database against it.
 * - A value is never renamed or removed here once a migration has created it.
 *   Adding one is a new migration (`ALTER TYPE … ADD VALUE`) named for the
 *   slice that adds it, plus the append here.
 * - This module imports nothing but zod, so the ranking function may import it
 *   (lib/ranking imports only lib/ranking/* and this file).
 */
import { z } from "zod";

// ── People and access ────────────────────────────────────────────────────────

/** Six combinable member roles. Postgres enum `member_role`. */
export const MEMBER_ROLES = ["admin", "recruiter", "decider", "interviewer", "security_officer", "export_lead"] as const;
export type Role = (typeof MEMBER_ROLES)[number];

/** A token and a web view each act for one side, never both. */
export const SIDES = ["candidate", "employer"] as const;
export type Side = (typeof SIDES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended"] as const;
export const EMAIL_TOKEN_PURPOSES = ["sign_in", "change_email", "org_invite"] as const;
export const TOKEN_REVOKED_REASONS = ["owner", "member_removed", "account_deleted", "admin", "suspected_leak"] as const;

/** Closed text list (access_token.scopes ⊆ these; CHECK in the database). */
export const TOKEN_SCOPES = ["pipeline:read", "pipeline:write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];

/** Who acted, for audit_event.actor_kind. */
export const ACTOR_KINDS = ["person_web", "person_agent", "system_timer", "system_webhook"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/** Where a person's statement or proposal came from. */
export const CHANNELS = ["agent", "web"] as const;
export type Channel = (typeof CHANNELS)[number];

// ── Evidence and notices ─────────────────────────────────────────────────────

export const SOURCE_TYPES = ["public_code", "project", "coursework", "prior_work", "publication", "award", "other"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const NOTICE_KINDS = ["privacy_at_collection", "ai_use", "eligibility_wording"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

// ── Organisations ────────────────────────────────────────────────────────────

export const BG_PROVIDERS = ["checkr", "simulator"] as const;
export type BgProvider = (typeof BG_PROVIDERS)[number];

export const ORG_VERIFICATIONS = ["domain_match", "operator_approved"] as const;
export const FCL_STATUSES = ["yes", "no", "unknown"] as const;
export const ORG_STATUSES = ["active", "suspended", "closed"] as const;
export const PROVIDER_CONNECTION_STATUSES = ["pending", "connected", "credentialed", "deauthorized"] as const;
export const LEGAL_HOLD_SCOPES = ["org", "requisition", "application"] as const;
export const LEGAL_HOLD_REASONS = ["charge_or_complaint", "demand_letter", "litigation", "compliance_review", "other"] as const;
export const IMPACT_STEPS = ["screen_to_advance", "advance_to_interview", "interview_to_offer", "overall"] as const;
export const DATA_REQUEST_KINDS = ["access", "deletion", "correction"] as const;
export const DATA_REQUEST_STATUSES = [
  "received",
  "forwarded",
  "in_progress",
  "completed",
  "retained_under_duty",
  "refused_identity",
] as const;

// ── Requisitions and applications ────────────────────────────────────────────

export const REQUISITION_STATUSES = ["draft", "open", "paused", "closed"] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

/** Access types: none, A (export-controlled), B (clearance-eligible), C (active clearance). */
export const ACCESS_CLASSES = ["none", "export_controlled", "clearance_eligible", "active_clearance"] as const;
export type AccessClass = (typeof ACCESS_CLASSES)[number];

export const REQUIREMENT_CATEGORIES = ["responsibility", "qualification", "eligibility"] as const;
export const SIGNAL_BASES = ["stated", "inferred"] as const;
export const REQUIREMENT_PRIORITIES = ["must", "nice", "excluded"] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

/** Active stages first, in pipeline order, then the four terminal ones. */
export const APPLICATION_STAGES = [
  "applied",
  "screening",
  "in_review",
  "work_sample",
  "interviewing",
  "final_review",
  "offer",
  "pre_employment",
  "ready_to_start",
  "started",
  "not_selected",
  "withdrawn",
  "offer_declined",
  "offer_rescinded",
] as const;
export type Stage = (typeof APPLICATION_STAGES)[number];
export const TERMINAL_STAGES = ["not_selected", "withdrawn", "offer_declined", "offer_rescinded"] as const satisfies readonly Stage[];

export const AI_MODES = ["ai_assisted", "human_only"] as const;
export type AiMode = (typeof AI_MODES)[number];

export const WITHDRAWN_REASONS = ["accepted_elsewhere", "not_interested", "timing", "other"] as const;
export const EVIDENCE_ADDED_VIA = ["application", "more_evidence_request"] as const;

export const STATEMENT_KINDS = [
  "notice_acknowledged",
  "ai_evaluation_consent",
  "ai_evaluation_consent_withdrawn",
  "eligibility_answer",
  "offer_acceptance",
  "offer_decline",
  "preadverse_response",
  "accommodation_request",
  "human_review_request",
] as const;

/** The only eligibility questions that can ever be asked. */
export const QUESTION_KEYS = [
  "us_person",
  "us_citizen_for_clearance",
  "work_authorized",
  "needs_sponsorship",
  "holds_active_clearance",
] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];

export const CANDIDATE_REQUEST_KINDS = ["work_sample", "more_evidence", "interview_slots", "background_check"] as const;
export const CANDIDATE_REQUEST_STATUSES = ["open", "answered", "expired", "cancelled"] as const;

// ── Evaluation ───────────────────────────────────────────────────────────────

/** judgment.status and work_sample_grade.status. */
export const VERDICT_STATUSES = ["queued", "active", "superseded", "failed"] as const;
export const JUDGE_KINDS = ["model", "stand_in", "human"] as const;
export type JudgeKind = (typeof JUDGE_KINDS)[number];

/** Labelled levels, never numbers. */
export const JUDGMENT_LEVELS = ["clearly_meets", "meets", "partly_meets", "not_shown", "cannot_judge"] as const;
export type JudgmentLevel = (typeof JUDGMENT_LEVELS)[number];

export const GRADE_BANDS = ["exceptional", "proficient", "developing", "not_demonstrated", "cannot_grade"] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export const GRADE_REVIEW_STATUSES = ["pending", "accepted", "overridden"] as const;
export const OVERRIDE_REASONS = [
  "evidence_misread",
  "quote_out_of_context",
  "requirement_misapplied",
  "flagged_input",
  "context_from_interview",
  "other",
] as const;
export type OverrideReason = (typeof OVERRIDE_REASONS)[number];

/**
 * Closed text list for judgment.flags and work_sample_grade.flags (CHECK in
 * the database): five stored flags, plus `off_topic` from the model's
 * output schema, so the stored list is the union of both.
 */
export const VERDICT_FLAGS = [
  "possible_instructions_in_evidence",
  "unverified_quote",
  "refusal",
  "rationale_rejected_by_guard",
  "insufficient_detail",
  "off_topic",
] as const;

export const INTERVIEW_KINDS = ["screen", "technical", "panel", "final"] as const;
export const INTERVIEW_SCHEDULING_STATUSES = ["to_schedule", "slots_proposed", "scheduled", "completed", "cancelled", "no_show"] as const;
export const RATING_LEVELS = ["strong", "acceptable", "weak", "not_covered"] as const;

// ── Decisions and after ──────────────────────────────────────────────────────

export const PROPOSAL_KINDS = ["selection_decision", "offer_rescind", "preadverse_start", "adverse_final", "bg_proceed"] as const;
export const PROPOSAL_STATUSES = ["pending", "confirmed", "declined", "expired", "superseded"] as const;
export const DECISION_OUTCOMES = ["advance", "not_selected", "make_offer", "offer_rescinded"] as const;

/**
 * Closed text list for decision.reason_codes (CHECK in the database): the
 * selection codes of `propose_decision` plus the rescission codes of
 * `record_step` (a decision row's outcome can be `offer_rescinded`).
 */
export const DECISION_REASON_CODES = [
  // advance
  "meets_must_haves",
  "strong_evidence",
  "strong_work_sample",
  "strong_interview",
  // not selected
  "requirements_not_shown",
  "work_sample_below_bar",
  "interview_below_bar",
  "stronger_candidates_selected",
  "no_response_to_requests",
  "role_filled_or_closed",
  "legal_eligibility_requirement",
  "other_job_related",
  // make offer
  "selected_for_offer",
  // background check, adverse action and rescission (record_step)
  "background_check_review",
  "background_check_adverse",
  "contingency_not_met",
  "candidate_request",
  "role_eliminated",
] as const;
export type DecisionReasonCode = (typeof DECISION_REASON_CODES)[number];

export const OFFER_STATUSES = ["drafting", "extended", "accepted", "declined", "expired", "rescinded"] as const;
export const OFFER_EXTENDED_VIA = ["esign", "email", "in_person"] as const;
/** Closed text list for offer.contingencies (CHECK in the database). */
export const OFFER_CONTINGENCIES = [
  "background_check",
  "form_i9",
  "export_authorization",
  "clearance_eligibility",
  "active_clearance_verification",
  "confidentiality_agreement",
] as const;

export const BG_CHECK_STATUSES = [
  "not_ordered",
  "invited",
  "invitation_expired",
  "consent_completed",
  "report_pending",
  "report_complete",
  "suspended",
  "canceled",
  "disputed",
] as const;
export const BG_REVIEW_STATUSES = ["not_reviewed", "proceed", "adverse_started"] as const;

export const ADVERSE_ACTION_STATUSES = [
  "preadverse_proposed",
  "preadverse_sent",
  "waiting",
  "candidate_responded",
  "final_proposed",
  "final_sent",
  "withdrawn",
] as const;
export const PREADVERSE_CHANNELS = ["provider_dashboard", "employer_letter"] as const;

export const CHECKLIST_PHASES = ["pre_start", "day_one", "first_weeks"] as const;
export const CHECKLIST_KINDS = [
  "confidentiality_agreement",
  "form_i9_section1",
  "form_i9_section2",
  "everify_case",
  "export_determination",
  "restricted_party_screening",
  "clearance_verification",
  "clearance_initiation",
  "sf312_and_briefing",
  "intern_pay_classification",
  "stem_opt_i983",
  "payroll_handoff",
  "state_new_hire_report",
  "required_trainings",
] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];
export const CHECKLIST_STATUSES = ["pending", "in_progress", "done", "blocked", "not_required"] as const;

/** Outcome vocabulary per checklist kind (checked in code; S13). */
export const CHECKLIST_OUTCOMES: Record<ChecklistKind, readonly string[]> = {
  confidentiality_agreement: ["signed"],
  export_determination: ["us_person_confirmed", "license_required", "license_obtained", "not_controlled"],
  restricted_party_screening: ["no_match", "match_resolved", "match_blocking"],
  clearance_verification: ["verified_eligible", "reciprocity_needed", "not_verified"],
  clearance_initiation: ["submitted_to_government", "interim_granted", "eligibility_granted", "eligibility_denied"],
  sf312_and_briefing: ["completed"],
  form_i9_section1: ["completed"],
  form_i9_section2: ["completed"],
  everify_case: ["case_created", "not_required_active_clearance"],
  payroll_handoff: ["done"],
  state_new_hire_report: ["done"],
  intern_pay_classification: ["paid_employee", "unpaid_reviewed_by_counsel"],
  stem_opt_i983: ["signed"],
  required_trainings: ["assigned", "completed"],
};

// ── Cross-cutting ────────────────────────────────────────────────────────────

export const EMAIL_STATUSES = ["not_applicable", "queued", "sent", "failed", "suppressed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/**
 * Closed list of audit_event.action values ("dotted, closed list").
 * Checked in code by lib/pipeline/audit.ts; adding one is an append here.
 */
export const AUDIT_ACTIONS = [
  // account plane
  "account.created",
  "account.signed_in",
  "account.display_name_set",
  "account.email_changed",
  "account.sessions_revoked",
  "account.deleted",
  "account.data_exported",
  "token.created",
  "token.revoked",
  "profile.evidence_added",
  "profile.evidence_updated",
  "profile.evidence_deleted",
  // organisations
  "org.created",
  "org.verification_requested",
  "org.approved",
  "org.updated",
  "org.member_invited",
  "org.member_added",
  "org.member_roles_changed",
  "org.member_removed",
  "provider.connected",
  "provider.credentialed",
  "provider.deauthorized",
  "legal_hold.placed",
  "legal_hold.released",
  "impact_report.entered",
  "data_request.created",
  "data_request.forwarded",
  "data_request.updated",
  "data_request.completed",
  // requisitions
  "requisition.created",
  "requisition.updated",
  "requisition.requirements_changed",
  "requisition.access_class_confirmed",
  "requisition.rubric_approved",
  "requisition.status_changed",
  "requisition.weights_changed",
  // applications
  "application.submitted",
  "application.stage_changed",
  "application.withdrawn",
  "application.ai_mode_changed",
  "application.accommodation_requested",
  "application.accommodation_handled",
  "application.deleted",
  "statement.recorded",
  "request.created",
  "request.answered",
  "request.expired",
  "request.extended",
  "request.cancelled",
  "work_sample.submitted",
  // evaluation
  "judgment.queued",
  "judgment.recorded",
  "judgment.failed",
  "judgment.overridden",
  "grade.recorded",
  "grade.reviewed",
  "interview.created",
  "interview.scheduled",
  "interview.status_changed",
  "interview.completed",
  "rating.recorded",
  "ranking.computed",
  // decisions and after
  "proposal.created",
  "proposal.confirmed",
  "proposal.declined",
  "proposal.expired",
  "proposal.superseded",
  "decision.recorded",
  "offer.drafted",
  "offer.details_set",
  "offer.extended",
  "offer.esign_completed",
  "offer.accepted",
  "offer.declined",
  "offer.expired",
  "offer.rescinded",
  "bg.ordered",
  "bg.status_changed",
  "bg.review_proceed",
  "bg.provider_adjudication_used",
  "adverse.preadverse_proposed",
  "adverse.preadverse_sent",
  "adverse.candidate_responded",
  "adverse.final_proposed",
  "adverse.final_sent",
  "adverse.withdrawn",
  "adverse.out_of_sequence",
  "checklist.created",
  "checklist.updated",
  "start.recorded",
  // retention
  "retention.anchor_set",
  "retention.purged",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ── Postgres enums ───────────────────────────────────────────────────────────

/**
 * Every Postgres enum type, by its database name. lib/db/schema/enums.ts
 * builds one `pgEnum` per entry and tests/unit/db/migrations.test.ts checks
 * that the migrated database has exactly these types with exactly these
 * labels in this order.
 */
export const PG_ENUMS = {
  member_role: MEMBER_ROLES,
  side: SIDES,
  account_status: ACCOUNT_STATUSES,
  email_token_purpose: EMAIL_TOKEN_PURPOSES,
  token_revoked_reason: TOKEN_REVOKED_REASONS,
  actor_kind: ACTOR_KINDS,
  channel: CHANNELS,
  source_type: SOURCE_TYPES,
  notice_kind: NOTICE_KINDS,
  bg_provider: BG_PROVIDERS,
  org_verification: ORG_VERIFICATIONS,
  fcl_status: FCL_STATUSES,
  org_status: ORG_STATUSES,
  provider_connection_status: PROVIDER_CONNECTION_STATUSES,
  legal_hold_scope: LEGAL_HOLD_SCOPES,
  legal_hold_reason: LEGAL_HOLD_REASONS,
  impact_step: IMPACT_STEPS,
  data_request_kind: DATA_REQUEST_KINDS,
  data_request_status: DATA_REQUEST_STATUSES,
  requisition_status: REQUISITION_STATUSES,
  access_class: ACCESS_CLASSES,
  requirement_category: REQUIREMENT_CATEGORIES,
  signal_basis: SIGNAL_BASES,
  requirement_priority: REQUIREMENT_PRIORITIES,
  application_stage: APPLICATION_STAGES,
  ai_mode: AI_MODES,
  withdrawn_reason: WITHDRAWN_REASONS,
  evidence_added_via: EVIDENCE_ADDED_VIA,
  statement_kind: STATEMENT_KINDS,
  question_key: QUESTION_KEYS,
  candidate_request_kind: CANDIDATE_REQUEST_KINDS,
  candidate_request_status: CANDIDATE_REQUEST_STATUSES,
  verdict_status: VERDICT_STATUSES,
  judge_kind: JUDGE_KINDS,
  judgment_level: JUDGMENT_LEVELS,
  grade_band: GRADE_BANDS,
  grade_review_status: GRADE_REVIEW_STATUSES,
  override_reason: OVERRIDE_REASONS,
  interview_kind: INTERVIEW_KINDS,
  interview_scheduling_status: INTERVIEW_SCHEDULING_STATUSES,
  rating_level: RATING_LEVELS,
  proposal_kind: PROPOSAL_KINDS,
  proposal_status: PROPOSAL_STATUSES,
  decision_outcome: DECISION_OUTCOMES,
  offer_status: OFFER_STATUSES,
  offer_extended_via: OFFER_EXTENDED_VIA,
  bg_check_status: BG_CHECK_STATUSES,
  bg_review_status: BG_REVIEW_STATUSES,
  adverse_action_status: ADVERSE_ACTION_STATUSES,
  preadverse_channel: PREADVERSE_CHANNELS,
  checklist_phase: CHECKLIST_PHASES,
  checklist_kind: CHECKLIST_KINDS,
  checklist_status: CHECKLIST_STATUSES,
  email_status: EMAIL_STATUSES,
} as const;

/**
 * Closed text lists stored as `text[]` and held to their list by a database
 * CHECK (`column <@ ARRAY[…]`). The migrations test compares each CHECK with
 * these lists.
 */
export const CHECKED_TEXT_LISTS = {
  "access_token.scopes": TOKEN_SCOPES,
  "judgment.flags": VERDICT_FLAGS,
  "work_sample_grade.flags": VERDICT_FLAGS,
  "decision.reason_codes": DECISION_REASON_CODES,
  "offer.contingencies": OFFER_CONTINGENCIES,
} as const;

// ── zod mirrors, for tool schemas ────────────────────────────────────────────

export const RoleSchema = z.enum(MEMBER_ROLES);
export const SideSchema = z.enum(SIDES);
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export const StageSchema = z.enum(APPLICATION_STAGES);
export const AccessClassSchema = z.enum(ACCESS_CLASSES);
export const QuestionKeySchema = z.enum(QUESTION_KEYS);
export const JudgmentLevelSchema = z.enum(JUDGMENT_LEVELS);
export const GradeBandSchema = z.enum(GRADE_BANDS);
export const OverrideReasonSchema = z.enum(OVERRIDE_REASONS);
export const RatingLevelSchema = z.enum(RATING_LEVELS);
export const InterviewKindSchema = z.enum(INTERVIEW_KINDS);
export const WithdrawnReasonSchema = z.enum(WITHDRAWN_REASONS);
export const ChecklistKindSchema = z.enum(CHECKLIST_KINDS);
export const ChecklistStatusSchema = z.enum(CHECKLIST_STATUSES);
export const DecisionReasonCodeSchema = z.enum(DECISION_REASON_CODES);
export const OfferContingencySchema = z.enum(OFFER_CONTINGENCIES);
export const AuditActionSchema = z.enum(AUDIT_ACTIONS);
