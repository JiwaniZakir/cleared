// @vitest-environment node
/**
 * A canonical UUID that the guard exempts in its plain view stays exempt in
 * the views the guard derives from the same text, and the exemption is no
 * wider than it was.
 *
 * Before the fix the ROT13 view lost the exemption: ROT13 turns the hex
 * letters a-f into n-s, so the rotated id no longer matched UUID_SHAPE, and a
 * digit run inside it was read as an SSN or a card number. About 1 random
 * UUID in 100 was refused, alone or inside a sentence.
 *
 * Every expected value in the "no wider" tables below is what the guard
 * returned for that input before the fix, checked against the unmodified
 * lib/guard/pii.ts.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scanValueForPiiCui } from "@/lib/guard/pii";
import { SPEEDRUN_POSTING_IDS } from "./fixtures/speedrun-posting-ids";

const categoriesOf = (value: unknown) =>
  scanValueForPiiCui(value)
    .map((f) => f.category)
    .sort();

const rot13 = (s: string) =>
  s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });

/** Sentences an agent writes around an id (different from lib/db/ids.ts's). */
const SENTENCES = [
  (id: string) => `Please send the rubric for role_id ${id}, then the interview guide for ${id}.`,
  (id: string) => `Compare ${id} with the posting I saved yesterday; is ${id} still open?`,
];

/** Every way the tests send an id: alone, in each sentence, and as a tool input. */
function refusalsFor(id: string): string[] {
  const inputs: unknown[] = [id, ...SENTENCES.map((s) => s(id)), { role_id: id }];
  return inputs.flatMap((input) => scanValueForPiiCui(input).map((f) => f.category));
}

/** Pseudo-random but repeatable 8-4-4-4-12 hex ids, so a failure names an id
 *  that fails again. `v4` sets the version and variant digits as UUIDv4 does. */
function testIds(seed: string, count: number, v4: boolean): string[] {
  return Array.from({ length: count }, (_, i) => {
    const hex = createHash("sha256").update(`${seed}:${i}`).digest("hex").slice(0, 32).split("");
    if (v4) {
      hex[12] = "4";
      hex[16] = "89ab"[parseInt(hex[16], 16) & 3];
    }
    const h = hex.join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  });
}

/** An id the guard accepted before and after the fix (also used in pii.test.ts). */
const ID = "d2ad1e1d-61bf-4dcd-9d06-23f9a75ea5f2";
/** An id recorded as refused: the ROT13 view read "…2np259348102" as an SSN. */
const REFUSED_BEFORE = "1a9f3d07-283a-4312-867d-2ac259348102";

describe("ids the ROT13 view used to refuse", () => {
  it.each([
    ["the recorded example, read as an SSN in the ROT13 view", REFUSED_BEFORE],
    ["a crypto.randomUUID() id read as an SSN", "bf924b41-9488-4923-a8e3-18f298274753"],
    ["a crypto.randomUUID() id read as a card (22441141-8951-4580)", "22441141-8951-4580-914d-7ca27d103212"],
    ["a real upstream posting id read as an SSN", "351c7f8d-401e-3c0f-2d55-fd414666013b"],
  ])("%s passes alone, in sentences and as a tool input, in lower and upper case: %s", (_label, id) => {
    expect(refusalsFor(id)).toEqual([]);
    expect(refusalsFor(id.toUpperCase())).toEqual([]);
  });
});

describe("random and real ids pass", () => {
  it(
    "100,000 random UUIDv4s pass alone, in sentences and as a tool input",
    () => {
      const refused = testIds("d056-v4", 100_000, true).filter((id) => refusalsFor(id).length > 0);
      expect(refused.slice(0, 5)).toEqual([]);
    },
    180_000,
  );

  it(
    "50,000 ids of any version and 20,000 upper-case UUIDs pass alone, in sentences and as a tool input",
    () => {
      // Any-version ids are what the upstream Talent Network uses; before the
      // case-ID fix about 3 in 100,000 were refused as case numbers.
      const ids = [...testIds("d056-any", 50_000, false), ...testIds("d056-upper", 20_000, true).map((id) => id.toUpperCase())];
      const refused = ids.filter((id) => refusalsFor(id).length > 0);
      expect(refused.slice(0, 5)).toEqual([]);
    },
    180_000,
  );

  it("all 100 real upstream posting ids in the fixture pass alone, in sentences and as a tool input", () => {
    expect(SPEEDRUN_POSTING_IDS).toHaveLength(100);
    const refused = SPEEDRUN_POSTING_IDS.filter((id) => refusalsFor(id).length > 0);
    expect(refused).toEqual([]);
  });
});

describe("the exemption is no wider than before (each expected value is the guard's result before the fix)", () => {
  it.each([
    ["dashed SSN before an id", `123-45-6789 ${ID}`, ["ssn"]],
    ["dashed SSN after an id", `${ID} 123-45-6789`, ["ssn"]],
    ["dashed SSN joined to an id by a hyphen", `123-45-6789-${ID}`, ["ssn"]],
    ["bare valid-structure SSN after an id and a comma", `${ID},078051120`, ["ssn"]],
    ["bare valid-structure SSN after an id and a space", `${ID} 078051120`, ["ssn"]],
    ["SSN keyword and a 9-digit run, with an id", `my ssn is 987654321, role ${ID}`, ["ssn"]],
    ["spaced card number before an id", `4111 1111 1111 1111 ${ID}`, ["credit_card"]],
    ["bare card number after an id", `${ID} 4111111111111111`, ["credit_card"]],
    ["dashed card number joined after an id", `${ID}-4111-1111-1111-1111`, ["credit_card"]],
    ["dashed card number joined before an id", `4111-1111-1111-1111-${ID}`, ["credit_card"]],
    ["formatted phone number with an id", `call me at 555-867-5309 about ${ID}`, ["phone"]],
    ["bare phone number with a contact keyword and an id", `call me 5558675309 re ${ID}`, ["phone"]],
    ["international phone number after an id", `${ID} +44 7700 900123`, ["phone"]],
    ["EDIPI with an id", `my EDIPI is 1234567890 for ${ID}`, ["government_id"]],
  ])("next to a UUID — %s: %s", (_label, text, expected) => {
    expect(categoriesOf(text)).toEqual(expected);
  });

  it.each([
    ["a non-hex letter in the last group", "1a9f3d07-283a-4312-867d-2ag259348102", ["ssn"]],
    ["an 11-character last group", "1a9f3d07-283a-4312-867d-2c259348102", ["ssn"]],
    ["a 13-character last group", "1a9f3d07-283a-4312-867d-2acd259348102", ["ssn"]],
    ["a 9-character first group", "1a9f3d07a-283a-4312-867d-2ac259348102", ["ssn"]],
    ["a digit glued to the front", `0${REFUSED_BEFORE}`, ["ssn"]],
    ["no dashes", "1a9f3d07283a4312867d2ac259348102", ["ssn"]],
    ["underscores for dashes", "1a9f3d07_283a_4312_867d_2ac259348102", ["ssn"]],
    ["spaces for dashes", "1a9f3d07 283a 4312 867d 2ac259348102", ["ssn"]],
    ["a card number in an all-digit 8-4-4-4-11", "41111111-1111-1111-1111-11111111111", ["credit_card"]],
  ])("inside a string that merely resembles a UUID — %s: %s", (_label, text, expected) => {
    expect(categoriesOf(text)).toEqual(expected);
  });

  it.each([
    ["non-hex letters around a valid SSN", "1a9f3d07-283a-4312-867d-xy078051120z", ["ssn"]],
    ["a non-hex letter in the first group, card digits after", "4111111g-1111-1111-1111-111111111111", ["credit_card"]],
    ["U+2043 HYPHEN BULLET for dashes (not folded to '-')", "1a9f3d07⁃283a⁃4312⁃867d⁃2ac259348102", ["ssn"]],
    ["upper case with a non-hex letter", "1A9F3D07-283A-4312-867D-2AG259348102", ["ssn"]],
  ])("inside an 8-4-4-4-12 token that is not a canonical UUID — %s: %s", (_label, text, expected) => {
    expect(categoriesOf(text)).toEqual(expected);
  });

  it.each([
    ["the whole SSN sentence ROT13'd, beside an id", `${rot13("my ssn is 123-45-6789")} ${ID}`, ["ssn"]],
    ["a ROT13'd keyword with a 9-digit run only the ROT13 view reads", `${rot13("my ssn is 987654321 for")} ${ID}`, ["ssn"]],
    ["a ROT13'd keyword, then an id, then the 9 digits", `${rot13("my ssn is")} ${ID} 987654321`, ["ssn"]],
    ["a ROT13'd contact keyword and a bare phone number beside an id", `${rot13("call me")} 5558675309 ${rot13("about")} ${ID}`, ["phone"]],
    ["a ROT13'd EDIPI keyword and its number beside an id", `${rot13("my EDIPI is")} 1234567890, ${ID}`, ["government_id"]],
    ["a ROT13'd id carrying an SSN (not canonical as sent)", rot13(REFUSED_BEFORE), ["ssn"]],
    // The ROT13 view still reads the id's own text for every detector the
    // exemption does not cover: "ffa" at the start of a group reads "ssn".
    ["an SSN keyword ROT13'd into the id's own hex, and a 9-digit run", "ffad2ad1-61bf-4dcd-9d06-23f9a75ea5f2 987654321", ["ssn"]],
    ["an SSN keyword ROT13'd into the id's own hex, and a spaced SSN", "ffad2ad1-61bf-4dcd-9d06-23f9a75ea5f2, 1 2 3 4 5 6 7 8 9", ["ssn"]],
    ["a case-number keyword ROT13'd beside an id with an all-digit group", `${rot13("case number")} 12345678-abcd-4bcd-8bcd-abcdefabcdef`, ["case_number"]],
  ])("ROT13-encoded beside a UUID — %s: %s", (_label, text, expected) => {
    expect(categoriesOf(text)).toEqual(expected);
  });

  it.each([
    ["dashed SSN split by an id", (x: string) => `123-45-${x}-6789`],
    ["spaced SSN split by an id", (x: string) => `123 45 ${x} 6789`],
    ["spaced SSN split by an id, with a keyword", (x: string) => `my ssn is 123 45 ${x} 6789`],
    ["card number split by an id", (x: string) => `4111 1111 ${x} 1111 1111`],
  ])("split around a UUID — %s: the id counts exactly as any word would", (_label, split) => {
    // Both were accepted before the fix too: the guard does not rejoin a
    // number split by a word, an id or otherwise (a known gap).
    // What this pins: the exemption adds nothing for a split number.
    expect(categoriesOf(split(ID))).toEqual(categoriesOf(split("hello")));
  });
});

describe("the case-ID shape no longer reads a canonical UUID's own groups", () => {
  it.each([
    ["letters, a 19xx group, digits", "042d386f-dbdf-1923-3005-481d1c2a86de"],
    ["a 20xx group, letters, digits", "26f35375-2079-abcf-5847-f6bf3d5ea21c"],
    ["letters, a 19xx group, digits, again", "ee8e101d-1989-aacf-8876-954cf7014bd3"],
  ])("an id of any version refused before as a case number (%s) passes: %s", (_label, id) => {
    expect(refusalsFor(id)).toEqual([]);
    expect(refusalsFor(id.toUpperCase())).toEqual([]);
  });

  // Each expected value is the guard's result before the addendum.
  it.each([
    ["a case number before an id", `2024-ABC-56789 ${ID}`],
    ["a case number after an id", `${ID} DCSA-2026-0417`],
    ["a case number joined to an id by a hyphen, before", `DCSA-2026-0417-${ID}`],
    ["a case number joined to an id by a hyphen, after", `${ID}-2024-ABC-56789`],
    ["agency and year outside, digits running into an id", "DCSA-2026-04170000-1234-4234-8234-123456789012"],
    ["year and letters outside, digits running into an id", "2024-AB-12345678-1234-4234-8234-123456789012"],
    ["a non-hex letter in the id's letters group (not canonical)", "042d386f-dbzf-1923-3005-481d1c2a86de"],
    ["an 11-character last group (not canonical)", "042d386f-dbdf-1923-3005-481d1c2a86d"],
    ["a ROT13'd agency prefix beside an id", `${rot13("DCSA")}-2026-0417 ${ID}`],
    ["the keyword path, which still reads an id's digits (unchanged)", "in case 12345678-1a2b-4c3d-8e4f-0123456789ab is closed"],
  ])("still refused — %s: %s", (_label, text) => {
    expect(categoriesOf(text)).toEqual(["case_number"]);
  });
});

describe("an id the fix now accepts does not shield what sits next to it", () => {
  it("a number beside it is refused as it would be beside any id", () => {
    expect(categoriesOf(`${REFUSED_BEFORE} 123-45-6789`)).toEqual(["ssn"]);
    expect(categoriesOf(`${REFUSED_BEFORE} 4111 1111 1111 1111`)).toEqual(["credit_card"]);
    expect(categoriesOf(`${rot13("call me")} 5558675309, ${REFUSED_BEFORE}`)).toEqual(["phone"]);
  });

  it("a number split around it counts exactly as split around any word", () => {
    for (const split of [
      (x: string) => `123-45-${x}-6789`,
      (x: string) => `my ssn is 123 45 ${x} 6789`,
      (x: string) => `4111 1111 ${x} 1111 1111`,
    ]) {
      expect(categoriesOf(split(REFUSED_BEFORE))).toEqual(categoriesOf(split("hello")));
    }
  });
});

describe("a number inside a canonical UUID", () => {
  // The plain view never read the exempt detectors inside a canonical UUID. The
  // ROT13 view did only when rotation broke the id's shape, which is the
  // defect. Now neither does; nothing outside the id is affected (tables
  // above).
  it("was accepted before when all digits or in the plain view, and still is", () => {
    expect(categoriesOf("41111111-1111-4111-8111-111111111111")).toEqual([]);
    expect(categoriesOf("call me 1a9f3d07-283a-4312-867d-a1234567890b")).toEqual([]);
  });

  it("is no longer read in the ROT13 view either (before: refused only because rotation broke the id)", () => {
    expect(categoriesOf("00000000-0000-4000-8000-a078051120bc")).toEqual([]); // before: credit_card, ssn
    expect(categoriesOf(`${rot13("call me")} 1a9f3d07-283a-4312-867d-a1234567890b`)).toEqual([]); // before: phone
  });

  it("nor is a case-ID shape wholly inside one (before: case_number)", () => {
    expect(categoriesOf("00000000-2024-abcd-5678-000000000000")).toEqual([]);
  });
});
