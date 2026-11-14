/**
 * Unknown input keys used to be dropped without a word. zod's default
 * `strip` is still how they are handled — agents add stray keys, and
 * refusing the call would break them — but every successful result now lists the keys that were dropped, in `ignoredInputKeys`, so an agent
 * that sends a submission or a candidate reference to a tool that cannot take
 * it finds out. Key names only, never values; and the personal-data guard has
 * already scanned every key and value of the raw input before this runs.
 */

/** Paths, in input order, of keys present in `raw` but absent from what the
 *  schema kept (`parsed`). Nested keys use dots and array indices
 *  ("claims.extra", "items[0].note"). Walks only where both sides are plain
 *  objects or arrays, so a transform that changes a value's type is not
 *  mistaken for a dropped key. */
export function findIgnoredInputKeys(raw: unknown, parsed: unknown, path = ""): string[] {
  if (Array.isArray(raw) && Array.isArray(parsed)) {
    return raw.flatMap((item, i) => (i < parsed.length ? findIgnoredInputKeys(item, parsed[i], `${path}[${i}]`) : []));
  }
  if (!isPlainObject(raw) || !isPlainObject(parsed)) return [];
  const ignored: string[] = [];
  for (const key of Object.keys(raw)) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) ignored.push(keyPath);
    else ignored.push(...findIgnoredInputKeys(raw[key], parsed[key], keyPath));
  }
  return ignored;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
