/**
 * The time inside a signed self-attestation (`issued_at`) is the signer's own
 * statement. The signature proves the bytes, so it proves the signer wrote
 * that time, not that it was written then: a statement dated 2019 verifies
 * as well as one dated today.
 *
 * The recipient is therefore told the stated time's age, and a stated time
 * older than STALE_STATED_TIME_DAYS is flagged rather than shown as fresh.
 * 30 days: the claims (clearance level, citizenship status, availability)
 * are meant to be re-signed for each share, the intro-card flow asks for
 * fresh consent per company, and a status such as an interim clearance can
 * change within a hiring cycle. A month covers one application without
 * presenting an old statement as current.
 */
export const STALE_STATED_TIME_DAYS = 30;
/** Clock skew tolerated before a stated time counts as "in the future". */
export const STATED_TIME_MAX_SKEW_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface StatedTimeCheck {
  /** Whole days between the stated time and now; null if it isn't a parseable past time. */
  ageDays: number | null;
  thresholdDays: number;
  isOld: boolean;
  isInFuture: boolean;
  note: string;
}

export function checkStatedTime(statedTime: string | null, now: number = Date.now()): StatedTimeCheck {
  const base = { thresholdDays: STALE_STATED_TIME_DAYS };
  const parsed = statedTime === null ? NaN : Date.parse(statedTime);
  if (Number.isNaN(parsed)) {
    return {
      ...base,
      ageDays: null,
      isOld: false,
      isInFuture: false,
      note: "No readable stated time: nothing says when this was signed.",
    };
  }
  if (parsed > now + STATED_TIME_MAX_SKEW_MS) {
    return {
      ...base,
      ageDays: null,
      isOld: false,
      isInFuture: true,
      note: `The signer's stated time (${statedTime}) is in the future. The signature cannot prove when anything was signed; treat this statement as unreliable and ask for a fresh one.`,
    };
  }
  const ageDays = Math.max(0, Math.floor((now - parsed) / DAY_MS));
  if (ageDays > STALE_STATED_TIME_DAYS) {
    return {
      ...base,
      ageDays,
      isOld: true,
      isInFuture: false,
      note: `The signer's stated time (${statedTime}) is ${ageDays} days old, past the ${STALE_STATED_TIME_DAYS}-day threshold this tool uses. The signature does not prove when it was signed, and a status can change in that time: ask for a freshly signed statement.`,
    };
  }
  return {
    ...base,
    ageDays,
    isOld: false,
    isInFuture: false,
    note: `The signer's stated time (${statedTime}) is ${ageDays} day${ageDays === 1 ? "" : "s"} old, within the ${STALE_STATED_TIME_DAYS}-day threshold. It is still the signer's own statement: the signature does not prove when it was signed.`,
  };
}
