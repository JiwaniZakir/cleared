// @vitest-environment node
/**
 * S1: every id the product creates is a random UUIDv4 that the
 * personal-data guard accepts alone and inside a sentence, because agents
 * send ids back in tool inputs and the guard runs on every input
 * (lib/tools/wrap.ts). Never a nine-digit number.
 *
 * newId() checks each id because about 1 in 100 raw random UUIDs was once
 * refused by the guard's ROT13 view. The guard itself has since been fixed.
 * The controls below now hold that no raw UUID is refused, so newId()'s
 * check never draws a second time; it stays, harmless.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertNoPiiCui, scanValueForPiiCui } from "@/lib/guard/pii";
import { newId } from "@/lib/db/ids";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Different from the sentences inside newId(), so this is not circular.
const sentence = (id: string) => `Your application ${id} is waiting on the hiring team; call get_updates and quote ${id}.`;

describe("ids pass the personal-data guard", () => {
  it(
    "100,000 ids from newId() are UUIDv4, never all digits, and pass assertNoPiiCui alone and in a sentence",
    () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100_000; i++) {
        const id = newId();
        seen.add(id);
        if (!UUID_V4.test(id) || /^\d+$/.test(id.replace(/-/g, ""))) throw new Error(`not a UUIDv4: ${id}`);
        assertNoPiiCui(id);
        assertNoPiiCui(sentence(id));
      }
      expect(seen.size).toBe(100_000);
    },
    300_000,
  );

  it("control: the guard refuses a nine-digit id, so ids are never numeric", () => {
    expect(() => assertNoPiiCui("application_id 287654321")).toThrow();
  });

  it("control: no raw random UUID is refused by the guard, alone or in a sentence", () => {
    const refused: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const id = randomUUID();
      if (scanValueForPiiCui(id).length > 0 || scanValueForPiiCui(sentence(id)).length > 0) refused.push(id);
    }
    // Before the guard fix about 1% were refused (499 of 50,000 on 2026-11-13).
    expect(refused).toEqual([]);
  });

  it("the recorded example UUID, refused before the fix (its ROT13 view read as an SSN), now passes", () => {
    expect(scanValueForPiiCui("1a9f3d07-283a-4312-867d-2ac259348102")).toEqual([]);
  });
});
