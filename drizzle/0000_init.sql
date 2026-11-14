-- citext backs account.email, application.applicant_email and the email columns (§2.3).
-- Added by hand ahead of the generated statements: drizzle-kit does not emit extensions.
-- No id column has a database default: every id comes from newId() (lib/db/ids.ts).
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE TYPE "public"."access_class" AS ENUM('none', 'export_controlled', 'clearance_eligible', 'active_clearance');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."actor_kind" AS ENUM('person_web', 'person_agent', 'system_timer', 'system_webhook');--> statement-breakpoint
CREATE TYPE "public"."adverse_action_status" AS ENUM('preadverse_proposed', 'preadverse_sent', 'waiting', 'candidate_responded', 'final_proposed', 'final_sent', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."ai_mode" AS ENUM('ai_assisted', 'human_only');--> statement-breakpoint
CREATE TYPE "public"."application_stage" AS ENUM('applied', 'screening', 'in_review', 'work_sample', 'interviewing', 'final_review', 'offer', 'pre_employment', 'ready_to_start', 'started', 'not_selected', 'withdrawn', 'offer_declined', 'offer_rescinded');--> statement-breakpoint
CREATE TYPE "public"."bg_check_status" AS ENUM('not_ordered', 'invited', 'invitation_expired', 'consent_completed', 'report_pending', 'report_complete', 'suspended', 'canceled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."bg_provider" AS ENUM('checkr', 'simulator');--> statement-breakpoint
CREATE TYPE "public"."bg_review_status" AS ENUM('not_reviewed', 'proceed', 'adverse_started');--> statement-breakpoint
CREATE TYPE "public"."candidate_request_kind" AS ENUM('work_sample', 'more_evidence', 'interview_slots', 'background_check');--> statement-breakpoint
CREATE TYPE "public"."candidate_request_status" AS ENUM('open', 'answered', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('agent', 'web');--> statement-breakpoint
CREATE TYPE "public"."checklist_kind" AS ENUM('confidentiality_agreement', 'form_i9_section1', 'form_i9_section2', 'everify_case', 'export_determination', 'restricted_party_screening', 'clearance_verification', 'clearance_initiation', 'sf312_and_briefing', 'intern_pay_classification', 'stem_opt_i983', 'payroll_handoff', 'state_new_hire_report', 'required_trainings');--> statement-breakpoint
CREATE TYPE "public"."checklist_phase" AS ENUM('pre_start', 'day_one', 'first_weeks');--> statement-breakpoint
CREATE TYPE "public"."checklist_status" AS ENUM('pending', 'in_progress', 'done', 'blocked', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."data_request_kind" AS ENUM('access', 'deletion', 'correction');--> statement-breakpoint
CREATE TYPE "public"."data_request_status" AS ENUM('received', 'forwarded', 'in_progress', 'completed', 'retained_under_duty', 'refused_identity');--> statement-breakpoint
CREATE TYPE "public"."decision_outcome" AS ENUM('advance', 'not_selected', 'make_offer', 'offer_rescinded');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('not_applicable', 'queued', 'sent', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."email_token_purpose" AS ENUM('sign_in', 'change_email', 'org_invite');--> statement-breakpoint
CREATE TYPE "public"."evidence_added_via" AS ENUM('application', 'more_evidence_request');--> statement-breakpoint
CREATE TYPE "public"."fcl_status" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."grade_band" AS ENUM('exceptional', 'proficient', 'developing', 'not_demonstrated', 'cannot_grade');--> statement-breakpoint
CREATE TYPE "public"."grade_review_status" AS ENUM('pending', 'accepted', 'overridden');--> statement-breakpoint
CREATE TYPE "public"."impact_step" AS ENUM('screen_to_advance', 'advance_to_interview', 'interview_to_offer', 'overall');--> statement-breakpoint
CREATE TYPE "public"."interview_kind" AS ENUM('screen', 'technical', 'panel', 'final');--> statement-breakpoint
CREATE TYPE "public"."interview_scheduling_status" AS ENUM('to_schedule', 'slots_proposed', 'scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."judge_kind" AS ENUM('model', 'stand_in', 'human');--> statement-breakpoint
CREATE TYPE "public"."judgment_level" AS ENUM('clearly_meets', 'meets', 'partly_meets', 'not_shown', 'cannot_judge');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_reason" AS ENUM('charge_or_complaint', 'demand_letter', 'litigation', 'compliance_review', 'other');--> statement-breakpoint
CREATE TYPE "public"."legal_hold_scope" AS ENUM('org', 'requisition', 'application');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'recruiter', 'decider', 'interviewer', 'security_officer', 'export_lead');--> statement-breakpoint
CREATE TYPE "public"."notice_kind" AS ENUM('privacy_at_collection', 'ai_use', 'eligibility_wording');--> statement-breakpoint
CREATE TYPE "public"."offer_extended_via" AS ENUM('esign', 'email', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('drafting', 'extended', 'accepted', 'declined', 'expired', 'rescinded');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."org_verification" AS ENUM('domain_match', 'operator_approved');--> statement-breakpoint
CREATE TYPE "public"."override_reason" AS ENUM('evidence_misread', 'quote_out_of_context', 'requirement_misapplied', 'flagged_input', 'context_from_interview', 'other');--> statement-breakpoint
CREATE TYPE "public"."preadverse_channel" AS ENUM('provider_dashboard', 'employer_letter');--> statement-breakpoint
CREATE TYPE "public"."proposal_kind" AS ENUM('selection_decision', 'offer_rescind', 'preadverse_start', 'adverse_final', 'bg_proceed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'confirmed', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."provider_connection_status" AS ENUM('pending', 'connected', 'credentialed', 'deauthorized');--> statement-breakpoint
CREATE TYPE "public"."question_key" AS ENUM('us_person', 'us_citizen_for_clearance', 'work_authorized', 'needs_sponsorship', 'holds_active_clearance');--> statement-breakpoint
CREATE TYPE "public"."rating_level" AS ENUM('strong', 'acceptable', 'weak', 'not_covered');--> statement-breakpoint
CREATE TYPE "public"."requirement_category" AS ENUM('responsibility', 'qualification', 'eligibility');--> statement-breakpoint
CREATE TYPE "public"."requirement_priority" AS ENUM('must', 'nice', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."requisition_status" AS ENUM('draft', 'open', 'paused', 'closed');--> statement-breakpoint
CREATE TYPE "public"."side" AS ENUM('candidate', 'employer');--> statement-breakpoint
CREATE TYPE "public"."signal_basis" AS ENUM('stated', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('public_code', 'project', 'coursework', 'prior_work', 'publication', 'award', 'other');--> statement-breakpoint
CREATE TYPE "public"."statement_kind" AS ENUM('notice_acknowledged', 'ai_evaluation_consent', 'ai_evaluation_consent_withdrawn', 'eligibility_answer', 'offer_acceptance', 'offer_decline', 'preadverse_response', 'accommodation_request', 'human_review_request');--> statement-breakpoint
CREATE TYPE "public"."token_revoked_reason" AS ENUM('owner', 'member_removed', 'account_deleted', 'admin', 'suspected_leak');--> statement-breakpoint
CREATE TYPE "public"."verdict_status" AS ENUM('queued', 'active', 'superseded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."withdrawn_reason" AS ENUM('accepted_elsewhere', 'not_interested', 'timing', 'other');--> statement-breakpoint
CREATE TABLE "access_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"org_id" uuid,
	"label" text NOT NULL,
	"display_prefix" text NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" "token_revoked_reason",
	CONSTRAINT "access_token_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "access_token_side_org" CHECK ((side = 'employer') = (org_id IS NOT NULL)),
	CONSTRAINT "access_token_label_len" CHECK (char_length(label) BETWEEN 1 AND 60),
	CONSTRAINT "access_token_display_prefix_len" CHECK (char_length(display_prefix) = 8),
	CONSTRAINT "access_token_scopes" CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['pipeline:read', 'pipeline:write']::text[]),
	CONSTRAINT "access_token_max_lifetime" CHECK (expires_at <= created_at + interval '365 days'),
	CONSTRAINT "access_token_revoked_reason" CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" "citext" NOT NULL,
	"display_name" text,
	"email_verified_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"profile_headline" text,
	"availability_from" date,
	"availability_to" date,
	CONSTRAINT "account_email_key" UNIQUE("email"),
	CONSTRAINT "account_display_name_len" CHECK (char_length(display_name) <= 80),
	CONSTRAINT "account_profile_headline_len" CHECK (char_length(profile_headline) <= 200),
	CONSTRAINT "account_availability_month" CHECK ((availability_from IS NULL OR extract(day from availability_from) = 1) AND (availability_to IS NULL OR extract(day from availability_to) = 1))
);
--> statement-breakpoint
CREATE TABLE "email_token" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" "citext" NOT NULL,
	"account_id" uuid,
	"purpose" "email_token_purpose" NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"org_id" uuid,
	"invite_roles" "member_role"[],
	"invited_by_member_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "email_token_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "email_token_invite_fields" CHECK ((purpose = 'org_invite') = (org_id IS NOT NULL AND invite_roles IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "profile_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"source_type" "source_type" NOT NULL,
	"claim" text NOT NULL,
	"link_url" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profile_evidence_claim_len" CHECK (char_length(claim) BETWEEN 1 AND 1200),
	CONSTRAINT "profile_evidence_link_scheme" CHECK (link_url IS NULL OR link_url ~ '^https?://'),
	CONSTRAINT "profile_evidence_tags_count" CHECK (cardinality(tags) <= 10)
);
--> statement-breakpoint
CREATE TABLE "web_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "web_session_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notice_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "notice_kind" NOT NULL,
	"version" text NOT NULL,
	"body" text NOT NULL,
	"body_sha256" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "notice_version_kind_version_key" UNIQUE("kind","version")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" "bg_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_webhook_provider_event_key" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "data_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid,
	"account_id" uuid,
	"kind" "data_request_kind" NOT NULL,
	"status" "data_request_status" DEFAULT 'received' NOT NULL,
	"retained_until" date,
	"handled_by_member_id" uuid,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "impact_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"requisition_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"step" "impact_step" NOT NULL,
	"rows" jsonb NOT NULL,
	"computed" jsonb NOT NULL,
	"entered_by_member_id" uuid NOT NULL,
	CONSTRAINT "impact_report_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "impact_report_period" CHECK (period_end >= period_start)
);
--> statement-breakpoint
CREATE TABLE "legal_hold" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"scope" "legal_hold_scope" NOT NULL,
	"target_id" uuid,
	"reason" "legal_hold_reason" NOT NULL,
	"placed_by_member_id" uuid NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_by_member_id" uuid,
	"released_at" timestamp with time zone,
	CONSTRAINT "legal_hold_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "legal_hold_target" CHECK ((scope = 'org') = (target_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "org" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"speedrun_company_slug" text NOT NULL,
	"verified_domain" text,
	"verification" "org_verification",
	"fcl_status" "fcl_status" DEFAULT 'unknown' NOT NULL,
	"everify_enrolled" boolean DEFAULT false NOT NULL,
	"federal_contractor" boolean DEFAULT false NOT NULL,
	"retention_years" smallint DEFAULT 4 NOT NULL,
	"status" "org_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "org_speedrun_company_slug_key" UNIQUE("speedrun_company_slug"),
	CONSTRAINT "org_retention_years_min" CHECK (retention_years >= 4)
);
--> statement-breakpoint
CREATE TABLE "org_member" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"roles" "member_role"[] NOT NULL,
	"invited_by_member_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "org_member_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "org_member_org_account_key" UNIQUE("org_id","account_id"),
	CONSTRAINT "org_member_roles_nonempty" CHECK (cardinality(roles) >= 1)
);
--> statement-breakpoint
CREATE TABLE "provider_connection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "bg_provider" NOT NULL,
	"status" "provider_connection_status" DEFAULT 'pending' NOT NULL,
	"external_account_id" text,
	"access_token_ciphertext" "bytea",
	"connected_by_member_id" uuid,
	"connected_at" timestamp with time zone,
	"credentialed_at" timestamp with time zone,
	"deauthorized_at" timestamp with time zone,
	CONSTRAINT "provider_connection_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "provider_connection_org_provider_key" UNIQUE("org_id","provider")
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"requisition_id" uuid NOT NULL,
	"candidate_account_id" uuid,
	"applicant_name" text NOT NULL,
	"applicant_email" "citext" NOT NULL,
	"stage" "application_stage" DEFAULT 'applied' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ai_mode" "ai_mode" NOT NULL,
	"accommodation_requested" boolean DEFAULT false NOT NULL,
	"availability_from" date,
	"availability_to" date,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_idempotency_key" uuid,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" "withdrawn_reason",
	"outcome_notified_at" timestamp with time zone,
	CONSTRAINT "application_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "application_availability_month" CHECK ((availability_from IS NULL OR extract(day from availability_from) = 1) AND (availability_to IS NULL OR extract(day from availability_to) = 1)),
	CONSTRAINT "application_withdrawn_fields" CHECK ((withdrawn_at IS NULL) = (withdrawn_reason IS NULL))
);
--> statement-breakpoint
CREATE TABLE "candidate_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "candidate_request_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "candidate_request_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"extended_until" timestamp with time zone,
	"created_by_member_id" uuid,
	"answered_at" timestamp with time zone,
	CONSTRAINT "candidate_request_org_id_id_key" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "candidate_statement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid,
	"requisition_id" uuid NOT NULL,
	"account_id" uuid,
	"kind" "statement_kind" NOT NULL,
	"notice_version_id" uuid,
	"question_key" "question_key",
	"answer" text,
	"channel" "channel" NOT NULL,
	"token_id" uuid,
	"session_id" uuid,
	"stated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_statement_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "candidate_statement_question" CHECK ((kind = 'eligibility_answer') = (question_key IS NOT NULL)),
	CONSTRAINT "candidate_statement_channel_ref" CHECK ((channel = 'agent' AND token_id IS NOT NULL) OR (channel = 'web' AND session_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "evidence_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"ref" text NOT NULL,
	"requirement_id" uuid,
	"source_type" "source_type" NOT NULL,
	"claim" text NOT NULL,
	"link_url" text,
	"source_profile_evidence_id" uuid,
	"added_via" "evidence_added_via" NOT NULL,
	"supersedes_id" uuid,
	CONSTRAINT "evidence_item_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "evidence_item_application_ref_key" UNIQUE("application_id","ref"),
	CONSTRAINT "evidence_item_ref_shape" CHECK (ref ~ '^E([1-9]|1[0-9]|20)$'),
	CONSTRAINT "evidence_item_claim_len" CHECK (char_length(claim) BETWEEN 1 AND 1200),
	CONSTRAINT "evidence_item_link_scheme" CHECK (link_url IS NULL OR link_url ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "requirement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"requisition_id" uuid NOT NULL,
	"ordinal" smallint NOT NULL,
	"quote" text NOT NULL,
	"category" "requirement_category" NOT NULL,
	"signal_value" text,
	"signal_basis" "signal_basis",
	"priority" "requirement_priority" NOT NULL,
	"weight" smallint NOT NULL,
	"version" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "requirement_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "requirement_requisition_ordinal_key" UNIQUE("requisition_id","ordinal"),
	CONSTRAINT "requirement_weight_range" CHECK (weight BETWEEN 0 AND 5),
	CONSTRAINT "requirement_eligibility_unweighted" CHECK (category <> 'eligibility' OR weight = 0),
	CONSTRAINT "requirement_signal_only_eligibility" CHECK (category = 'eligibility' OR (signal_value IS NULL AND signal_basis IS NULL))
);
--> statement-breakpoint
CREATE TABLE "requisition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"speedrun_role_id" text NOT NULL,
	"status" "requisition_status" DEFAULT 'draft' NOT NULL,
	"role_snapshot" jsonb NOT NULL,
	"posting_text" text NOT NULL,
	"work_country" text,
	"work_state" text,
	"work_city" text,
	"access_class" "access_class" DEFAULT 'none' NOT NULL,
	"access_class_proposed_from" text[] DEFAULT '{}'::text[] NOT NULL,
	"access_class_confirmed_by_member_id" uuid,
	"access_class_confirmed_at" timestamp with time zone,
	"plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"component_weights" jsonb DEFAULT '{"requirements":1,"work_sample":1,"interview":1}'::jsonb NOT NULL,
	"ai_notice_posted_on" date,
	"opened_by_member_id" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"retention_anchor_at" timestamp with time zone,
	"purge_after" date,
	CONSTRAINT "requisition_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "requisition_work_country" CHECK (work_country IS NULL OR work_country = 'US'),
	CONSTRAINT "requisition_work_state" CHECK (work_state IS NULL OR work_state ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "work_sample_spec" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"requisition_id" uuid NOT NULL,
	"minutes" smallint NOT NULL,
	"brief" text NOT NULL,
	"rubric" jsonb NOT NULL,
	"generator_version" text NOT NULL,
	"approved_by_member_id" uuid,
	"approved_at" timestamp with time zone,
	"version" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "work_sample_spec_org_id_id_key" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "work_sample_submission" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"body" text NOT NULL,
	"link_url" text,
	"body_sha256" text NOT NULL,
	"attested_clean" boolean NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_sample_submission_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "work_sample_submission_request_key" UNIQUE("request_id"),
	CONSTRAINT "work_sample_submission_body_len" CHECK (char_length(body) BETWEEN 1 AND 50000),
	CONSTRAINT "work_sample_submission_attested" CHECK (attested_clean),
	CONSTRAINT "work_sample_submission_link_scheme" CHECK (link_url IS NULL OR link_url ~ '^https?://')
);
--> statement-breakpoint
CREATE TABLE "interview" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"round" smallint NOT NULL,
	"kind" "interview_kind" NOT NULL,
	"guide" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interviewer_member_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"scheduling_status" "interview_scheduling_status" DEFAULT 'to_schedule' NOT NULL,
	"slots" timestamp with time zone[] DEFAULT '{}'::timestamptz[] NOT NULL,
	"scheduled_for" timestamp with time zone,
	"duration_min" smallint NOT NULL,
	"created_by_member_id" uuid NOT NULL,
	CONSTRAINT "interview_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "interview_round_range" CHECK (round BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "interview_rating" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"interview_id" uuid NOT NULL,
	"interviewer_member_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"level" "rating_level" NOT NULL,
	"note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_rating_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "interview_rating_one_per_question_key" UNIQUE("interview_id","interviewer_member_id","question_key"),
	CONSTRAINT "interview_rating_note_len" CHECK (char_length(note) <= 500)
);
--> statement-breakpoint
CREATE TABLE "judgment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"requirement_version" smallint NOT NULL,
	"status" "verdict_status" DEFAULT 'queued' NOT NULL,
	"judge_kind" "judge_kind" NOT NULL,
	"level" "judgment_level",
	"basis_ref" text,
	"basis_quote" text,
	"rationale" text,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"model_id" text,
	"prompt_version" text,
	"request_sha256" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"stop_reason" text,
	"raw_output" jsonb,
	"overrides_judgment_id" uuid,
	"override_reason" "override_reason",
	"reviewer_member_id" uuid,
	"run_id" uuid,
	CONSTRAINT "judgment_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "judgment_rationale_len" CHECK (char_length(rationale) <= 300),
	CONSTRAINT "judgment_flags" CHECK (flags <@ ARRAY['possible_instructions_in_evidence', 'unverified_quote', 'refusal', 'rationale_rejected_by_guard', 'insufficient_detail', 'off_topic']::text[]),
	CONSTRAINT "judgment_human_override" CHECK (judge_kind <> 'human' OR reviewer_member_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"requisition_id" uuid NOT NULL,
	"algorithm_version" text NOT NULL,
	"weights" jsonb NOT NULL,
	"entries" jsonb NOT NULL,
	"requested_by_member_id" uuid NOT NULL,
	"saved_weights" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ranking_snapshot_org_id_id_key" UNIQUE("org_id","id")
);
--> statement-breakpoint
CREATE TABLE "work_sample_grade" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"criterion_key" text NOT NULL,
	"spec_version" smallint,
	"status" "verdict_status" DEFAULT 'queued' NOT NULL,
	"judge_kind" "judge_kind" NOT NULL,
	"band" "grade_band",
	"basis_quote" text,
	"rationale" text,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"model_id" text,
	"prompt_version" text,
	"request_sha256" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"stop_reason" text,
	"raw_output" jsonb,
	"run_id" uuid,
	"review_status" "grade_review_status" DEFAULT 'pending' NOT NULL,
	"overrides_grade_id" uuid,
	"reviewer_member_id" uuid,
	"override_reason" "override_reason",
	CONSTRAINT "work_sample_grade_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "work_sample_grade_rationale_len" CHECK (char_length(rationale) <= 300),
	CONSTRAINT "work_sample_grade_flags" CHECK (flags <@ ARRAY['possible_instructions_in_evidence', 'unverified_quote', 'refusal', 'rationale_rejected_by_guard', 'insufficient_detail', 'off_topic']::text[])
);
--> statement-breakpoint
CREATE TABLE "adverse_action" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"bg_check_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"status" "adverse_action_status" DEFAULT 'preadverse_proposed' NOT NULL,
	"preadverse_sent_at" timestamp with time zone,
	"preadverse_channel" "preadverse_channel",
	"candidate_disputed_at" timestamp with time zone,
	"earliest_final_at" timestamp with time zone,
	"final_sent_at" timestamp with time zone,
	"started_by_member_id" uuid NOT NULL,
	"final_by_member_id" uuid,
	"timing_alert" boolean DEFAULT false NOT NULL,
	CONSTRAINT "adverse_action_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "adverse_action_bg_check_key" UNIQUE("bg_check_id")
);
--> statement-breakpoint
CREATE TABLE "bg_check" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"provider" "bg_provider" NOT NULL,
	"package" text NOT NULL,
	"provider_candidate_id" text,
	"provider_invitation_id" text,
	"provider_report_id" text,
	"invitation_url" text,
	"dashboard_url" text,
	"status" "bg_check_status" DEFAULT 'not_ordered' NOT NULL,
	"eta" date,
	"ordered_by_member_id" uuid NOT NULL,
	"ordered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone,
	"review_status" "bg_review_status" DEFAULT 'not_reviewed' NOT NULL,
	CONSTRAINT "bg_check_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "bg_check_application_key" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "checklist_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"phase" "checklist_phase" NOT NULL,
	"kind" "checklist_kind" NOT NULL,
	"owner_role" "member_role" NOT NULL,
	"applies" boolean DEFAULT true NOT NULL,
	"status" "checklist_status" DEFAULT 'pending' NOT NULL,
	"outcome" text,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"done_by_member_id" uuid,
	CONSTRAINT "checklist_item_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "checklist_item_application_kind_key" UNIQUE("application_id","kind")
);
--> statement-breakpoint
CREATE TABLE "decision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"from_stage" "application_stage" NOT NULL,
	"outcome" "decision_outcome" NOT NULL,
	"reason_codes" text[] NOT NULL,
	"requirement_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"note" text,
	"decided_by_member_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"ranking_snapshot_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decision_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "decision_reason_codes" CHECK (cardinality(reason_codes) BETWEEN 1 AND 4 AND reason_codes <@ ARRAY['meets_must_haves', 'strong_evidence', 'strong_work_sample', 'strong_interview', 'requirements_not_shown', 'work_sample_below_bar', 'interview_below_bar', 'stronger_candidates_selected', 'no_response_to_requests', 'role_filled_or_closed', 'legal_eligibility_requirement', 'other_job_related', 'selected_for_offer', 'background_check_review', 'background_check_adverse', 'contingency_not_met', 'candidate_request', 'role_eliminated']::text[]),
	CONSTRAINT "decision_note_len" CHECK (char_length(note) <= 500)
);
--> statement-breakpoint
CREATE TABLE "offer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"status" "offer_status" DEFAULT 'drafting' NOT NULL,
	"start_date" date,
	"expires_on" date,
	"contingencies" text[] DEFAULT '{}'::text[] NOT NULL,
	"extended_on" date,
	"extended_via" "offer_extended_via",
	"extended_recorded_by_member_id" uuid,
	"esign_completed_on" date,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"rescinded_at" timestamp with time zone,
	CONSTRAINT "offer_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "offer_application_key" UNIQUE("application_id"),
	CONSTRAINT "offer_contingencies" CHECK (contingencies <@ ARRAY['background_check', 'form_i9', 'export_authorization', 'clearance_eligibility', 'active_clearance_verification', 'confidentiality_agreement']::text[])
);
--> statement-breakpoint
CREATE TABLE "proposal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" "proposal_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"proposed_by_account_id" uuid NOT NULL,
	"proposed_via" "channel" NOT NULL,
	"confirmer_role" "member_role" NOT NULL,
	"confirmer_member_id" uuid,
	"batch_id" uuid NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_by_member_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_session_id" uuid,
	CONSTRAINT "proposal_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "proposal_web_resolution" CHECK (status NOT IN ('confirmed', 'declined') OR (resolved_session_id IS NOT NULL AND resolved_by_member_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"org_id" uuid,
	"account_id" uuid,
	"requisition_id" uuid,
	"application_id" uuid,
	"actor_kind" "actor_kind" NOT NULL,
	"actor_account_id" uuid,
	"actor_member_id" uuid,
	"actor_token_id" uuid,
	"actor_session_id" uuid,
	"actor_job" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"model_id" text,
	"prompt_version" text,
	"request_id" text,
	CONSTRAINT "audit_event_org_id_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "audit_event_actor" CHECK (CASE actor_kind
        WHEN 'person_agent' THEN actor_account_id IS NOT NULL AND actor_token_id IS NOT NULL
        WHEN 'person_web' THEN actor_account_id IS NOT NULL AND actor_session_id IS NOT NULL
        ELSE actor_job IS NOT NULL
      END),
	CONSTRAINT "audit_event_action_shape" CHECK (action ~ '^[a-z_]+\.[a-z_]+$')
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_account_id" uuid,
	"to_email" "citext",
	"org_id" uuid,
	"application_id" uuid,
	"kind" text NOT NULL,
	"template_version" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"channel_email" boolean DEFAULT false NOT NULL,
	"email_status" "email_status" DEFAULT 'not_applicable' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error_code" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	CONSTRAINT "notification_dedupe_key_key" UNIQUE("dedupe_key"),
	CONSTRAINT "notification_has_recipient" CHECK (recipient_account_id IS NOT NULL OR to_email IS NOT NULL),
	CONSTRAINT "notification_email_status" CHECK (channel_email OR email_status = 'not_applicable')
);
--> statement-breakpoint
ALTER TABLE "access_token" ADD CONSTRAINT "access_token_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_token" ADD CONSTRAINT "email_token_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_evidence" ADD CONSTRAINT "profile_evidence_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_session" ADD CONSTRAINT "web_session_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_handled_by_fk" FOREIGN KEY ("org_id","handled_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_report" ADD CONSTRAINT "impact_report_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_report" ADD CONSTRAINT "impact_report_entered_by_fk" FOREIGN KEY ("org_id","entered_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_hold" ADD CONSTRAINT "legal_hold_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_hold" ADD CONSTRAINT "legal_hold_placed_by_fk" FOREIGN KEY ("org_id","placed_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_hold" ADD CONSTRAINT "legal_hold_released_by_fk" FOREIGN KEY ("org_id","released_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_member" ADD CONSTRAINT "org_member_invited_by_fk" FOREIGN KEY ("org_id","invited_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connection" ADD CONSTRAINT "provider_connection_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_connection" ADD CONSTRAINT "provider_connection_connected_by_fk" FOREIGN KEY ("org_id","connected_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_requisition_fk" FOREIGN KEY ("org_id","requisition_id") REFERENCES "public"."requisition"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_candidate_account_fk" FOREIGN KEY ("candidate_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_request" ADD CONSTRAINT "candidate_request_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_request" ADD CONSTRAINT "candidate_request_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_statement" ADD CONSTRAINT "candidate_statement_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_statement" ADD CONSTRAINT "candidate_statement_requisition_fk" FOREIGN KEY ("org_id","requisition_id") REFERENCES "public"."requisition"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_statement" ADD CONSTRAINT "candidate_statement_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_statement" ADD CONSTRAINT "candidate_statement_notice_version_fk" FOREIGN KEY ("notice_version_id") REFERENCES "public"."notice_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_requirement_fk" FOREIGN KEY ("org_id","requirement_id") REFERENCES "public"."requirement"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_item" ADD CONSTRAINT "evidence_item_supersedes_fk" FOREIGN KEY ("org_id","supersedes_id") REFERENCES "public"."evidence_item"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_requisition_fk" FOREIGN KEY ("org_id","requisition_id") REFERENCES "public"."requisition"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisition" ADD CONSTRAINT "requisition_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisition" ADD CONSTRAINT "requisition_access_class_confirmed_by_fk" FOREIGN KEY ("org_id","access_class_confirmed_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisition" ADD CONSTRAINT "requisition_opened_by_fk" FOREIGN KEY ("org_id","opened_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_spec" ADD CONSTRAINT "work_sample_spec_requisition_fk" FOREIGN KEY ("org_id","requisition_id") REFERENCES "public"."requisition"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_spec" ADD CONSTRAINT "work_sample_spec_approved_by_fk" FOREIGN KEY ("org_id","approved_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_submission" ADD CONSTRAINT "work_sample_submission_request_fk" FOREIGN KEY ("org_id","request_id") REFERENCES "public"."candidate_request"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_created_by_fk" FOREIGN KEY ("org_id","created_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_rating" ADD CONSTRAINT "interview_rating_interview_fk" FOREIGN KEY ("org_id","interview_id") REFERENCES "public"."interview"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_rating" ADD CONSTRAINT "interview_rating_interviewer_fk" FOREIGN KEY ("org_id","interviewer_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_requirement_fk" FOREIGN KEY ("org_id","requirement_id") REFERENCES "public"."requirement"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_overrides_fk" FOREIGN KEY ("org_id","overrides_judgment_id") REFERENCES "public"."judgment"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judgment" ADD CONSTRAINT "judgment_reviewer_fk" FOREIGN KEY ("org_id","reviewer_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_requisition_fk" FOREIGN KEY ("org_id","requisition_id") REFERENCES "public"."requisition"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_snapshot" ADD CONSTRAINT "ranking_snapshot_requested_by_fk" FOREIGN KEY ("org_id","requested_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_grade" ADD CONSTRAINT "work_sample_grade_submission_fk" FOREIGN KEY ("org_id","submission_id") REFERENCES "public"."work_sample_submission"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_grade" ADD CONSTRAINT "work_sample_grade_overrides_fk" FOREIGN KEY ("org_id","overrides_grade_id") REFERENCES "public"."work_sample_grade"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sample_grade" ADD CONSTRAINT "work_sample_grade_reviewer_fk" FOREIGN KEY ("org_id","reviewer_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_action" ADD CONSTRAINT "adverse_action_bg_check_fk" FOREIGN KEY ("org_id","bg_check_id") REFERENCES "public"."bg_check"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_action" ADD CONSTRAINT "adverse_action_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_action" ADD CONSTRAINT "adverse_action_started_by_fk" FOREIGN KEY ("org_id","started_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adverse_action" ADD CONSTRAINT "adverse_action_final_by_fk" FOREIGN KEY ("org_id","final_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bg_check" ADD CONSTRAINT "bg_check_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bg_check" ADD CONSTRAINT "bg_check_ordered_by_fk" FOREIGN KEY ("org_id","ordered_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_item" ADD CONSTRAINT "checklist_item_done_by_fk" FOREIGN KEY ("org_id","done_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_proposal_fk" FOREIGN KEY ("org_id","proposal_id") REFERENCES "public"."proposal"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_ranking_snapshot_fk" FOREIGN KEY ("org_id","ranking_snapshot_id") REFERENCES "public"."ranking_snapshot"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision" ADD CONSTRAINT "decision_decided_by_fk" FOREIGN KEY ("org_id","decided_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer" ADD CONSTRAINT "offer_extended_recorded_by_fk" FOREIGN KEY ("org_id","extended_recorded_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_confirmer_fk" FOREIGN KEY ("org_id","confirmer_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal" ADD CONSTRAINT "proposal_resolved_by_fk" FOREIGN KEY ("org_id","resolved_by_member_id") REFERENCES "public"."org_member"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_org_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_application_fk" FOREIGN KEY ("org_id","application_id") REFERENCES "public"."application"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_token_account_idx" ON "access_token" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "email_token_email_created_idx" ON "email_token" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "profile_evidence_account_idx" ON "profile_evidence" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "web_session_account_idx" ON "web_session" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "processed_webhook_received_idx" ON "processed_webhook" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "data_request_org_status_idx" ON "data_request" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "data_request_account_idx" ON "data_request" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "impact_report_org_idx" ON "impact_report" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "legal_hold_org_released_idx" ON "legal_hold" USING btree ("org_id","released_at");--> statement-breakpoint
CREATE INDEX "org_member_account_idx" ON "org_member" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_requisition_candidate_active_key" ON "application" USING btree ("requisition_id","candidate_account_id") WHERE withdrawn_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "application_idempotency_key" ON "application" USING btree ("candidate_account_id","submission_idempotency_key");--> statement-breakpoint
CREATE INDEX "application_org_requisition_stage_idx" ON "application" USING btree ("org_id","requisition_id","stage");--> statement-breakpoint
CREATE INDEX "application_candidate_idx" ON "application" USING btree ("candidate_account_id");--> statement-breakpoint
CREATE INDEX "candidate_request_application_status_idx" ON "candidate_request" USING btree ("application_id","status");--> statement-breakpoint
CREATE INDEX "candidate_request_org_status_due_idx" ON "candidate_request" USING btree ("org_id","status","due_at");--> statement-breakpoint
CREATE INDEX "candidate_statement_application_idx" ON "candidate_statement" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "candidate_statement_account_idx" ON "candidate_statement" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "requisition_org_role_open_key" ON "requisition" USING btree ("org_id","speedrun_role_id") WHERE status <> 'closed';--> statement-breakpoint
CREATE INDEX "requisition_org_status_idx" ON "requisition" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "work_sample_spec_requisition_idx" ON "work_sample_spec" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "interview_application_idx" ON "interview" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "judgment_application_requirement_status_idx" ON "judgment" USING btree ("application_id","requirement_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "judgment_one_active_key" ON "judgment" USING btree ("application_id","requirement_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "ranking_snapshot_requisition_created_idx" ON "ranking_snapshot" USING btree ("requisition_id","created_at");--> statement-breakpoint
CREATE INDEX "work_sample_grade_submission_idx" ON "work_sample_grade" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_sample_grade_one_active_key" ON "work_sample_grade" USING btree ("submission_id","criterion_key") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "bg_check_provider_report_idx" ON "bg_check" USING btree ("provider","provider_report_id");--> statement-breakpoint
CREATE INDEX "checklist_item_org_status_due_idx" ON "checklist_item" USING btree ("org_id","status","due_at");--> statement-breakpoint
CREATE INDEX "decision_application_idx" ON "decision" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "proposal_org_status_role_idx" ON "proposal" USING btree ("org_id","status","confirmer_role");--> statement-breakpoint
CREATE INDEX "proposal_batch_idx" ON "proposal" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "audit_event_org_created_idx" ON "audit_event" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_event_application_idx" ON "audit_event" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "audit_event_entity_idx" ON "audit_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_event_requisition_idx" ON "audit_event" USING btree ("requisition_id");--> statement-breakpoint
CREATE INDEX "notification_recipient_created_idx" ON "notification" USING btree ("recipient_account_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_queued_idx" ON "notification" USING btree ("email_status") WHERE email_status = 'queued';