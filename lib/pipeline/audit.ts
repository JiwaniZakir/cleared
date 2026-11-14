/**
 * The audit log writer (table audit_event). Service functions call
 * recordAudit inside the same transaction as the change it records.
 *
 * The log is append-only in the database (no UPDATE or DELETE grant for the
 * app role, and a trigger; drizzle/0001_rls_and_triggers.sql). This module
 * adds the rules the database cannot check: the action is from the closed
 * list, and `before`/`after` carry only closed-vocabulary values, ids, dates,
 * numbers and booleans, never names, emails or free text.
 */
import { getTableName, isTable } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { auditEvent } from "@/lib/db/schema";
import { newId } from "@/lib/db/ids";
import type { Tx } from "@/lib/db/tx";
import { auditActorColumns, type Actor } from "@/lib/pipeline/actor";
import { AuditActionSchema, type AuditAction } from "@/lib/pipeline/vocab";

/** Every table name in the schema: the closed list for entity_type. */
export const ENTITY_TYPES: ReadonlySet<string> = new Set(
  Object.values(schema)
    .filter((v) => isTable(v))
    .map((t) => getTableName(t)),
);

/** A closed-vocabulary token: lower case, no spaces, no "@" (so never a name, an email or a sentence). */
const VOCAB_TOKEN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const ISO_DATE_OR_TIME = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

const AuditScalar = z.union([
  z.null(),
  z.boolean(),
  z.number().finite(),
  z.uuid(),
  z.string().regex(ISO_DATE_OR_TIME),
  z.string().regex(VOCAB_TOKEN),
]);
/** One level of keys; values are scalars or short arrays of scalars. */
export const AuditValuesSchema = z.record(
  z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  z.union([AuditScalar, z.array(AuditScalar).max(50)]),
);
export type AuditValues = z.infer<typeof AuditValuesSchema>;

export interface AuditInput {
  action: AuditAction;
  entityType: string;
  entityId: string;
  orgId?: string | null;
  /** The subject, for an event about a person's own account. */
  accountId?: string | null;
  requisitionId?: string | null;
  applicationId?: string | null;
  before?: AuditValues | null;
  after?: AuditValues | null;
  reasonCodes?: string[];
  modelId?: string | null;
  promptVersion?: string | null;
  requestId?: string | null;
}

export class AuditInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditInputError";
  }
}

function check(input: AuditInput): void {
  if (!AuditActionSchema.safeParse(input.action).success) throw new AuditInputError("audit action is not in the closed list");
  if (!ENTITY_TYPES.has(input.entityType)) throw new AuditInputError("audit entity_type must be a table name");
  for (const side of ["before", "after"] as const) {
    const v = input[side];
    if (v != null && !AuditValuesSchema.safeParse(v).success) {
      throw new AuditInputError(`audit ${side} may hold only ids, dates, numbers, booleans and closed-vocabulary values`);
    }
  }
  for (const code of input.reasonCodes ?? []) {
    if (!VOCAB_TOKEN.test(code)) throw new AuditInputError("audit reason codes come from a closed list");
  }
  if (input.requestId != null && !/^[A-Za-z0-9_.:-]{1,100}$/.test(input.requestId)) {
    throw new AuditInputError("audit request_id must be an opaque id");
  }
}

/** Writes one audit event in the caller's transaction and returns its id. */
export async function recordAudit(tx: Tx, actor: Actor, input: AuditInput): Promise<string> {
  check(input);
  const id = newId();
  // No RETURNING: an account-plane event (org_id NULL) is readable only by
  // the system, so the row-level-security read check would refuse it.
  await tx.insert(auditEvent).values({
    id,
    ...auditActorColumns(actor),
    orgId: input.orgId ?? null,
    accountId: input.accountId ?? null,
    requisitionId: input.requisitionId ?? null,
    applicationId: input.applicationId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    reasonCodes: input.reasonCodes ?? [],
    modelId: input.modelId ?? null,
    promptVersion: input.promptVersion ?? null,
    requestId: input.requestId ?? null,
  });
  return id;
}
