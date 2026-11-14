/**
 * Heuristic section/bullet extraction from a public job posting's plain-text
 * description. Feeds build_trial_assessment, get_role_rubric, readiness_brief,
 * and run_job_preview — all of which need "what does this role actually
 * involve, in the posting's own words": every brief must be visibly derived
 * from the specific job posting's stated responsibilities, tools, and
 * deliverables — not a role-agnostic template.
 * Real postings (verified against a live Anduril posting during build) use
 * ALL-CAPS section headers followed by "- " bulleted lines, which this parses
 * defensively — if a posting doesn't follow that convention, sections come
 * back empty and callers fall back to the raw description text.
 */

export interface ExtractedSections {
  responsibilities: string[];
  qualifications: string[];
  /** Every bullet found, regardless of which section (or no section) it was under. */
  rawBullets: string[];
}

const RESPONSIBILITY_HEADER = /what you.?ll do|responsibilities|the role\b|about the (job|role)|day.to.day/i;
const QUALIFICATION_HEADER = /required qualifications|^qualifications$|requirements|what you.?ll need|who you are|minimum qualifications/i;
const MIN_BULLET_LENGTH = 10;
const MAX_HEADER_LENGTH = 60;

// A real Saronic posting used plain Title Case headers ("Responsibilities",
// "Qualifications," "Benefits," "Physical Demands") with no colon and no
// ALL-CAPS — this module's original header gate (isShoutCase or trailing
// colon) missed every one of them, silently emptying BOTH responsibilities
// and qualifications and forcing every caller's "if structured sections are
// empty, fall back to rawBullets" path to dump benefits/ADA boilerplate as
// if it were a skill or responsibility. A short, non-bulleted line that IS
// itself a recognized header phrase (not just mentions one in passing) is a
// real header regardless of capitalization style.
const BOILERPLATE_BULLET =
  /\b(?:health insurance|medical insurance|dental (?:and|&) vision|vision insurance|401\(?k\)?|retirement plan|stock options?|equity options?|paid time off|\bpto\b|parental leave|maternity leave|paternity leave|life insurance|disability insurance|competitive salary|free lunch|unlimited (?:free )?(?:drinks|snacks)|equal opportunity employer|reasonable accommodations?|lifting (?:and|&) carrying|manual dexterity|visual acuity|prolonged periods of (?:sitting|standing)|physical demands|(?:standing|sitting|walking),? (?:and|or) (?:standing|sitting|walking)|reaching,? bending|stooping|kneeling|crouching|office socials)\b/i;

// A header BOUNDARY (any section label, even one this module doesn't
// bucket by name, like "Benefits" or "Physical Demands") must be
// recognized as distinctly from WHICH bucket a recognized boundary maps
// to — found live (same panel finding as above): an earlier, narrower fix
// only recognized "Responsibilities"/"Qualifications" themselves as
// headers, so a later "Benefits"/"Physical Demands" label (real header
// text, just not one of the two categories this module tracks) was never
// treated as a boundary at all, never reset currentSection away from
// "qualifications," and let every bullet for the REST OF THE DOCUMENT get
// wrongly attributed to qualifications. A standalone short line with no
// bullet marker, no sentence-ending punctuation, and every word
// capitalized (Title Case) or ALL-CAPS is reliably a label, not a
// sentence, regardless of which specific section it names.
function looksLikeHeaderBoundary(line: string): boolean {
  if (line.length === 0 || line.length > MAX_HEADER_LENGTH) return false;
  if (/^[-•*]/.test(line)) return false;
  if (/:$/.test(line)) return true;
  if (/[.,;!?]$/.test(line)) return false; // a real sentence ends with punctuation; a label doesn't
  const words = line.split(/\s+/);
  if (words.length > 6) return false; // labels are short; a 7+ word line is prose
  const isShoutCase = line === line.toUpperCase() && /[A-Z]/.test(line);
  const minorWord = /^(?:and|or|of|the|in|for|to|&)$/i;
  const isTitleCase = words.every((w) => /^[A-Z]/.test(w) || minorWord.test(w));
  return isShoutCase || isTitleCase;
}

export function extractSections(descriptionText: string): ExtractedSections {
  const lines = descriptionText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let currentSection: "responsibilities" | "qualifications" | null = null;
  const responsibilities: string[] = [];
  const qualifications: string[] = [];
  const rawBullets: string[] = [];

  for (const line of lines) {
    if (looksLikeHeaderBoundary(line)) {
      if (RESPONSIBILITY_HEADER.test(line)) currentSection = "responsibilities";
      else if (QUALIFICATION_HEADER.test(line)) currentSection = "qualifications";
      else currentSection = null;
      continue;
    }
    const bulletMatch = /^[-•*]\s*(.+)/.exec(line);
    if (!bulletMatch) continue;
    const text = bulletMatch[1].trim().replace(/\s+/g, " ");
    if (text.length < MIN_BULLET_LENGTH) continue;
    // Defense in depth beyond the header-detection fix above: a bullet that
    // is unambiguously benefits/compensation/ADA-physical-demands content
    // is never a real skill or responsibility no matter which section (or
    // no section, under a header this module still fails to recognize) it
    // was found under — exclude it everywhere, not just from the
    // structured buckets, so a caller's rawBullets fallback stays safe too.
    if (BOILERPLATE_BULLET.test(text)) continue;
    rawBullets.push(text);
    if (currentSection === "responsibilities") responsibilities.push(text);
    else if (currentSection === "qualifications") qualifications.push(text);
  }

  return { responsibilities, qualifications, rawBullets };
}

/** Eligibility, credential, and logistics lines — real requirements, but not
 *  job CONTENT. Interview questions and trial rubrics used to be built from
 *  them ("Tell me about a time your work connected to: 'Must be a U.S.
 *  citizen…'", a rubric criterion "Addresses: 'Eligible to obtain… Top Secret
 *  clearance'"), and the skills rubric listed a clearance line as a skill. Eligibility is covered by
 *  get_role_rubric's eligibility checklist, never by questions or tasks —
 *  and an interviewer shouldn't probe citizenship as "experience". */
const NON_CONTENT_BULLET =
  /\b(?:citizen(?:ship)?|u\.?s\.? person|green card|permanent resident|security clearance|clearance|top secret|ts\/sci|\bsecret\b|polygraph|itar|export[- ]control\w*|eligib\w*|background (?:check|investigation)|drug (?:test|screen)|authorized to work|work authorization|visa|sponsorship|bachelor'?s|master'?s|ph\.?d|doctorate|b\.s\.|m\.s\.|\bbs\b|\bms\b|degree|gpa|travel up to|willing(?:ness)? to (?:travel|relocate)|relocat\w*|on-?site \d|in-office|lift(?:ing)? up to|\d+\s*lbs?\b|shift work|weekends?)\b/i;

/** Attendance and location lines: where and how often someone works, not
 *  what the work is. NON_CONTENT_BULLET only
 *  caught "in-office" (hyphenated) and "on-site <digit>", so "full-time in
 *  office presence (40 hours/week)", "Must be able to work onsite in El
 *  Segundo five days a week", "This role is 100% on-site" and "Hybrid: 3 days
 *  per week in our Austin office" reached the skills rubric, the readiness
 *  brief's focus areas and the interview guide's questions.
 *
 *  Every pattern needs an attendance shape (a days-or-hours-per-week count,
 *  "100%"/"fully" + a work mode, "must/able to work" + a place, "this role
 *  is" + a mode, a "Location:" label), never a bare word: "Support on-site
 *  integration at customer facilities", "Coordinate with the program office",
 *  "Experience with hybrid propulsion" and "Proficiency in Office 365" are job
 *  content and stay. */
const WORK_MODE = String.raw`(?:on-?site|on site|in[- ]office|in (?:the |our |an? )?office|in[- ]person|remote(?:ly)?|hybrid)`;
const PLACE = String.raw`(?:office|facility|facilities|headquarters|hq|campus|site|plant|factory|location)`;
const NUMBER_WORD = String.raw`(?:\d+|one|two|three|four|five|six|seven)`;
const ATTENDANCE_OR_LOCATION: RegExp[] = [
  // "five days a week", "3 days per week", "4 days/week", "3-4 days a week"
  new RegExp(String.raw`\b${NUMBER_WORD}\+?\s*(?:(?:-|–|to|or)\s*${NUMBER_WORD}\s*)?days?\s*(?:a|per|\/|each|of the)\s*(?:work\s*)?week\b`, "i"),
  // "(40 hours/week)", "40+ hours per week"
  /\b\d+\+?\s*(?:hours?|hrs?)\s*(?:a|per|\/)\s*(?:week|wk)\b/i,
  // "100% on-site", "fully remote", "full-time in office presence" — only when
  // the mode ends the phrase or names the arrangement ("fully remote teams"
  // is a skill line about teams, and stays).
  new RegExp(
    String.raw`(?:100\s*%|\b(?:fully|full[- ]time|entirely|exclusively|primarily|predominantly|mostly))\s+(?:an?\s+)?${WORK_MODE}(?=\s*$|\s*[.,;:()!—–-]|\s+(?:role|position|job|presence|attendance|work|working|schedule|basis|environment|in|at|from|and|with(?:in)?|five|\d)\b)`,
    "i",
  ),
  // "This role is 100% on-site", "The position is based in Hawthorne", "This is an onsite role"
  new RegExp(
    String.raw`\b(?:this|the)\s+(?:role|position|job|opportunity)\s+(?:is|will be|requires)\s+(?:an?\s+)?(?:\d+\s*%\s+|fully\s+|primarily\s+)?(?:${WORK_MODE}|based|located)\b`,
    "i",
  ),
  new RegExp(String.raw`\b(?:this|it)\s+is\s+(?:an?\s+)?(?:\d+\s*%\s+|fully\s+)?${WORK_MODE}\s+(?:role|position|job|opportunity)\b`, "i"),
  // "Must be able to work onsite in El Segundo", "Ability to report to our Torrance facility"
  new RegExp(
    String.raw`\b(?:must|able to|ability to|required to|expected to|willing(?:ness)? to|need to)\s+(?:be\s+(?:able|willing)\s+to\s+)?(?:work|be|report|commute|come|reside|live)\s+(?:\w+\s+){0,2}?(?:${WORK_MODE}|(?:to|at|from|in)\s+(?:the|our)\s+(?:[\w.,'&-]+\s+){0,4}?${PLACE}|within commuting|locally|local to)`,
    "i",
  ),
  // "office presence", "on-site attendance", "in-person requirement"
  /\b(?:office|on-?site|in[- ]person|in[- ]office)\s+(?:presence|attendance|requirements?|schedule|policy|expectations?)\b/i,
  // "Hybrid: 3 days…", "Hybrid (2 days remote)", "hybrid work schedule" — not "Hybrid-electric powertrains" or "hybrid propulsion"
  /^hybrid(?:\s*[:(–—,]|\s+-\s|\s*$|\s+(?:role|schedule|position|work|model|arrangement)\b)/i,
  /\bhybrid\s+(?:work(?:ing)?\s+)?(?:schedule|role|position|model|arrangement|policy)\b/i,
  // "Onsite - Costa Mesa", "Remote (US only)", "In-person, Seattle"
  new RegExp(String.raw`^${WORK_MODE}(?:\s*[:(–—,]|\s+-\s|\s*$)`, "i"),
  // "Location: Long Beach, CA", "Work schedule: Monday–Friday"
  /^(?:(?:work\s+)?location|workplace|work arrangement|work schedule|schedule)\s*[:–—-]/i,
  /\bmonday\s*(?:-|–|—|through|thru|to)\s*friday\b/i,
  // "Work from our Long Beach office", "based out of our Austin facility"
  new RegExp(
    String.raw`\b(?:work(?:ing)?\s+(?:from|out of)|based\s+(?:in|at|out of)|located\s+(?:in|at))\s+(?:the|our)\s+(?:[\w.,'&-]+\s+){0,4}?${PLACE}\b`,
    "i",
  ),
  // "World-class Playa Vista office: …" (a perk or location label, seen live 2026-11-13)
  /^(?:[\w-]+\s+){0,3}office\s*:/i,
  // "within commuting distance of Huntsville", "live within 50 miles"
  /\bcommut(?:e|ing|able)\s+(?:distance|range|to)\b|\breside\s+(?:with)?in\b|\bwithin\s+\d+\s*(?:miles?|mi|km)\b/i,
];

export function isAttendanceOrLocationLine(text: string): boolean {
  return ATTENDANCE_OR_LOCATION.some((pattern) => pattern.test(text));
}

export function isJobContentBullet(text: string): boolean {
  return !NON_CONTENT_BULLET.test(text) && !BOILERPLATE_BULLET.test(text) && !isAttendanceOrLocationLine(text);
}

