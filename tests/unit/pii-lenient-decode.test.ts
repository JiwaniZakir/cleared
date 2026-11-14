// @vitest-environment node
/**
 * One malformed piece of an encoding must never switch a
 * decoded view off. The percent view used `decodeURIComponent`, which throws
 * on the first malformed escape anywhere in the string, so a stray "%" let a
 * percent-encoded SSN through. Every "refused" case below was accepted by the
 * guard before this change; every "accepted" case was accepted before too.
 */
import { describe, expect, it } from "vitest";
import { scanValueForPiiCui } from "@/lib/guard/pii";

const categoriesOf = (text: string) =>
  scanValueForPiiCui(text)
    .map((f) => f.category)
    .sort();

const b64 = (s: string) => Buffer.from(s).toString("base64");
/** "123-45-6789", percent-encoded digit by digit. */
const SSN = "%31%32%33-%34%35-%36%37%38%39";

describe("percent view: a malformed escape no longer switches it off", () => {
  it.each([
    ["a lone % after (the reported case)", `my ssn is ${SSN} %`],
    ["a lone % before", `% my ssn is ${SSN}`],
    ["a malformed escape in the middle", `my ssn %zz is ${SSN}`],
    ["a truncated %3 at the end", `my ssn is ${SSN} %3`],
    ["a truncated %3 glued to the encoding", `my ssn is %3${SSN}`],
    ["%FF, a byte that is not valid UTF-8", `my ssn is ${SSN} %FF`],
    ["%FF glued to the encoding", `%FF${SSN}`],
    ["%C3, a UTF-8 lead byte with nothing after it", `my ssn is ${SSN} %C3x`],
    ["no keyword, a trailing %", `${SSN}%`],
    ["an encoded bare 9-digit run with a keyword, a trailing %", "my ssn is %31%32%33%34%35%36%37%38%39 %"],
    ["double encoding, a lone %", "my ssn is %2531%2532%2533-%2534%2535-%2536%2537%2538%2539 %"],
  ])("refuses an encoded SSN with %s: %s", (_label, text) => {
    expect(categoriesOf(text)).toEqual(["ssn"]);
  });

  it("refuses an encoded email with a stray % too (every detector reads the view)", () => {
    expect(categoriesOf("contact %6a%61%6e%65%40example.com %")).toEqual(["email"]);
  });

  it("refuses percent-encoded full-width digits (the decoded view is now normalized, like the entity view)", () => {
    const fullWidth = [..."１２３-４５-６７８９"].map((c) => encodeURIComponent(c)).join("");
    expect(categoriesOf(fullWidth)).toEqual(["ssn"]);
  });

  it.each([
    "50% remote",
    "Equity 0.5%-1%, 100% remote, 401k match 4%",
    "We run 100%AB tests at 95% confidence",
    "Use 20% of your time; an 80%/20% split; discount 15%OFF",
    "https://example.com/search?q=rocket%20engineer&loc=Huntsville%2C%20AL, 100% remote",
  ])("still accepts ordinary text with stray percent signs: %s", (text) => {
    expect(categoriesOf(text)).toEqual([]);
  });
});

describe("entity view: already tolerant, pinned", () => {
  // Each entity is replaced on its own and String.fromCodePoint is capped, so
  // a malformed or out-of-range entity never stopped the rest decoding.
  const ssn = "&#49;&#50;&#51;-&#52;&#53;-&#54;&#55;&#56;&#57;";
  it.each([
    ["malformed entities beside it", `${ssn} &#xZZ; &#; &#99999999;`],
    ["a lone-surrogate entity beside it", `${ssn} &#55296;`],
    ["an out-of-range entity beside it", `${ssn} &#x10FFFFF;`],
  ])("refuses an entity-encoded SSN with %s", (_label, text) => {
    expect(categoriesOf(text)).toEqual(["ssn"]);
  });
});

describe("base64 view: characters glued to the end no longer hide a token", () => {
  const sentence = b64("my ssn is 123-45-6789");
  it.each([
    ["one character", `${sentence}x`],
    ["two characters", `${sentence}xy`],
    ["three characters", `${sentence}xyz`],
    ["one character after an unpadded encoding", `${b64("my ssn: 123-45-6789").replace(/=+$/, "")}x`],
  ])("refuses a base64 SSN sentence with %s appended", (_label, text) => {
    expect(categoriesOf(text)).toEqual(["ssn"]);
  });

  it("still accepts an ordinary base64 sentence with a character appended", () => {
    expect(categoriesOf(`${b64("Interested in propulsion roles in Huntsville")}x`)).toEqual([]);
  });
});
