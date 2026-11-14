/**
 * PII / CUI input guard.
 *
 * Non-negotiable: this server must never receive,
 * store, or log PII, clearance case details, or image uploads. This module is the
 * enforcement point — every MCP tool call and every /api/tools/* playground call
 * runs its raw input through `assertNoPiiCui` before anything else happens.
 *
 * Design principle: when a detector is ambiguous, prefer a false positive (reject
 * a benign request with a friendly explanation) over a false negative (let real
 * PII through). A rejected request costs the user one rephrase; a leaked SSN does
 * not get un-leaked. See tests/unit/pii.test.ts for the ~50+ case suite this is
 * calibrated against, including the tricky phone-number-vs-SSN cases.
 */

export type PiiCategory =
  | "ssn"
  | "dob"
  | "passport"
  | "case_number"
  | "clearance_record"
  | "image_upload"
  | "binary_data"
  | "unscannable_structure"
  | "credit_card"
  | "classification_marking"
  | "email"
  | "phone"
  | "government_id"
  | "address"
  | "personal_name"
  | "sensitive_disclosure"
  | "secret_credential";

export interface PiiFinding {
  category: PiiCategory;
  /** Friendly, user-facing explanation. Never echoes the matched text. */
  message: string;
}

const FRIENDLY_BY_CATEGORY: Record<PiiCategory, string> = {
  ssn: "This looks like it includes a Social Security Number. cleared never accepts SSNs — please remove it. Your own agent already knows your details privately; just describe your situation in general terms (e.g. \"I'm a US citizen\").",
  dob: "This looks like it includes a date of birth. cleared never accepts dates of birth — please remove it and continue without it.",
  passport: "This looks like it includes a passport number. cleared never accepts passport or ID document numbers — please remove it. If citizenship status matters, just state it in general terms (e.g. \"green card holder\").",
  case_number: "This looks like it includes an investigation or case number (e.g. an OPM/e-QIP/DCSA case ID). cleared never accepts these — please remove it.",
  clearance_record: "This looks like it includes clearance record or adjudication-system text (e.g. a DISS/JPAS/NBIS record). cleared never accepts clearance record text or screenshots — recruiters must verify clearance through an FSO, not self-reported record text. Please remove it.",
  image_upload: "cleared does not accept image uploads or screenshots of any kind, including clearance record screenshots. Please describe your situation in text instead.",
  binary_data: "This looks like it includes an embedded file or binary data. cleared only accepts plain text fields — please remove any attached file data.",
  unscannable_structure: "This request is structured too deeply (nested objects/arrays many levels deep) for cleared to safely check for sensitive information. Please simplify the request and try again.",
  credit_card: "This looks like it includes a credit card number. cleared never accepts payment card numbers — please remove it; nothing here needs billing information.",
  classification_marking: "This looks like it includes a classification marking (e.g. SECRET//NOFORN). cleared never accepts classified or export-controlled content, real or described — please remove it and describe your situation without quoting or paraphrasing any marked material.",
  email: "This looks like it includes an email address. cleared never accepts contact info — your own agent already knows how to reach you privately; please remove it and continue without it.",
  phone: "This looks like it includes a phone number. cleared never accepts contact info — your own agent already knows how to reach you privately; please remove it and continue without it.",
  government_id: "This looks like it includes a government ID number (e.g. a DoD ID/EDIPI, a USCIS A-number, or a driver's license number). cleared never accepts ID numbers — please remove it. If your status matters, describe it in general terms (e.g. \"green card holder\").",
  personal_name: "This looks like it includes your name. cleared never accepts names — your own agent knows who you are, and none of these tools needs it. Please remove it and continue.",
  sensitive_disclosure: "This looks like it includes sensitive personal details — the kind a clearance investigation or an employer must handle carefully (e.g. arrests, health or disability, finances, polygraph results, religion, or age). cleared never accepts these; your own agent can weigh them privately. To ask how something is treated, ask in general terms (e.g. \"how does SEAD 4 treat a past DUI?\").",
  secret_credential: "This looks like it includes an access token, password, or private key. cleared never accepts credentials — none of these tools needs one. Remove it, and rotate it if it was real.",
  address: "This looks like it includes a street address. cleared never accepts home or mailing addresses — please remove it. If location matters, a city or region is enough (e.g. \"open to roles near Huntsville\").",
};

/** SSN-context keywords that gate the riskier bare-9-digit check. No trailing
 *  `\b`: a couple of alternatives end in `#`, and `\b` right after a non-word
 *  char that's followed by whitespace is never a boundary, which would silently
 *  fail the match (caught by tests/unit/pii.test.ts — "ss# 123456789"). */
// "my social" / "social #" added after a red-team pass: it's how people
// actually refer to an SSN, and "my social is …" previously didn't register.
const SSN_CONTEXT = /\b(ssn|soc(?:ial)?[\s.-]*sec(?:urity)?|ss\s*#|my\s+social\b|social\s*(?:#|no\.?|num(?:ber)?\b))/i;
/** Strictly 3-2-4 digit groups joined by `-` or a space — the SSN print format.
 *  This grouping is not used by any other common identifier (US phone numbers are
 *  3-3-4), so it is rejected unconditionally, regardless of SSA area/group/serial
 *  validity — including well-known placeholder SSNs like 123-45-6789, which is the
 *  correct, safer behavior for a detector being red-teamed with "obviously fake" PII.
 */
// Includes "." as a separator alongside "-"/space: confirmed against
// Presidio's SSN5 pattern that a dotted SSN
// (123.45.6789) is a real format in the wild this was missing.
const SSN_DASHED = /\b\d{3}[-.\s/]\d{2}[-.\s/]\d{4}\b/;
/** An isolated 9-digit run, only treated as an SSN when an SSN keyword is present
 *  somewhere in the same field. */
const BARE_9_DIGITS = /\b\d{9}\b/;

// "born" alone counts: "Born 03/14/1992, happy to relocate" — bare "Born"
// directly followed by a date, no "on"/"in" preposition — once bypassed
// this guard entirely. Still gated by
// requiring an adjacent date pattern below, so bare "born" alone (no date
// nearby) still can't fire on its own.
const BIRTH_CONTEXT = /\b(dob|d\.o\.b\.?|date of birth|born|birth\s*date|birthday)\b/i;
const DATE_NUMERIC = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/;
const DATE_ISO = /\b\d{4}-\d{2}-\d{2}\b/;
const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const DATE_MONTH_DAY_YEAR = new RegExp(
  `\\b(?:${MONTH_NAMES})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
  "i",
);
const DATE_DAY_MONTH_YEAR = new RegExp(
  `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})\\.?,?\\s+\\d{4}\\b`,
  "i",
);
const BARE_YEAR = /\b(19|20)\d{2}\b/;
// A fully spelled-out date ("born march second nineteen ninety two") has no
// digits at all, so none of the numeric date-shape checks above can ever
// match it. Requires a month name, an ordinal (the day), and
// two more number-words (the year, spelled as two "teens/tens" words) all
// clustered within a bounded window — specific enough that ordinary prose
// is very unlikely to coincidentally match, while still catching this exact
// evasion. Still gated by BIRTH_CONTEXT below, same as every other DOB
// check here — a month name alone (e.g. "the posting closes March 2nd")
// must never flag on its own.
const ORDINAL_WORDS =
  "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth|thirty-first";
const CARDINAL_NUMBER_WORDS =
  "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";
const SPELLED_OUT_DATE = new RegExp(
  `\\b(?:${MONTH_NAMES})\\b.{0,30}?\\b(?:${ORDINAL_WORDS})\\b.{0,40}?\\b(?:${CARDINAL_NUMBER_WORDS})\\b.{0,20}?\\b(?:${CARDINAL_NUMBER_WORDS})\\b`,
  "i",
);

const PASSPORT_CONTEXT = /\bpassport(?:\s*(?:number|no\.?|#))?\b/i;
/** 6-9 char alphanumeric token containing at least one digit (excludes plain words). */
const ALPHANUM_ID_TOKEN = /\b(?=[A-Za-z0-9]{6,9}\b)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{6,9}\b/;

// No trailing `\b` — same reasoning as SSN_CONTEXT above: the `#` alternatives
// end in a non-word char, so a trailing boundary assertion can silently fail.
// "request" added to the e-QIP branch: "my e-QIP request number is
// 2024-SEC-0098765" bypassed this because the context list only had
// case/id/submission, not "request".
// A bare digit directly after "case"/"investigation" (no "number"/"no"/"#"/
// "id" word in between) added as a further alternative: "DCSA case
// 2024-0045678" bypassed this because "case" went straight into the number
// with no qualifying word at all.
const CASE_NUMBER_CONTEXT =
  /\b(case\s*(?:number|no\.?|#|id|\d)|investigation\s*(?:number|no\.?|#|id|\d)|e-?qip\s*(?:case|id|submission|request)|opm\s*case)/i;
const DIGIT_RUN_5PLUS = /\b[A-Za-z]?\d{5,}\b/;
// A standalone pattern (no keyword context needed): a 4-digit year, a dash,
// 2-4 letters, a dash, 4+ digits — the shape of a real government case ID
// ("2024-ABC-56789", "2024-SEC-0098765") distinctive enough to flag on
// structure alone: "my file 2024-ABC-56789
// is in review" and "reference number 2024-ABC-56789" both used generic
// framing words (file/reference) the keyword list was never going to cover
// exhaustively, but the ID's own shape is a reliable independent signal.
// Second alternative (letters-year-number, e.g. "DCSA-2026-0417") added:
// the original pattern only covered year-first case IDs ("2024-ABC-56789"); a real DCSA case
// number in agency-prefix order bypassed it entirely.
const CASE_ID_SHAPE =
  /\b(?:(19|20)\d{2}-[A-Za-z]{2,4}-\d{4,}|[A-Za-z]{2,6}-(19|20)\d{2}-\d{4,})\b/g;

/** Specific adjudication/records-system jargon. Deliberately narrow — generic
 *  words like "clearance", "secret", or "active" must NOT appear here, since
 *  stating one's own clearance status/level is self-attestation, not a record
 *  leak, and is exactly what this product needs users to be able to say.
 *  System NAMES (diss/jpas/nbis) require actual record-indicating context
 *  immediately adjacent — bare mentions do NOT match. Without this, asking
 *  explain_rule to explain what DISS/NBIS even ARE (the rule that explains
 *  *why* self-attestation isn't verification — exactly the content this
 *  product most wants to surface) was itself rejected as if it were pasted
 *  record text, including the rule's own id ("nbis-diss") and title ("NBIS
 *  vs. DISS: Current System of Record"), as an agent-in-the-loop test
 *  found. The other phrases
 *  below (subject summary, investigation opened/closed, etc.) still catch an
 *  actual record dump independently, so this narrowing doesn't meaningfully
 *  reduce real protection.
 *
 *  "owning smo"/"\bpsq\b" added: "JPAS Owning SMO: 123456, PSQ submitted,
 *  SON 1234567890"
 *  bypassed the record-context requirement above because it uses real
 *  JPAS field terminology (Security Management Office; Personnel Security
 *  Questionnaire) instead of a word like "record"/"shows". Both terms are
 *  distinctive enough internal-system jargon to add directly, without
 *  reintroducing the bare "jpas"/"diss"/"nbis" false positive this file's
 *  own history already fixed once — "SON" itself was
 *  deliberately left out despite appearing in the same bypass string,
 *  since it collides with the ordinary English word. */
// "record" excludes "record system(s)" / "record-keeping": "what is the
// difference between NBIS and DISS record systems" was rejected as pasted
// clearance-record text, the same question-about-a-system vs. content-
// from-one confusion fixed above for the bare system names. "My DISS
// record shows..." (record followed by content) is still rejected.
const CLEARANCE_RECORD_CONTEXT =
  /\b(?:diss|jpas|nbis)\s+(?:record(?!s?\s+systems?\b)(?!\s*-?\s*keeping)|printout|screenshot|summary|history|shows|says|entry)|e-?adjudication|subject summary|investigation (?:opened|closed)|adjudication (?:result|history)|eqip (?:record|history)|owning\s+smo|\bpsq\b/i;

/** Clearance-adjudication jargon, each too short/generic to flag bare (e.g.
 *  "CI" collides with "Continuous Integration" in a tech-hiring context,
 *  "T5"/"SOR" are too short to be safe alone) but, co-occurring with an
 *  adjudication-status verb anywhere in the same text, reliably indicates
 *  real clearance-record content rather than an innocent acronym mention.
 *  Without it, "my SOR was adjudicated
 *  favorably in 2021 with T5 scope and CI poly" and "my clearance was
 *  adjudicated under e-QIP" both bypassed every existing detector — neither
 *  names DISS/JPAS/NBIS, the only system names this file previously
 *  recognized, and the e-QIP case only required a trailing
 *  case/id/submission/request noun (CASE_NUMBER_CONTEXT), not an adjacent
 *  adjudication verb. */
const ADJUDICATION_JARGON_TOKEN =
  /\b(?:sor|t-?5\s+(?:scope|investigation|clearance)|tier\s*5\s+(?:scope|investigation)|ci\s*poly(?:graph)?|counterintelligence\s+poly(?:graph)?|e-?qip)\b/i;
const ADJUDICATION_VERB = /\b(?:adjudicat\w*|submitted|processed|completed|pending|favorably|unfavorably)\b/i;

const IMAGE_DATA_URI = /data:image\/[a-z0-9+.-]+;base64,/i;
const BINARY_DATA_URI = /data:[a-z0-9/+.-]+;base64,/i;
/** A long, unbroken run of base64-alphabet characters with no PII keyword nearby —
 *  heuristic catch-all for a pasted file/image with no explicit MIME prefix. */
const LONG_BASE64_RUN = /[A-Za-z0-9+/]{200,}={0,2}/;
/** Credit-card-shaped: 4 groups of 4 digits (with optional separators),
 *  Luhn-plausible length — not one of the originally documented refused
 *  categories, but squarely within the "never receive PII" rule, and this exact
 *  shape essentially never appears in legitimate defense-job-search
 *  content, so it's safe to flag on structure alone. */
const CREDIT_CARD_SHAPE = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/;
/** Standard UUID shape (8-4-4-4-12 hex, dash-separated). Every internal
 *  identifier in this product (role_id, etc.) is a UUID, and an all-numeral
 *  one (e.g. "00000000-0000-4000-8000-000000000000" — a plausible probe
 *  value, or any UUID whose hex digits happen to all land on 0-9) can
 *  satisfy CREDIT_CARD_SHAPE's 4-4-4-4 digit-group pattern by coincidence.
 *  A legitimate role_id lookup was once rejected as "a credit card number."
 *  The same exemption also covers the
 *  other shapes a UUID's digit runs can satisfy by coincidence: the bare
 *  valid-structure SSN, the bare and international phone numbers, and the
 *  EDIPI, A-number and driver's-licence numbers, and the case-ID shape, for a match wholly inside the UUID (see
 *  `hasCaseIdShape`). Only those: every other detector, keyword checks
 *  included, still reads a UUID's text. The exemption is this exact shape and
 *  nothing looser. It holds in the ROT13 view too (see
 *  `scanTextForPiiCui`). */
const UUID_SHAPE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** A [start, end) index range of a string. */
type Span = readonly [start: number, end: number];

/** Where the canonical UUIDs are in `text`, in order. */
function uuidSpans(text: string): Span[] {
  return Array.from(text.matchAll(UUID_SHAPE), (m) => [m.index!, m.index! + m[0].length] as const);
}

/** The text the UUID-exempt detectors read: `text` without the UUIDs it
 *  contains and without the `inherited` spans, which held a canonical UUID
 *  in the text this view was derived from. With no inherited spans
 *  this is `text.replace(UUID_SHAPE, "")`, as before. */
function withoutExemptIds(text: string, inherited: readonly Span[]): string {
  let kept = "";
  let from = 0;
  for (const [start, end] of inherited) {
    kept += text.slice(from, start);
    from = end;
  }
  return (kept + text.slice(from)).replace(UUID_SHAPE, "");
}

/** CASE_ID_SHAPE anywhere except wholly inside a canonical UUID: an id's own
 *  groups can take the shape by coincidence ("042d386f-dbdf-1923-3005-…",
 *  about 3 ids in 100,000 of any version; never a UUIDv4, whose third group
 *  starts with 4). A match reaching outside the id still counts, so a case
 *  number whose digits run into an id ("DCSA-2026-04170000-…") is refused as
 *  before. Removing ids first, as `withoutExemptIds` does, would have let
 *  that through. */
function hasCaseIdShape(text: string, idSpans: readonly Span[]): boolean {
  for (const m of text.matchAll(CASE_ID_SHAPE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (!idSpans.some(([s, e]) => start >= s && end <= e)) return true;
  }
  return false;
}

/** A real classification/control marking, in either its spelled-out banner
 *  form ("SECRET//NOFORN") or its abbreviated portion-marking form
 *  ("(S//NF)", "(TS//SI/TK)"). A synthetic "SECRET//NOFORN ... propulsion
 *  subsystem spec sheet ..." string was accepted and echoed verbatim into
 *  `prepare_consented_card`'s shareable output. Anchored specifically on
 *  the "//" + a recognized control-marking abbreviation (NOFORN/ORCON/
 *  FOUO/REL TO/NATO/SI/TK/HCS/SAP/FISA) — deliberately not on a bare
 *  classification-level word alone (that's exactly the self-attestation
 *  language, "I have a Secret clearance," this file's own design
 *  elsewhere protects as legitimate). Distinctive enough that ordinary
 *  text has no plausible reason to contain this exact shape. */
const CLASSIFICATION_MARKING =
  /\b(?:top secret|secret|confidential|unclassified)\s*\/\/\s*(?:noforn|orcon|fouo|rel\s+to|nato|si|tk|hcs|sap|fisa)\b|\(\s*(?:u|c|s|ts)\s*\/\/\s*(?:nf|noforn|orcon|fouo|rel\s+to|nato|si|tk|hcs|sap|fisa)/i;

/** Standard email shape. This guard once caught every documented category
 *  (SSN/DOB/passport/credit-card/classification-marking) but had no
 *  detector at all for contact info, directly contradicting this
 *  product's own "never receives... PII" claim. Not RFC-5322-complete —
 *  deliberately so; a looser, common-case pattern catches real emails
 *  without the edge cases a fully spec-compliant regex invites. */
// Quantifiers bounded to RFC 5321's own limits (64-char local part, 253-char
// domain): an unbounded `[...]+` here re-scans the rest of the input from
// every word boundary, which made a 20KB run of "a.a.a." quadratic.
const EMAIL_SHAPE = /\b[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}\b/;
/** A US-phone-number shape WITH separators (dash/dot/space, optional
 *  parens around the area code, optional leading +1) — deliberately
 *  requires a separator, unlike SSN_DASHED's fixed grouping, so this
 *  can't collide with an unrelated bare-digit-run elsewhere in this file;
 *  a bare, unformatted 10-digit run is not treated as a phone number on
 *  structure alone (same conservative stance as BARE_9_DIGITS needing an
 *  SSN keyword) since nothing in this product's own domain data has a
 *  legitimate reason to contain one anyway. */
const PHONE_FORMATTED = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/;

/** A full calendar date with day precision. The DOB
 *  detector above requires a birth keyword ("DOB"/"born") next to a date,
 *  so a bare birthdate typed the way people normally type one
 *  ("01/15/1990", "1990-01-15") passed every tool, and was echoed into
 *  prepare_consented_card's shareable card as "Available starting
 *  01/15/1990." A first fix covered only `/` and `-` with a 4-digit year;
 *  a later red-team pass found the
 *  same birthdate still passed written out ("January 15, 1990", "15th of
 *  January, 1990"), dotted ("15.01.1990"), space-separated, or with a
 *  2-digit year ("1/15/90") — all now covered. Dotted and spaced forms
 *  require a 4-digit year: "Python 3.12.10" must never read as a date. */
const NUMERIC_DMY_4 = /(?<![\d.])(\d{1,2})([/.\- ])(\d{1,2})\2(\d{4})(?![\d.]?\d)/g;
const NUMERIC_DMY_2 = /(?<![\d./-])(\d{1,2})([/-])(\d{1,2})\2(\d{2})(?![\d/-]?\d)/g;
const NUMERIC_YMD = /(?<![\d.])(\d{4})([/.-])(\d{1,2})\2(\d{1,2})(?!\d)/g;
const WRITTEN_MDY = new RegExp(String.raw`\b(?:${MONTH_NAMES})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`, "gi");
const WRITTEN_DMY = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:${MONTH_NAMES})\.?,?\s+(\d{4})\b`, "gi");
/** No legitimate input to this product has a reason to carry a day-precise
 *  date more than this many years in the past: availability and start
 *  dates are near-future, posting dates are recent, and work history on a
 *  card is expressed in years or month/year. A day-precise date this old
 *  is, overwhelmingly, someone's birthdate — 16 being a working-age floor,
 *  so every working adult's birth year falls at or before it. Month/year
 *  forms ("05/2015") still require a birth keyword, as before. */
const BIRTH_PLAUSIBLE_MIN_AGE_YEARS = 16;
const BIRTH_PLAUSIBLE_MAX_AGE_YEARS = 100;
/** The one real collision class: dates of laws and organizations, which this
 *  product's own domain discusses ("Executive Order 12968 of August 2, 1995",
 *  "founded March 14, 2002"). Exempt only when one of these words directly
 *  precedes the date — none of them describes a person, and "born"/"DOB"
 *  still fire through BIRTH_CONTEXT regardless. */
const INSTITUTIONAL_DATE_LEAD =
  /(?:\b(?:signed|issued|enacted|amended|founded|established|incorporated|promulgated|rescinded)\b|\b(?:executive\s+order|e\.?\s?o\.?)\s*\d{4,5}\b(?:\s+of)?)[\s,(:]*(?:on\s+|in\s+)?$/i;

function isBirthPlausibleYear(year: number, currentYear: number): boolean {
  const age = currentYear - year;
  return age >= BIRTH_PLAUSIBLE_MIN_AGE_YEARS && age <= BIRTH_PLAUSIBLE_MAX_AGE_YEARS;
}

function hasBirthPlausibleFullDate(text: string): boolean {
  const currentYear = new Date().getUTCFullYear();
  const isCalendarDate = (month: number, day: number) => month >= 1 && month <= 12 && day >= 1 && day <= 31;
  const institutional = (index: number) => INSTITUTIONAL_DATE_LEAD.test(text.slice(Math.max(0, index - 40), index));

  for (const m of text.matchAll(NUMERIC_DMY_4)) {
    const [a, b, year] = [Number(m[1]), Number(m[3]), Number(m[4])];
    if (isBirthPlausibleYear(year, currentYear) && (isCalendarDate(a, b) || isCalendarDate(b, a)) && !institutional(m.index!)) return true;
  }
  for (const m of text.matchAll(NUMERIC_DMY_2)) {
    const [a, b, yy] = [Number(m[1]), Number(m[3]), Number(m[4])];
    // Read a 2-digit year the way people write one (the usual pivot rule):
    // 20yy unless that's more than 10 years out, else 19yy. So "1/5/27" is
    // 2027 — an upcoming start date — while "1/15/90" is 1990.
    const year = 2000 + yy <= currentYear + 10 ? 2000 + yy : 1900 + yy;
    if (isBirthPlausibleYear(year, currentYear) && (isCalendarDate(a, b) || isCalendarDate(b, a)) && !institutional(m.index!)) return true;
  }
  for (const m of text.matchAll(NUMERIC_YMD)) {
    const [year, a, b] = [Number(m[1]), Number(m[3]), Number(m[4])];
    if (isBirthPlausibleYear(year, currentYear) && (isCalendarDate(a, b) || isCalendarDate(b, a)) && !institutional(m.index!)) return true;
  }
  for (const re of [WRITTEN_MDY, WRITTEN_DMY]) {
    for (const m of text.matchAll(re)) {
      const [day, year] = [Number(m[1]), Number(m[2])];
      if (isBirthPlausibleYear(year, currentYear) && day >= 1 && day <= 31 && !institutional(m.index!)) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Found by a red-team pass: 21 of 33 format variations of already-covered */
/* categories slipped through, plus four identifier types the guard had no    */
/* category for at all. Each detector below names what it closes.             */
/* ------------------------------------------------------------------------ */

/** A masked SSN ("XXX-XX-6789", "***-**-6789") — an unambiguous shape. */
const SSN_MASKED = /(?<![\w*#•])[xX*#•]{3}[-.\s]?[xX*#•]{2}[-.\s]?\d{4}\b/;
/** "SSN ending 6789", "last 4 of my SSN: 6789" — partial SSNs are still
 *  identifying, and the guard's own copy says SSNs are never accepted. */
const SSN_LAST_FOUR =
  /\blast\s*(?:4|four)(?:\s*digits)?\s*of\s*(?:my\s*)?(?:ssn|social(?:\s*security)?(?:\s*number)?)\b\D{0,15}\d{4}\b|\b(?:ssn|social\s*security(?:\s*number)?|my\s+social)\b\D{0,20}?\b(?:last\s*(?:4|four)|ending|ends)\b\D{0,15}\d{4}\b/i;
const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};
/** A view of the text for SSN detection only: digit words become digits,
 *  spaces around hyphens and between digits are dropped — so "1 2 3 - 4 5 -
 *  6 7 8 9" and "one two three…" reduce to the same shape SSN_DASHED and the
 *  keyword-gated 9-digit check already look for. Never shown or returned. */
function ssnDetectionView(text: string): string {
  return text
    .replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/gi, (w) => DIGIT_WORDS[w.toLowerCase()])
    .replace(/\s*-\s*/g, "-")
    .replace(/(?<=\d)\s+(?=\d)/g, "");
}

/** "jane.doe @ gmail.com" — spaces around the @. Subsumes EMAIL_SHAPE. */
const EMAIL_SPACED = /\b[A-Za-z0-9._%+-]{1,64}[ \t]{0,3}@[ \t]{0,3}[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}\b/;
const OBF_AT_BRACKETED = String.raw`[ \t]{0,3}[\[({<][ \t]{0,3}at[ \t]{0,3}[\])}>][ \t]{0,3}`;
const OBF_DOT = String.raw`(?:[ \t]{0,3}[\[({<][ \t]{0,3}dot[ \t]{0,3}[\])}>][ \t]{0,3}|[ \t]{1,3}dot[ \t]{1,3})`;
/** Cheap precheck: the obfuscated-email pattern can only match text that
 *  contains an "at" token at all, so most input skips it entirely. */
const HAS_AT_TOKEN = /\bat\b/i;
const EMAIL_TLDS = "com|org|net|edu|gov|mil|io|co|us|ai|dev|me|app|info|biz|xyz|tech";
/** "jane [at] gmail [dot] com", "jane (at) gmail.com", "jane at gmail dot com".
 *  A plain " at " counts only alongside an obfuscated " dot " — so "I work at
 *  google.com" is never mistaken for an address. */
const EMAIL_OBFUSCATED = new RegExp(
  String.raw`\b[A-Za-z0-9._%+-]{1,64}(?:${OBF_AT_BRACKETED}[A-Za-z0-9-]{1,63}(?:(?:${OBF_DOT}|\.)[A-Za-z0-9-]{1,63}){0,8}(?:${OBF_DOT}|\.)(?:${EMAIL_TLDS})|\s+at\s+[A-Za-z0-9-]{1,63}(?:(?:${OBF_DOT}|\.)[A-Za-z0-9-]{1,63}){0,8}${OBF_DOT}(?:${EMAIL_TLDS}))\b`,
  "i",
);

/** An unformatted 10-digit (or +1 11-digit) number next to a contact keyword:
 *  "call me 5558675309". Keyword-gated, like BARE_9_DIGITS. */
const PHONE_CONTEXT = /\b(?:call|text|phone|cell|mobile|tel|telephone|whatsapp|reach\s+me|contact\s+me)\b/i;
const PHONE_BARE = /(?<![\d-])\+?1?\d{10}(?![\d-])/;

/** DoD ID / EDIPI — the 10-digit number on a Common Access Card. */
const EDIPI_CONTEXT = /\b(?:edipi|dod[\s-]*id|dod\s+(?:benefits\s+)?number|cac(?:\s*card)?\s*(?:number|no\b|#|id\b))/i;
const TEN_DIGITS = /(?<!\d)\d{10}(?!\d)/;
/** USCIS A-number / alien registration number / USCIS account number.
 *  Deliberately requires the hyphenated "A-number" or "A#" form — the bare
 *  phrase "a number" is ordinary English. */
const A_NUMBER_CONTEXT =
  /\bA-(?:number|no\b|#)|\bA#|\balien\s*(?:registration\s*)?(?:number|no\b|#)|\buscis\s*(?:#|number|no\b|account\s*number)|\bgreen\s*card\s*(?:number|no\b|#)/i;
const A_NUMBER_SHAPE = /(?<!\w)A?-?\d{7,9}(?!\d)|(?<!\d)\d{3}[-\s]\d{3}[-\s]\d{3}(?!\d)/i;
/** A USCIS receipt number (3-letter service-center code + 10 digits) — a
 *  shape nothing else shares, so no keyword is required. */
const USCIS_RECEIPT = /\b(?:EAC|WAC|LIN|SRC|NBC|MSC|IOE|YSC)[\s-]?\d{10}\b/i;
const DRIVERS_LICENSE_CONTEXT = /\b(?:driver'?s?\s*licen[cs]e|driving\s*licen[cs]e|DL\s*(?:#|no\b|number))/i;
/** 7–14 digits, optionally dash-separated, optionally after 1–2 letters.
 *  7+ so a ZIP code or a salary figure in the same sentence doesn't count. */
const DRIVERS_LICENSE_TOKEN = /\b[A-Za-z]{0,2}-?\d(?:-?\d){6,13}\b/;

const STREET_SUFFIX =
  "street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|terrace|ter|circle|cir|parkway|pkwy|highway|hwy|trail|trl";
const STREET_ADDRESS = String.raw`\b\d{1,6}[ \t]{1,3}(?:[A-Za-z0-9.'-]{1,30}[ \t]{1,3}){0,4}(?:${STREET_SUFFIX})\b\.?(?:[ \t]{1,3}(?:n|s|e|w|ne|nw|se|sw)\b\.?)?`;
/** A complete street address with city, state, and ZIP — specific enough to
 *  flag on shape alone. */
const FULL_ADDRESS = new RegExp(
  String.raw`${STREET_ADDRESS}(?:,?[ \t]{1,3}(?:apt|unit|suite|ste|#)\.?[ \t]{0,3}[\w-]{1,10})?,?[ \t]{1,3}[A-Za-z][A-Za-z .'-]{0,40},?[ \t]{1,3}[A-Z]{2}[ \t]{1,3}\d{5}(?:-\d{4})?\b`,
  "i",
);
/** A bare street address ("123 Main St") counts only next to a residence
 *  keyword — "the 2 roles on Rocket Road" alone shouldn't. */
const ADDRESS_CONTEXT =
  /\b(?:i\s+live\s+at|i\s+live\s+on|my\s+(?:home\s+|mailing\s+|street\s+)?address|home\s+address|mailing\s+address|reside\s+at)\b/i;
const STREET_ADDRESS_RE = new RegExp(STREET_ADDRESS, "i");

/* ------------------------------------------------------------------------ */
/* A later review: 38 of 80 refuse-list payloads got through.                */
/* ------------------------------------------------------------------------ */

/** A bare 9-digit run with a valid SSN structure (area 001–899 except 666,
 *  group 01–99, serial 0001–9999). This used to require an SSN keyword,
 *  but an unlabeled SSN ("software 078051120") accepted and
 *  echoed. No legitimate input here carries a bare 9-digit run — role ids
 *  are UUIDs (removed before this check), comp figures and years are shorter.
 *  The stated cost: a 9-digit order or tracking number is rejected too. */
const BARE_9 = /(?<![\d-])(\d{3})(\d{2})(\d{4})(?![\d-])/g;
function hasBareValidSsnShape(text: string): boolean {
  for (const m of text.matchAll(BARE_9)) {
    const area = Number(m[1]);
    if (area === 0 || area === 666 || area >= 900) continue;
    if (Number(m[2]) === 0 || Number(m[3]) === 0) continue;
    return true;
  }
  return false;
}

/** "birthdate 19880314" — compact YYYYMMDD; keyword-gated (8-digit runs are common). */
const DATE_COMPACT = /\b(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\b/;

/** I-94 admission record numbers (11 characters). */
const I94 = /\bI-?94\b[^.\n]{0,30}?\b[0-9A-Z]{11}\b/i;

/** "+44 7700 900123", "+15125550143" — a leading "+" and 8–15 digits is a
 *  phone number in any country's format. */
const INTL_PHONE = /(?<![\w+])\+\d[\d\s().-]{6,20}\d(?!\d)/g;
function hasIntlPhone(text: string): boolean {
  for (const m of text.matchAll(INTL_PHONE)) {
    const digits = m[0].replace(/\D/g, "").length;
    if (digits >= 8 && digits <= 15) return true;
  }
  return false;
}

/** Marking SYNTAX, not marking vocabulary: "what does FOUO mean?" is a
 *  legitimate question, "CUI//SP-EXPT" is a marking. Banners and portion
 *  marks use "//"; legends are recognizable sentences. A review found
 *  "TOP SECRET//SCI" ("SCI" wasn't in the old list), "S//REL TO USA, FVEY"
 *  (abbreviated level, no parentheses), and every CUI form passing. */
const MARKING_BANNER =
  /\b(?:top\s+secret|secret|confidential|unclassified|controlled|cui)\s*\/\/\s*[a-z0-9]/i;
const MARKING_ABBREVIATED = /(?<![\w/])(?:TS|S|C|U)\s*\/\/\s*(?:[A-Z]{2,}|REL\b)/;
const MARKING_PORTION = /\(\s*(?:TS|S|C|U|CUI)\s*\/\/[^)]{1,40}\)|(?<!information\s)\(\s*CUI\s*\)/i;
/** All-caps banner lines (a question uses normal case). */
const MARKING_ALLCAPS_PHRASE =
  /\b(?:ITAR|EXPORT)[ -]CONTROLLED\b|\bCONTROLLED UNCLASSIFIED INFORMATION\b|\bFOR OFFICIAL USE ONLY\b|\bREL TO (?:USA|FVEY|[A-Z]{3})\b|\bNOFORN\b(?=[\s,;/)]*(?:$|\n|[A-Z]{2,}))|\bDISTRIBUTION STATEMENT [B-F]\b/;
/** Legend text — the sentences printed on controlled documents. */
const MARKING_LEGEND =
  /\bdistribution authorized to\b|\bexport (?:of (?:this|these)[^.]{0,40}|is )restricted by the arms export control act\b|\barms export control act\b[^.]{0,80}\b(?:title 22|criminal penalties|severe penalties)\b|\bwarning\s*[-:–—]\s*this document contains technical data\b|\bdestruction notice\b[^.]{0,40}\bdestroy\b/i;
/** Described controlled technical data being handed over: a label plus a
 *  colon introducing content ("ITAR-controlled technical data: …"), or a
 *  tolerance spec alongside an ITAR/export-control label. A question about
 *  ITAR data ("will I handle ITAR-controlled data?") has neither. */
const CONTROLLED_DATA_CONTENT =
  /\b(?:itar|export)[- ]controlled\b[^.\n]{0,40}?\b(?:technical data|drawings?|schematics?|specs?|specifications?|blueprints?|tolerances?|source code)\s*[:=]\s*\S|\b(?:itar|export)[- ]controlled\b[^.\n]{0,80}[±]\s*\d|\bitar[- ]controlled (?:schematics?|drawings?|blueprints?)\b/i;

/** Adjudication history and record fields, e.g. "My TS was granted …
 *  after SOR for Guideline H", "An incident report was filed in DISS",
 *  "Eligibility: TS; Access: SCI; Investigation Type: SSBI". A general
 *  question ("what is a Statement of Reasons?") names no outcome. */
const ADJUDICATION_HISTORY =
  /\b(?:sor|statement of reasons|letter of denial|letter of revocation|lod|lor)\b[^.]{0,60}\bguideline\s+[a-m]\b|\bincident report\b[^.]{0,40}\b(?:filed|entered|submitted|recorded|logged)\b[^.]{0,30}\b(?:diss|jpas|nbis|e-?qip)\b|\b(?:my|i|i've|i was|we)\b[^.]{0,30}\b(?:received|got|was issued|was sent)\b[^.]{0,20}\b(?:an? )?(?:sor|statement of reasons|letter of denial|letter of revocation)\b/i;
const RECORD_FIELD =
  /\b(?:eligibility|access|investigation(?:\s+type)?|adjudication(?:\s+date)?|closed date|ce enrollment|sii)\s*:\s*(?:ts\b|sci\b|s\b|secret|top secret|confidential|t[1-5]r?\b|ssbi|sbpr|naclc|anaci|pr\b|favorabl|enrolled|denied|revoked)/gi;

/** First-person sensitive disclosures: a failed polygraph, a DUI,
 *  mental-health history, religion, age, and disability once reached an
 *  employer-facing card. Asking in general terms ("does a DUI disqualify
 *  someone?") passes; stating it about yourself doesn't. */
const SENSITIVE_DISCLOSURE =
  /\b(?:i|i've|i have|i had|i was|i'm|i am|my)\b[^.]{0,30}?\b(?:failed (?:a |my |the )?poly(?:graph)?|dui|dwi|arrested|convicted|felony|misdemeanou?r|bankrupt\w*|foreclos\w*|rehab\b|in treatment for|psychiatric|hospitali[sz]ed for|diagnosed with|adhd|ptsd|bipolar|schizophreni\w*|on probation|on parole)\b|\bi(?:'m| am)\s+(?:\d{2}|[a-z]+(?:-[a-z]+)?)\s+years?\s+old\b|\b(?:i(?:'m| am)|as)\s+an?\s+(?:practicing\s+|devout\s+)?(?:muslim|christian|jew|jewish|hindu|buddhist|sikh|catholic|mormon|atheist)\b|\bi(?:'m| am)\s+(?:pregnant|disabled|deaf|blind)\b|\bmy (?:religion|race|ethnicity|disability|age|national origin|nationality|diagnosis) is\b/i;

/** "CA DL D1234567" — a state code or "DL" directly followed by a license-shaped
 *  token, with no "#"/"number" between them. Case-sensitive. */
const DL_INLINE = /\bDL\s+[A-Z]{0,2}\d{5,13}\b/;

/** "Jane Q. Doe, 1600 Pennsylvania Ave NW": a full name directly
 *  followed by a street address. Either alone stays allowed — "the office at
 *  2000 Avenue of the Stars" is a company address. */
const NAME_COMMA_BEFORE_DIGIT = /\b[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+,\s*(?=\d)/g;
const STREET_AT_START = new RegExp(`^${STREET_ADDRESS}`, "i");
function hasNameThenStreet(text: string): boolean {
  for (const m of text.matchAll(NAME_COMMA_BEFORE_DIGIT)) {
    if (STREET_AT_START.test(text.slice(m.index! + m[0].length))) return true;
  }
  return false;
}

/** "My name is Jane Doe" / "Name: Jane Doe" — explicit self-identification only. */
const PERSONAL_NAME = /\b[Mm][Yy] [Nn][Aa][Mm][Ee] [Ii][Ss]\s+[A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)?|\b[Nn]ame\s*:\s*[A-Z][a-z]+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z]+/;

/** Tokens and private keys. A GitHub token (ghp_…) was once accepted
 *  and echoed. The Ed25519 PKCS#8 prefix catches a private key pasted where
 *  prepare_signed_attestation's public key belongs. */
const SECRET_CREDENTIAL =
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b|\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b|\bMC4CAQAwBQYDK2VwBCIEI[A-Za-z0-9+/]{20,}={0,2}|\bpassword\s*[:=]\s*\S{4,}/i;

/** The actual, un-obfuscated detectors. Operates on already-normalized,
 *  already-decoded plain text — see `scanTextForPiiCui` below, which is the
 *  only caller and the thing that actually runs against raw user input.
 *  `inheritedIds`: spans of `text` that held a canonical UUID in the text a
 *  derived view was made from; empty for the plain view. */
function scanPlainText(text: string, inheritedIds: readonly Span[] = []): PiiFinding[] {
  const findings: PiiFinding[] = [];
  const add = (category: PiiCategory) => {
    if (!findings.some((f) => f.category === category)) {
      findings.push({ category, message: FRIENDLY_BY_CATEGORY[category] });
    }
  };

  const ssnView = ssnDetectionView(text);
  // What the UUID-exempt detectors read (see UUID_SHAPE for which they are).
  const noUuids = withoutExemptIds(text, inheritedIds);
  if (SSN_DASHED.test(text) || SSN_DASHED.test(ssnView) || SSN_MASKED.test(text) || SSN_LAST_FOUR.test(text)) add("ssn");
  else if (SSN_CONTEXT.test(text) && (BARE_9_DIGITS.test(text) || BARE_9_DIGITS.test(ssnView))) add("ssn");
  else if (hasBareValidSsnShape(noUuids)) add("ssn");

  if (
    BIRTH_CONTEXT.test(text) &&
    (DATE_NUMERIC.test(text) ||
      DATE_ISO.test(text) ||
      DATE_MONTH_DAY_YEAR.test(text) ||
      DATE_DAY_MONTH_YEAR.test(text) ||
      BARE_YEAR.test(text) ||
      DATE_COMPACT.test(text) ||
      SPELLED_OUT_DATE.test(text))
  ) {
    add("dob");
  }
  if (hasBirthPlausibleFullDate(text)) add("dob");

  if (PASSPORT_CONTEXT.test(text) && ALPHANUM_ID_TOKEN.test(text)) add("passport");

  if ((CASE_NUMBER_CONTEXT.test(text) && DIGIT_RUN_5PLUS.test(text)) || hasCaseIdShape(text, [...inheritedIds, ...uuidSpans(text)])) {
    add("case_number");
  }

  if (CLEARANCE_RECORD_CONTEXT.test(text)) add("clearance_record");
  if (ADJUDICATION_JARGON_TOKEN.test(text) && ADJUDICATION_VERB.test(text)) add("clearance_record");

  if (IMAGE_DATA_URI.test(text)) add("image_upload");
  else if (BINARY_DATA_URI.test(text) || LONG_BASE64_RUN.test(text)) add("binary_data");

  if (CREDIT_CARD_SHAPE.test(noUuids)) add("credit_card");

  if (
    CLASSIFICATION_MARKING.test(text) ||
    MARKING_BANNER.test(text) ||
    MARKING_ABBREVIATED.test(text) ||
    MARKING_PORTION.test(text) ||
    MARKING_ALLCAPS_PHRASE.test(text) ||
    MARKING_LEGEND.test(text) ||
    CONTROLLED_DATA_CONTENT.test(text)
  ) {
    add("classification_marking");
  }
  if (ADJUDICATION_HISTORY.test(text) || (text.match(RECORD_FIELD) ?? []).length >= 2) add("clearance_record");
  if (SENSITIVE_DISCLOSURE.test(text)) add("sensitive_disclosure");
  if (PERSONAL_NAME.test(text)) add("personal_name");
  if (SECRET_CREDENTIAL.test(text)) add("secret_credential");

  if (EMAIL_SHAPE.test(text) || (text.includes("@") && EMAIL_SPACED.test(text)) || (HAS_AT_TOKEN.test(text) && EMAIL_OBFUSCATED.test(text))) {
    add("email");
  }
  if (PHONE_FORMATTED.test(text) || (PHONE_CONTEXT.test(text) && PHONE_BARE.test(noUuids)) || hasIntlPhone(noUuids)) add("phone");

  if (
    (EDIPI_CONTEXT.test(text) && TEN_DIGITS.test(noUuids)) ||
    (A_NUMBER_CONTEXT.test(text) && A_NUMBER_SHAPE.test(noUuids)) ||
    (DRIVERS_LICENSE_CONTEXT.test(text) && DRIVERS_LICENSE_TOKEN.test(noUuids)) ||
    I94.test(text) ||
    DL_INLINE.test(text)
  ) {
    add("government_id");
  }
  if (USCIS_RECEIPT.test(text)) add("case_number");

  if (FULL_ADDRESS.test(text) || (ADDRESS_CONTEXT.test(text) && STREET_ADDRESS_RE.test(text)) || hasNameThenStreet(text)) add("address");

  return findings;
}

/** Invisible/zero-width characters sometimes spliced into a digit run to break
 *  a pattern match without changing how the text visually reads (e.g.
 *  "123​-45-6789"). Stripped before scanning — a red-team-found gap, see
 *  tests/unit/pii.test.ts. */
const INVISIBLE_CHARS = /[​‌‍⁠﻿­]/g;

/** Unicode dash/hyphen lookalikes that read identically to "-" but aren't in
 *  SSN_DASHED's `[-.\s]` character class, and — verified directly, not
 *  assumed — aren't folded to ASCII "-" by NFKC normalization either (NFKC
 *  DOES fold FULLWIDTH HYPHEN-MINUS U+FF0D, since that block exists purely
 *  for compatibility with ASCII/JIS; it does NOT fold general-punctuation
 *  dashes like U+2010/2011/2013/2014 or the math minus sign U+2212, which
 *  Unicode treats as semantically distinct from "-"). */
const DASH_LOOKALIKES = /[‐‑‒–—−]/g;

/** Normalizes text before any detector runs: NFKC folds full-width digits and
 *  FULLWIDTH HYPHEN-MINUS to standard ASCII; the two replace()s close the
 *  remaining gaps NFKC doesn't cover (verified empirically — see above). */
/** Zero code points of the decimal-digit blocks NFKC leaves alone (an SSN
 *  in Arabic-Indic digits once passed). Fullwidth/mathematical digits are
 *  already folded by NFKC. */
const DIGIT_ZEROS = [0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xaa50, 0xabf0];
function foldDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x39) return ch;
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9);
    return zero === undefined ? ch : String(cp - zero);
  });
}

/** Cyrillic/Greek letters that render identically to Latin ones (a
 *  homoglyph "SECRET//NOFORN" once passed). Detection-only view, never shown. */
const CONFUSABLES: Record<string, string> = {
  А: "A", В: "B", С: "C", Е: "E", Н: "H", І: "I", Ј: "J", К: "K", М: "M", О: "O", Р: "P", Ѕ: "S", Т: "T", Х: "X", У: "Y",
  а: "a", с: "c", е: "e", і: "i", ј: "j", о: "o", р: "p", ѕ: "s", х: "x", у: "y", ԁ: "d", ԛ: "q", ԝ: "w",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
  ο: "o", ν: "v", ρ: "p", ι: "i", κ: "k", τ: "t", υ: "u", χ: "x",
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

function normalizeForScan(text: string): string {
  return foldDigits(text.normalize("NFKC"))
    .replace(INVISIBLE_CHARS, "")
    .replace(DASH_LOOKALIKES, "-")
    .replace(CONFUSABLE_RE, (ch) => CONFUSABLES[ch]);
}

/** "&#53;36-22-8790" — decode numeric and the common named HTML
 *  entities as one more view of the text, like the URI-decode passes. */
function tryHtmlEntityDecode(text: string): string | null {
  if (!/&(?:#\d{1,7}|#x[0-9a-f]{1,6}|amp|lt|gt|quot|apos|nbsp);/i.test(text)) return null;
  return text
    .replace(/&#(\d{1,7});/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ");
}

/** Self-inverse: rot13(rot13(x)) === x. Digits/punctuation pass through
 *  unchanged, which is exactly why this is worth trying as its own pass — it
 *  specifically defeats "obfuscate just the trigger keyword" (e.g. "ssn" ->
 *  "ffa") while a bare digit run sails through untouched, which would
 *  otherwise slip past this guard's keyword-gated checks (SSN_CONTEXT +
 *  BARE_9_DIGITS, CASE_NUMBER_CONTEXT, etc). */
function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/** A run of well-formed percent escapes ("%31%32"). A "%" not followed by two
 *  hex digits is not part of one. */
const PERCENT_ESCAPES = /(?:%[0-9a-f]{2})+/gi;

/** One layer of percent-decoding, lenient the way Python's `unquote` is:
 *  each run of well-formed escapes is decoded as UTF-8 (bytes that are not
 *  valid UTF-8 become U+FFFD, never an error) and everything else, malformed
 *  escapes included, is left as it is. This used `decodeURIComponent`, which
 *  throws on the first malformed escape anywhere in the string, and the whole
 *  view was skipped: "my ssn is %31%32%33-%34%35-%36%37%38%39 %" passed.
 *  Returns null when decoding made no difference. */
function percentDecode(text: string): string | null {
  const decoded = text.replace(PERCENT_ESCAPES, (run) => Buffer.from(run.replace(/%/g, ""), "hex").toString("utf8"));
  return decoded === text ? null : decoded;
}

/** Bounds the percent-decode loop below — defeats double-encoding (verified:
 *  2 passes fully resolves a double-percent-encoded SSN) without looping
 *  unboundedly on adversarial input. */
const MAX_URI_DECODE_PASSES = 3;

/** A base64-alphabet run long enough to plausibly be an encoded short PII
 *  phrase, as distinct from LONG_BASE64_RUN's 200+-char "there's clearly some
 *  large blob in here" catch-all — this is specifically for a short phrase
 *  (e.g. "my ssn is 123-45-6789" is 28 chars of base64) hidden with no
 *  visible keyword and too short to trip that heuristic. */
const EMBEDDED_BASE64_TOKEN = /[A-Za-z0-9+/]{12,}={0,2}/g;

/** Decodes a candidate base64 token and returns its text ONLY when decoding
 *  is clearly correct and clearly plain text. Two checks, both load-bearing:
 *  (1) re-encoding the decoded bytes must reproduce the exact original token
 *  — Node's `Buffer.from(str, "base64")` silently tolerates non-base64 input,
 *  so without this round-trip check almost any alphanumeric run would
 *  "decode" to something; (2) the decoded bytes must be printable ASCII —
 *  real PII hidden this way is always a plain-text phrase, never binary.
 *  Verified empirically against realistic non-PII tokens (a role-id-shaped
 *  string, a GitHub-username-shaped string, a long run-on sentence with no
 *  spaces, a repeated-letter run, a plain digit run) — zero false decodes.
 *
 *  A character or three glued to the end of a real encoding made both checks
 *  fail, so the token was skipped, though Node's own decoder still reads it
 *  ("bXkgc3NuIGlzIDEyMy00NS02Nzg5x" passed). So when the
 *  token fails as it is, it is tried without its last one, two and three
 *  characters, each under the same two checks. Nothing here throws (Buffer
 *  never does on a string), so no error can skip the view silently. */
function tryBase64Decode(token: string): string | null {
  const core = token.replace(/=+$/, "");
  for (let drop = 0; drop <= 3; drop++) {
    const text = decodeExactBase64(core.slice(0, core.length - drop));
    if (text !== null) return text;
  }
  return null;
}

/** `core` (no padding) decoded, or null unless it round-trips exactly and
 *  decodes to at least 4 characters of printable ASCII. */
function decodeExactBase64(core: string): string | null {
  const buf = Buffer.from(core, "base64");
  if (buf.toString("base64").replace(/=+$/, "") !== core) return null;
  const text = buf.toString("utf8");
  if (text.length < 4 || !/^[\t\r\n\x20-\x7E]*$/.test(text)) return null;
  return text;
}

/**
 * The real entry point for scanning one string (scanValueForPiiCui below
 * calls this on every string it finds). Runs scanPlainText against the plain
 * text AND a small, fixed set of cheap, reversible transforms a motivated
 * user could type into an ordinary string field to hide PII from a naive
 * scan — there is no file upload or binary channel here, everything arrives
 * as JSON strings, so this is the actual threat surface. Each transform is
 * tried independently (not composed/chained with the others — that's an
 * unbounded rabbit hole, not a real product need) and every finding merges,
 * deduplicated by category:
 *  - Unicode normalization + invisible-character stripping + dash-lookalike
 *    folding (normalizeForScan), applied first, unconditionally.
 *  - ROT13 of the whole normalized text.
 *  - Percent-decoding, repeated to a fixed point (bounded). Lenient: a
 *    malformed escape is left as it is and never stops the rest decoding.
 *  - Any embedded base64-looking token, decoded and re-scanned.
 * Found via red-teaming — all four were confirmed live bypasses before
 * this fix; see tests/unit/pii.test.ts for the regression cases. Verified this doesn't introduce new false
 * positives against this file's existing "does NOT flag" corpus.
 *
 * A canonical UUID exempt in the plain view stays exempt in the views
 * derived from it. ROT13 is the one view that changes a UUID's own
 * characters: it turns the hex letters a-f into n-s, so the rotated text no
 * longer matches UUID_SHAPE, and about 1 random UUID in 100 had a digit run
 * read as an SSN or a card number there. ROT13 keeps every character in
 * place, so the UUIDs of the normalized text are passed to that view as
 * spans: the same detectors skip them, and every other detector reads the
 * rotated text exactly as before. The other views need nothing. Percent and
 * entity decoding change only `%XX` and `&…;` sequences, which a UUID does
 * not contain, so each view's own UUID_SHAPE still finds it (unless a `%` is
 * glued to its front: then its first two hex digits decode as an escape and
 * that view scans the result, which can only refuse more). A base64 token
 * inside a UUID is its 12-hex last group; it decodes to 9 bytes of which
 * every third cannot be a digit, so at most 6 digits, and every exempt shape
 * needs 7 or more.
 */
function scanTextForPiiCui(text: string): PiiFinding[] {
  const normalized = normalizeForScan(text);
  const findings = scanPlainText(normalized);
  const merge = (more: PiiFinding[]) => {
    for (const f of more) {
      if (!findings.some((existing) => existing.category === f.category)) findings.push(f);
    }
  };

  merge(scanPlainText(rot13(normalized), uuidSpans(normalized)));

  const entityDecoded = tryHtmlEntityDecode(normalized);
  if (entityDecoded !== null) merge(scanPlainText(normalizeForScan(entityDecoded)));

  // Each decoded layer is normalized like the input was (as the entity view
  // is): percent-encoded full-width digits ("%EF%BC%91…") decode to "１…",
  // which no detector reads until folded to ASCII.
  let current = normalized;
  for (let i = 0; i < MAX_URI_DECODE_PASSES; i++) {
    const decoded = percentDecode(current);
    if (decoded === null) break;
    current = normalizeForScan(decoded);
    merge(scanPlainText(current));
  }

  for (const token of normalized.match(EMBEDDED_BASE64_TOKEN) ?? []) {
    const decodedToken = tryBase64Decode(token);
    if (decodedToken) merge(scanPlainText(decodedToken));
  }

  return findings;
}

const MAX_SCAN_DEPTH = 8;

/** Recursively walks any JSON-ish value (tool inputs are plain objects/arrays/
 *  strings/numbers), scanning every string found. Depth-limited as a defensive
 *  bound, not an expected real-world case for our flat tool schemas. */
export function scanValueForPiiCui(value: unknown, depth = 0): PiiFinding[] {
  if (depth > MAX_SCAN_DEPTH) {
    // Fail CLOSED, not open — matches this module's own stated design
    // principle ("prefer a false positive... over a false negative"). A
    // structure nested deeper than we scan is exactly the ambiguous case
    // that principle is about; silently returning [] here (as this used to)
    // let a 9+-level-deep payload bypass the guard entirely (confirmed live
    // during red-teaming — see tests/unit/pii.test.ts). No
    // legitimate tool input (every schema here is flat objects/short arrays)
    // comes anywhere near this depth, so this never fires on real traffic.
    return [{ category: "unscannable_structure", message: FRIENDLY_BY_CATEGORY.unscannable_structure }];
  }
  if (typeof value === "string") return scanTextForPiiCui(value);
  if (Array.isArray(value)) {
    return value.flatMap((item) => scanValueForPiiCui(item, depth + 1));
  }
  if (value && typeof value === "object") {
    // Keys too: an SSN sent as a JSON key was once echoed back by zod's
    // "Unrecognized key" error.
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
      ...scanTextForPiiCui(k),
      ...scanValueForPiiCui(v, depth + 1),
    ]);
  }
  return [];
}

export class PiiCuiError extends Error {
  readonly findings: PiiFinding[];
  constructor(findings: PiiFinding[]) {
    super(buildFriendlyRejectionMessage(findings));
    this.name = "PiiCuiError";
    this.findings = findings;
  }
}

export function buildFriendlyRejectionMessage(findings: PiiFinding[]): string {
  if (findings.length === 0) return "";
  if (findings.length === 1) return findings[0].message;
  const bullets = findings.map((f) => `- ${f.message}`).join("\n");
  return `This request looks like it includes more than one kind of information cleared never accepts:\n${bullets}`;
}

/** Throws a PiiCuiError (deduplicated by category) if `value` contains anything
 *  that looks like PII/CUI. Call this on every tool's raw input before zod
 *  validation and before any other processing. */
export function assertNoPiiCui(value: unknown): void {
  const findings = scanValueForPiiCui(value);
  if (findings.length > 0) {
    throw new PiiCuiError(findings);
  }
}
