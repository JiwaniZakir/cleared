/**
 * Fixture world for the database tests: one employer org with a row in every
 * table, seeded through PGlite's superuser session (which bypasses row-level
 * security, as fixtures must). Every person and company here is made up.
 */
import { randomBytes } from "node:crypto";
import type { Db } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import * as s from "@/lib/db/schema";

export interface OrgWorld {
  label: string;
  orgId: string;
  memberAccountId: string;
  memberId: string;
  candidateAccountId: string;
  requisitionId: string;
  requirementId: string;
  applicationId: string;
  evidenceItemId: string;
  bgCheckId: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** Seeds one org's world. `label` keeps names and slugs distinct ("a", "b"). */
export async function seedOrgWorld(db: Db, label: string): Promise<OrgWorld> {
  const memberAccountId = newId();
  const candidateAccountId = newId();
  await db.insert(s.account).values([
    { id: memberAccountId, email: `member-${label}@example.test`, displayName: `Fixture Member ${label.toUpperCase()}` },
    { id: candidateAccountId, email: `candidate-${label}@example.test`, displayName: `Fixture Candidate ${label.toUpperCase()}` },
  ]);

  const orgId = newId();
  await db.insert(s.org).values({ id: orgId, name: `Fixture Org ${label.toUpperCase()}`, speedrunCompanySlug: `fixture-org-${label}`, verification: "domain_match" });
  const memberId = newId();
  await db.insert(s.orgMember).values({ id: memberId, orgId, accountId: memberAccountId, roles: ["admin", "recruiter", "decider"] });

  // Account plane
  const future = new Date(Date.now() + 30 * DAY);
  await db.insert(s.emailToken).values({ email: `member-${label}@example.test`, accountId: memberAccountId, purpose: "sign_in", tokenHash: randomBytes(32), expiresAt: future });
  await db.insert(s.webSession).values({ accountId: memberAccountId, tokenHash: randomBytes(32), expiresAt: future });
  await db.insert(s.accessToken).values({
    accountId: memberAccountId,
    side: "employer",
    orgId,
    label: `fixture token ${label}`,
    displayPrefix: "abcdefgh",
    tokenHash: randomBytes(32),
    scopes: ["pipeline:read", "pipeline:write"],
    expiresAt: future,
  });
  await db.insert(s.profileEvidence).values({ accountId: candidateAccountId, sourceType: "project", claim: `Fixture profile evidence for candidate ${label}, made up for tests.` });

  // Tenant plane: organisation
  await db.insert(s.providerConnection).values({ orgId, provider: "simulator", status: "credentialed", connectedByMemberId: memberId });
  await db.insert(s.legalHold).values({ orgId, scope: "org", reason: "other", placedByMemberId: memberId });
  await db.insert(s.impactReport).values({
    orgId,
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    step: "overall",
    rows: [],
    computed: {},
    enteredByMemberId: memberId,
  });
  await db.insert(s.dataRequest).values({ orgId, accountId: candidateAccountId, kind: "access" });

  // Role and application
  const requisitionId = newId();
  await db.insert(s.requisition).values({
    id: requisitionId,
    orgId,
    speedrunRoleId: `fixture-role-${label}`,
    roleSnapshot: { title: "Fixture Role" },
    postingText: "A made-up posting for tests.",
    openedByMemberId: memberId,
  });
  const requirementId = newId();
  await db.insert(s.requirement).values({
    id: requirementId,
    orgId,
    requisitionId,
    ordinal: 1,
    quote: "Experience with fixture data",
    category: "qualification",
    priority: "must",
    weight: 3,
  });
  await db.insert(s.workSampleSpec).values({ orgId, requisitionId, minutes: 90, brief: "A made-up brief.", rubric: [], generatorVersion: "fixture.v1" });
  const applicationId = newId();
  await db.insert(s.application).values({
    id: applicationId,
    orgId,
    requisitionId,
    candidateAccountId,
    applicantName: `Fixture Candidate ${label.toUpperCase()}`,
    applicantEmail: `candidate-${label}@example.test`,
    aiMode: "ai_assisted",
  });
  const evidenceItemId = newId();
  await db.insert(s.evidenceItem).values({
    id: evidenceItemId,
    orgId,
    applicationId,
    ref: "E1",
    requirementId,
    sourceType: "project",
    claim: "A made-up claim used only by the database tests.",
    addedVia: "application",
  });
  await db.insert(s.candidateStatement).values({ orgId, applicationId, requisitionId, accountId: candidateAccountId, kind: "notice_acknowledged", channel: "agent", tokenId: newId() });
  const requestId = newId();
  await db.insert(s.candidateRequest).values({ id: requestId, orgId, applicationId, kind: "work_sample", payload: {} });
  const submissionId = newId();
  await db.insert(s.workSampleSubmission).values({ id: submissionId, orgId, requestId, body: "A made-up work sample.", bodySha256: "0".repeat(64), attestedClean: true });

  // Evaluation
  await db.insert(s.judgment).values({ orgId, applicationId, requirementId, requirementVersion: 1, status: "active", judgeKind: "stand_in", level: "meets" });
  await db.insert(s.workSampleGrade).values({ orgId, submissionId, criterionKey: "c1", status: "active", judgeKind: "stand_in", band: "proficient" });
  const interviewId = newId();
  await db.insert(s.interview).values({ id: interviewId, orgId, applicationId, round: 1, kind: "panel", durationMin: 45, createdByMemberId: memberId, interviewerMemberIds: [memberId] });
  await db.insert(s.interviewRating).values({ orgId, interviewId, interviewerMemberId: memberId, questionKey: "q1", level: "strong" });
  const snapshotId = newId();
  await db.insert(s.rankingSnapshot).values({ id: snapshotId, orgId, requisitionId, algorithmVersion: "rank.v1", weights: {}, entries: [], requestedByMemberId: memberId });

  // Decisions and after
  const proposalId = newId();
  await db.insert(s.proposal).values({
    id: proposalId,
    orgId,
    applicationId,
    kind: "selection_decision",
    payload: {},
    proposedByAccountId: memberAccountId,
    proposedVia: "agent",
    confirmerRole: "decider",
    batchId: newId(),
    expiresAt: future,
  });
  await db.insert(s.decision).values({
    orgId,
    applicationId,
    fromStage: "in_review",
    outcome: "advance",
    reasonCodes: ["meets_must_haves"],
    decidedByMemberId: memberId,
    proposalId,
    rankingSnapshotId: snapshotId,
  });
  await db.insert(s.offer).values({ orgId, applicationId, contingencies: ["background_check"] });
  const bgCheckId = newId();
  await db.insert(s.bgCheck).values({ id: bgCheckId, orgId, applicationId, provider: "simulator", package: "essential", orderedByMemberId: memberId });
  await db.insert(s.adverseAction).values({ orgId, bgCheckId, applicationId, startedByMemberId: memberId });
  await db.insert(s.checklistItem).values({ orgId, applicationId, phase: "pre_start", kind: "confidentiality_agreement", ownerRole: "recruiter" });

  // Cross-cutting
  await db.insert(s.notification).values({
    recipientAccountId: candidateAccountId,
    orgId,
    applicationId,
    kind: "fixture.test",
    templateVersion: "v1",
    title: "Fixture notification",
    body: "A made-up notification body.",
    dedupeKey: `fixture-${label}-${newId()}`,
  });
  await db.insert(s.auditEvent).values({
    orgId,
    requisitionId,
    applicationId,
    actorKind: "system_timer",
    actorJob: "fixture",
    action: "application.submitted",
    entityType: "application",
    entityId: applicationId,
  });

  return { label, orgId, memberAccountId, memberId, candidateAccountId, requisitionId, requirementId, applicationId, evidenceItemId, bgCheckId };
}

/** Global rows (no owner): one notice version and one processed webhook. */
export async function seedGlobal(db: Db): Promise<void> {
  await db.insert(s.noticeVersion).values({ kind: "ai_use", version: "fixture-ai-use.1", body: "A made-up notice.", bodySha256: "0".repeat(64), publishedAt: new Date() });
  await db.insert(s.processedWebhook).values({ provider: "simulator", eventId: `evt-${newId()}`, eventType: "fixture" });
}

/** The tables by plane, as drizzle/0001_rls_and_triggers.sql treats them. */
export const TENANT_TABLES = [
  "org_member",
  "provider_connection",
  "legal_hold",
  "impact_report",
  "requisition",
  "requirement",
  "work_sample_spec",
  "application",
  "evidence_item",
  "candidate_statement",
  "candidate_request",
  "work_sample_submission",
  "judgment",
  "work_sample_grade",
  "interview",
  "interview_rating",
  "ranking_snapshot",
  "proposal",
  "decision",
  "offer",
  "bg_check",
  "adverse_action",
  "checklist_item",
] as const;
export const ACCOUNT_TABLES = ["account", "email_token", "web_session", "access_token", "profile_evidence"] as const;
/** RLS tables with their own policy shape: org (by id), data_request, notification, audit_event. */
export const OTHER_RLS_TABLES = ["org", "data_request", "notification", "audit_event"] as const;
export const GLOBAL_TABLES = ["notice_version", "processed_webhook"] as const;
export const RLS_TABLES = [...TENANT_TABLES, ...ACCOUNT_TABLES, ...OTHER_RLS_TABLES] as const;
