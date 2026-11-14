/**
 * Who is acting. Every service function receives an Actor and
 * writes the matching audit_event.actor_* columns in the same transaction as
 * the change, so a reviewer can tell "Dana, through her agent" from "Dana, on
 * the web" from "the system on a timer".
 *
 * A Principal is what a bearer token proves before any membership is read
 * (S2 resolves it in lib/auth/principal.ts); the service turns it into an
 * Actor by reading the person's membership and roles at call time, so a role
 * change takes effect immediately.
 */
import type { BgProvider, Role, Side, TokenScope } from "@/lib/pipeline/vocab";

export type Actor =
  | { kind: "person_agent"; accountId: string; tokenId: string; side: Side; orgId?: string; memberId?: string; roles: Role[] }
  | { kind: "person_web"; accountId: string; sessionId: string; side: Side; orgId?: string; memberId?: string; roles: Role[] }
  | { kind: "system_timer"; job: string }
  | { kind: "system_webhook"; provider: BgProvider; eventId: string };

export type PersonActor = Extract<Actor, { kind: "person_agent" | "person_web" }>;

/** A valid bearer token's identity: one account, one side, an org for the employer side. */
export interface Principal {
  accountId: string;
  tokenId: string;
  side: Side;
  orgId?: string;
  scopes: TokenScope[];
}

/** Why a request carries no valid principal; named in the `unauthenticated` error. */
export const TOKEN_PROBLEMS = ["missing", "revoked", "expired", "unknown"] as const;
export type TokenProblem = (typeof TOKEN_PROBLEMS)[number];

export function isPerson(actor: Actor): actor is PersonActor {
  return actor.kind === "person_agent" || actor.kind === "person_web";
}

/** The audit_event columns that name the actor (the database CHECK `audit_event_actor` requires them). */
export interface AuditActorColumns {
  actorKind: Actor["kind"];
  actorAccountId: string | null;
  actorMemberId: string | null;
  actorTokenId: string | null;
  actorSessionId: string | null;
  actorJob: string | null;
}

export function auditActorColumns(actor: Actor): AuditActorColumns {
  switch (actor.kind) {
    case "person_agent":
      return {
        actorKind: actor.kind,
        actorAccountId: actor.accountId,
        actorMemberId: actor.memberId ?? null,
        actorTokenId: actor.tokenId,
        actorSessionId: null,
        actorJob: null,
      };
    case "person_web":
      return {
        actorKind: actor.kind,
        actorAccountId: actor.accountId,
        actorMemberId: actor.memberId ?? null,
        actorTokenId: null,
        actorSessionId: actor.sessionId,
        actorJob: null,
      };
    case "system_timer":
      return { actorKind: actor.kind, actorAccountId: null, actorMemberId: null, actorTokenId: null, actorSessionId: null, actorJob: actor.job };
    case "system_webhook":
      return {
        actorKind: actor.kind,
        actorAccountId: null,
        actorMemberId: null,
        actorTokenId: null,
        actorSessionId: null,
        actorJob: `webhook:${actor.provider}:${actor.eventId}`,
      };
  }
}
