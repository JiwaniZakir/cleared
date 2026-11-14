import { randomUUID } from "node:crypto";
import { scanValueForPiiCui } from "@/lib/guard/pii";

/**
 * Sentences an agent plausibly writes around an id. An id must pass the
 * personal-data guard alone and inside each of these.
 */
const SENTENCES = [
  (id: string) => `Call get_application with application_id ${id} to see where it stands.`,
  (id: string) => `Requisition ${id} is open; the request ${id} is due in two days.`,
];

/** True when the id, dashes removed, is only decimal digits. */
function isAllDigits(id: string): boolean {
  return /^\d+$/.test(id.replace(/-/g, ""));
}

/** True when the guard (lib/guard/pii.ts) finds nothing in the id alone or in a sentence. */
export function idPassesGuard(id: string): boolean {
  if (scanValueForPiiCui(id).length > 0) return false;
  return SENTENCES.every((s) => scanValueForPiiCui(s(id)).length === 0);
}

/**
 * Every identifier the product creates: a random UUIDv4 that the
 * personal-data guard accepts.
 *
 * Why the check: an id the guard refuses would make every later tool call
 * that carries it fail. When S1 was built, about 1 random UUID in 100
 * was refused: the guard's ROT13 view turned the hex letters a-f into n-s, so
 * the rotated id lost its UUID exemption and a digit run in it was read as an
 * SSN or a card number. A guard fix since: none of 100,000 random
 * UUIDv4s is refused now (tests/unit/pii-uuid-views.test.ts), so this check
 * is not expected to draw a second time. It stays: it costs one scan per id,
 * and it keeps the promise that an id this function returns passes the guard.
 *
 * Never all decimal digits: about 1 random UUIDv4 in 2.7 million has no hex
 * letter at all (e.g. 95444610-8150-4783-9192-810068414677), which reads as
 * a number, so it is drawn again.
 *
 * Never a serial number and never a short or prefixed id (a prefixed id
 * like `app_…` loses the UUID exemption entirely). The database has no id
 * default, so every row's id comes from here (tests/unit/ids-pass-guard.test.ts).
 */
export function newId(): string {
  for (let attempt = 0; attempt < 64; attempt++) {
    const id = randomUUID();
    if (isAllDigits(id)) continue;
    if (idPassesGuard(id)) return id;
  }
  // The guard refuses no UUIDv4 today; 64 refusals in a row mean the guard changed.
  throw new Error("newId: could not draw an id the personal-data guard accepts");
}
