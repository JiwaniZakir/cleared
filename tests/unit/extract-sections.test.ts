import { describe, it, expect } from "vitest";
import { extractSections, isJobContentBullet } from "@/lib/speedrun/extract-sections";

describe("extractSections", () => {
  it("extracts bullets under a responsibilities-like header", () => {
    const text = "WHAT YOU'LL DO\n\n- Build the thing.\n- Ship the thing.\n\nQUALIFICATIONS\n\n- Know Python.";
    const result = extractSections(text);
    expect(result.responsibilities).toEqual(["Build the thing.", "Ship the thing."]);
    expect(result.qualifications).toEqual(["Know Python."]);
  });

  it("falls back to rawBullets when no recognizable header is present", () => {
    const text = "- A bullet with no header above it that is long enough.";
    const result = extractSections(text);
    expect(result.responsibilities).toEqual([]);
    expect(result.rawBullets).toEqual(["A bullet with no header above it that is long enough."]);
  });

  it("ignores stray short fragments that aren't real bullets", () => {
    const text = "WHAT YOU'LL DO\n\n- ok\n- A properly long responsibility bullet line.";
    const result = extractSections(text);
    expect(result.responsibilities).toEqual(["A properly long responsibility bullet line."]);
  });

  it("returns empty arrays for a posting with no bullets at all", () => {
    const result = extractSections("Just a paragraph of prose with no bullets whatsoever.");
    expect(result.responsibilities).toEqual([]);
    expect(result.qualifications).toEqual([]);
    expect(result.rawBullets).toEqual([]);
  });

  // Regression: a real Saronic posting used plain Title Case headers
  // ("Responsibilities", "Qualifications", "Benefits", "Physical Demands") with
  // no colon and no ALL-CAPS. The original gate missed all of them, and even
  // after recognizing "Responsibilities"/"Qualifications" as headers, an
  // unrecognized "Benefits" header never reset currentSection, so every bullet
  // for the rest of the document (including ADA physical-demands text) got
  // wrongly attributed to "qualifications."
  it("recognizes plain Title Case headers (no colon, no ALL-CAPS), not just the original ALL-CAPS/colon convention", () => {
    const text = "Responsibilities\n\n- Ship real features to production.\n\nQualifications\n\n- Five years of backend experience.";
    const result = extractSections(text);
    expect(result.responsibilities).toEqual(["Ship real features to production."]);
    expect(result.qualifications).toEqual(["Five years of backend experience."]);
  });

  it("resets the current section on an unrecognized-but-still-a-header label (Benefits), instead of letting qualifications bleed into every later section", () => {
    const text =
      "Qualifications\n\n- Five years of backend experience.\n\nBenefits\n\n- Comprehensive health insurance plans.\n\nPhysical Demands\n\n- Occasional standing and walking within the office.";
    const result = extractSections(text);
    expect(result.qualifications).toEqual(["Five years of backend experience."]);
    // Neither the benefits bullet nor the physical-demands bullet should
    // have leaked into qualifications, AND the benefits bullet specifically
    // should be filtered out of rawBullets entirely (defense in depth).
    expect(result.rawBullets).not.toContain("Comprehensive health insurance plans.");
  });

  it("filters obvious benefits/compensation/ADA-physical-demands boilerplate out of rawBullets even with no section structure at all", () => {
    const text = [
      "- A properly long responsibility bullet line that is real content.",
      "- Medical Insurance: Comprehensive health insurance plans covering a range of services",
      "- Retirement Plan: 401(k) plan",
      "- Stock Options: Equity options to give employees a stake in the company's success",
      "- Lifting and carrying items up to 20 pounds occasionally (e.g., office supplies, packages).",
      "- Manual dexterity to operate a computer keyboard, mouse, and other office equipment.",
    ].join("\n");
    const result = extractSections(text);
    expect(result.rawBullets).toEqual(["A properly long responsibility bullet line that is real content."]);
  });
});

// The earlier eligibility filter caught "in-office" and "on-site <digit>" only,
// so attendance and location lines reached the skills rubric, the readiness
// brief and the interview guide.
describe("isJobContentBullet: attendance and location lines are not job content", () => {
  // The four lines found passing, verbatim.
  const r11Examples = [
    "full-time in office presence (40 hours/week)",
    "Must be able to work onsite in El Segundo five days a week",
    "This role is 100% on-site",
    "Hybrid: 3 days per week in our Austin office",
  ];
  // Seen in live defense postings on 2026-11-13 (Talent Network detail pages).
  const liveExamples = [
    "Ability to work onsite in Costa Mesa, CA",
    "Willing to work on-site daily across warehouse and manufacturing locations in Orange County, with occasional travel to supplier and contract manufacturer sites",
    "Ability to work onsite five days a week at either our Reston, VA office or our HQ in Costa Mesa, CA.",
    "Note that this role is based in our headquarters in Costa Mesa, CA. Please apply only if you are already living near there, or are open to a paid relocation to Orange County, CA.",
    "World-class Playa Vista office: With the benefit of in-person collaboration with amazing coworkers and flexibility to integrate work and life",
  ];
  const nearVariants = [
    "In-office 5 days/week in Hawthorne, CA",
    "Onsite 4 days a week",
    "On-site 3-4 days per week",
    "This position is fully on-site at our Costa Mesa facility",
    "Work from our Long Beach office Monday through Friday",
    "Must be able to commute to our Torrance facility",
    "This is an in-person role based in Seattle, WA",
    "Hybrid (2 days remote)",
    "Hybrid work schedule with 3 days in office",
    "Fully remote, US only",
    "Remote (US only)",
    "100% remote role",
    "Must reside within commuting distance of Huntsville, AL",
    "Candidates must live within 50 miles of Huntsville",
    "Must work in the office at least 4 days per week",
    "Office presence required 5 days a week",
    "Expected to be in the office four days a week",
    "This role requires full-time onsite presence",
    "Location: Long Beach, CA",
    "This role is based in Hawthorne, CA",
    "Onsite - Costa Mesa, CA",
    "40+ hours per week, including occasional evenings",
  ];
  it.each([...r11Examples, ...liveExamples, ...nearVariants])("filters %j", (line) => {
    expect(isJobContentBullet(line)).toBe(false);
  });

  // Genuine skill or task lines that merely mention a site, an office, remote
  // work, or "hybrid" — they stay. The first eight were seen live 2026-11-13.
  const counterExamples = [
    "Engage suppliers and contract manufacturers directly, including on-site visits, to drive readiness before material ships",
    "Lead network integration for acquired companies, including on-site assessments of acquired environments, sequenced integration plans, network cutovers and a reusable integration playbook.",
    "Manage secure remote access, including site-to-site and client-based VPN connectivity.",
    "Experience supporting networks in hybrid or cloud environments, such as AWS/AWS GovCloud or Azure.",
    "Own the infrastructure roadmap across on-premises data centers, colocation, edge and hybrid cloud, including capacity planning, lifecycle management and modernization.",
    "Serve as the remote technical authority during live operations — triage autonomy, networking, and HW/SW faults from the JOC and direct afloat and shoreside teams to resolution under time pressure",
    "Proficiency in Microsoft Office Suite.",
    "Experience leading and developing teams of 15+ across multiple locations; ability to hire, coach, and set performance standards.",
    "Support on-site integration and test of vehicles at customer facilities",
    "Lead site acceptance testing for new ground stations",
    "Coordinate with the program office on contract deliverables",
    "Partner with our Austin office's manufacturing team to scale production",
    "Experience with hybrid propulsion systems",
    "Hybrid-electric powertrain design experience",
    "Build remote monitoring and diagnostics for fielded systems",
    "Remote sensing payload data processing experience",
    "Proficiency in Office 365 and Excel",
    "Experience leading fully remote engineering teams",
    "Design hybrid cloud architecture for mission systems",
    "Plan facility layouts for a new production site",
    "Collaborate with remote teams across time zones",
  ];
  it.each(counterExamples)("keeps %j", (line) => {
    expect(isJobContentBullet(line)).toBe(true);
  });

  it("physical-demand boilerplate seen live is dropped from rawBullets too", () => {
    const result = extractSections(
      "- Occasional standing and walking within the office\n- Occasional reaching, bending, or stooping to access file drawers, cabinets, or office supplies\n- Design and build real-time flight software in C++",
    );
    expect(result.rawBullets).toEqual(["Design and build real-time flight software in C++"]);
  });
});
