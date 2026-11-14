-- 0001 rls_and_triggers (hand-written).
--
-- What this migration does:
--   1. SQL helpers that read the transaction-local scope set by lib/db/tx.ts.
--      NULLIF matters: once a transaction has set app.org_id, later
--      transactions on the same connection read '' rather than NULL, and
--      ''::uuid would raise instead of matching nothing.
--   2. The role clearance_app: not a superuser, no BYPASSRLS, owns nothing.
--      Every helper in lib/db/tx.ts runs SET LOCAL ROLE clearance_app, so the
--      policies below apply whatever role the connection logged in as
--      (PGlite's only user is a superuser, and superusers bypass row-level
--      security in every Postgres, FORCE or not).
--   3. ENABLE + FORCE row-level security on the 32 owned tables (all but the
--      two global tables), with one policy set per plane:
--        tenant        org_id = app_current_org()
--        account plane account_id = app_current_account(), or system
--        cross-cutting as commented at each table
--      Tenant tables have no system escape: system jobs loop org by org and
--      set app.org_id each time (§2.2 item 3).
--   4. audit_event is append-only: no UPDATE or DELETE grant for the app
--      role, and a trigger that refuses UPDATE, DELETE and TRUNCATE for every
--      role except a DELETE inside purge_audit_events(), the retention purge.
--   5. Immutable rows (§2.3): evidence_item, work_sample_submission and
--      candidate_statement get no UPDATE grant.

-- 1. Scope helpers
CREATE OR REPLACE FUNCTION public.app_current_org() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_current_account() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT NULLIF(current_setting('app.account_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.app_is_system() RETURNS boolean
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT coalesce(current_setting('app.system', true), '') = 'on' $$;--> statement-breakpoint

-- 2. The application role and its grants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clearance_app') THEN
    CREATE ROLE clearance_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;--> statement-breakpoint
-- The role that runs migrations is the role the app connects as; it must be able to SET ROLE clearance_app.
GRANT clearance_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO clearance_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO clearance_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clearance_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE "audit_event" FROM clearance_app;--> statement-breakpoint
REVOKE UPDATE ON TABLE "evidence_item", "work_sample_submission", "candidate_statement" FROM clearance_app;--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON TABLE "notice_version" FROM clearance_app;--> statement-breakpoint

-- 3. Row-level security

-- 3a. Tenant tables: one org's rows, nothing when no org is set.
ALTER TABLE "provider_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provider_connection" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provider_connection_tenant" ON "provider_connection" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "legal_hold" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "legal_hold" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "legal_hold_tenant" ON "legal_hold" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "impact_report" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "impact_report" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "impact_report_tenant" ON "impact_report" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "requisition" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requisition" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "requisition_tenant" ON "requisition" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "requirement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requirement" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "requirement_tenant" ON "requirement" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "work_sample_spec" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_sample_spec" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_sample_spec_tenant" ON "work_sample_spec" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "evidence_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "evidence_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "evidence_item_tenant" ON "evidence_item" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "candidate_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_request" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "candidate_request_tenant" ON "candidate_request" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "work_sample_submission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_sample_submission" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_sample_submission_tenant" ON "work_sample_submission" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "judgment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judgment" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "judgment_tenant" ON "judgment" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "work_sample_grade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_sample_grade" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_sample_grade_tenant" ON "work_sample_grade" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "interview" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interview" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "interview_tenant" ON "interview" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "interview_rating" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interview_rating" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "interview_rating_tenant" ON "interview_rating" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "ranking_snapshot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ranking_snapshot" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ranking_snapshot_tenant" ON "ranking_snapshot" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "proposal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "proposal" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "proposal_tenant" ON "proposal" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "decision" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "decision_tenant" ON "decision" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "offer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "offer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "offer_tenant" ON "offer" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "bg_check" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bg_check" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "bg_check_tenant" ON "bg_check" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "adverse_action" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "adverse_action" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "adverse_action_tenant" ON "adverse_action" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
ALTER TABLE "checklist_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "checklist_item" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "checklist_item_tenant" ON "checklist_item" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint

-- 3b. Tenant tables with a documented second reader (§2.2 item 3). Writes still need the org scope.
ALTER TABLE "org_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_member" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "org_member_tenant" ON "org_member" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
-- a person reads their own memberships (side switcher, token binding)
CREATE POLICY "org_member_own" ON "org_member" AS PERMISSIVE FOR SELECT USING (account_id = app_current_account());--> statement-breakpoint
ALTER TABLE "application" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "application" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "application_tenant" ON "application" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
-- a candidate reads their own applications; the service applies the candidate projection
CREATE POLICY "application_own" ON "application" AS PERMISSIVE FOR SELECT USING (candidate_account_id = app_current_account());--> statement-breakpoint
ALTER TABLE "candidate_statement" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "candidate_statement" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "candidate_statement_tenant" ON "candidate_statement" AS PERMISSIVE FOR ALL USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
-- a candidate reads the statements they made
CREATE POLICY "candidate_statement_own" ON "candidate_statement" AS PERMISSIVE FOR SELECT USING (account_id = app_current_account());--> statement-breakpoint

-- 3c. org: its own scope; system jobs list orgs to loop over them; a person sees the orgs they belong to.
ALTER TABLE "org" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "org_tenant" ON "org" AS PERMISSIVE FOR ALL USING (id = app_current_org() OR app_is_system()) WITH CHECK (id = app_current_org() OR app_is_system());--> statement-breakpoint
CREATE POLICY "org_member_of" ON "org" AS PERMISSIVE FOR SELECT USING (id IN (SELECT m.org_id FROM org_member m WHERE m.account_id = app_current_account() AND m.removed_at IS NULL));--> statement-breakpoint

-- 3d. data_request: the requesting person, the org it is addressed to, or the system.
ALTER TABLE "data_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_request" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "data_request_scope" ON "data_request" AS PERMISSIVE FOR ALL USING (org_id = app_current_org() OR account_id = app_current_account() OR app_is_system()) WITH CHECK (org_id = app_current_org() OR account_id = app_current_account() OR app_is_system());--> statement-breakpoint

-- 3e. Account plane: the person's own rows. The system reads across accounts to resolve sign-in links, sessions and tokens by hash.
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "account_self" ON "account" AS PERMISSIVE FOR ALL USING (id = app_current_account() OR app_is_system()) WITH CHECK (id = app_current_account() OR app_is_system());--> statement-breakpoint
-- Members of an org see the name and email of the org's other members (§2.3 account row).
CREATE POLICY "account_fellow_member" ON "account" AS PERMISSIVE FOR SELECT USING (id IN (SELECT m.account_id FROM org_member m WHERE m.org_id = app_current_org()));--> statement-breakpoint
ALTER TABLE "email_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_token" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "email_token_owner" ON "email_token" AS PERMISSIVE FOR ALL USING (account_id = app_current_account() OR app_is_system()) WITH CHECK (account_id = app_current_account() OR app_is_system());--> statement-breakpoint
ALTER TABLE "web_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "web_session" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "web_session_owner" ON "web_session" AS PERMISSIVE FOR ALL USING (account_id = app_current_account() OR app_is_system()) WITH CHECK (account_id = app_current_account() OR app_is_system());--> statement-breakpoint
ALTER TABLE "access_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_token" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "access_token_owner" ON "access_token" AS PERMISSIVE FOR ALL USING (account_id = app_current_account() OR app_is_system()) WITH CHECK (account_id = app_current_account() OR app_is_system());--> statement-breakpoint
ALTER TABLE "profile_evidence" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profile_evidence" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profile_evidence_owner" ON "profile_evidence" AS PERMISSIVE FOR ALL USING (account_id = app_current_account() OR app_is_system()) WITH CHECK (account_id = app_current_account() OR app_is_system());--> statement-breakpoint

-- 3f. notification: the recipient's inbox, written by the org whose change caused it, drained by the system.
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notification_scope" ON "notification" AS PERMISSIVE FOR ALL USING (recipient_account_id = app_current_account() OR org_id = app_current_org() OR app_is_system()) WITH CHECK (recipient_account_id = app_current_account() OR org_id = app_current_org() OR app_is_system());--> statement-breakpoint

-- 3g. audit_event: read within the org (account-plane events only by the system); written from any scope it belongs to.
-- The UPDATE and DELETE policies exist so that a visible row reaches the append-only trigger and is refused loudly.
ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_event_read" ON "audit_event" AS PERMISSIVE FOR SELECT USING (org_id = app_current_org() OR app_is_system());--> statement-breakpoint
CREATE POLICY "audit_event_write" ON "audit_event" AS PERMISSIVE FOR INSERT WITH CHECK (org_id = app_current_org() OR (org_id IS NULL AND account_id = app_current_account()) OR app_is_system());--> statement-breakpoint
CREATE POLICY "audit_event_update" ON "audit_event" AS PERMISSIVE FOR UPDATE USING (org_id = app_current_org() OR app_is_system());--> statement-breakpoint
CREATE POLICY "audit_event_purge" ON "audit_event" AS PERMISSIVE FOR DELETE USING (org_id = app_current_org() OR app_is_system());--> statement-breakpoint

-- 4. audit_event is append-only (§2.3).
CREATE OR REPLACE FUNCTION public.audit_event_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_event is append-only: % refused', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;--> statement-breakpoint
CREATE TRIGGER audit_event_no_update_or_delete BEFORE UPDATE OR DELETE ON "audit_event" FOR EACH ROW EXECUTE FUNCTION public.audit_event_append_only();--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate BEFORE TRUNCATE ON "audit_event" FOR EACH STATEMENT EXECUTE FUNCTION public.audit_event_append_only();--> statement-breakpoint
-- The retention purge (§2.5, slice S14) is the one path that deletes audit events. It
-- runs in one org's scope, sets the transaction-local flag the trigger checks, deletes
-- by requisition or by age, and clears the flag before returning.
CREATE OR REPLACE FUNCTION public.purge_audit_events(p_org_id uuid, p_requisition_id uuid, p_created_before timestamptz) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  n integer;
BEGIN
  IF p_org_id IS NULL OR (p_requisition_id IS NULL AND p_created_before IS NULL) THEN
    RAISE EXCEPTION 'purge_audit_events needs an org and a requisition or a cut-off';
  END IF;
  IF p_org_id IS DISTINCT FROM app_current_org() THEN
    RAISE EXCEPTION 'purge_audit_events runs only inside that org''s scope'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  PERFORM set_config('app.audit_purge', 'on', true);
  DELETE FROM audit_event
    WHERE org_id = p_org_id
      AND (p_requisition_id IS NULL OR requisition_id = p_requisition_id)
      AND (p_created_before IS NULL OR created_at < p_created_before);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.audit_purge', 'off', true);
  RETURN n;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.purge_audit_events(uuid, uuid, timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.purge_audit_events(uuid, uuid, timestamptz) TO clearance_app;
