import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/speedrun/client", () => ({ getJob: vi.fn() }));
import { getJob } from "@/lib/speedrun/client";
import { getRoleRubricTool } from "@/lib/tools/get-role-rubric";
import { readinessBriefTool } from "@/lib/tools/readiness-brief";
import { generateInterviewGuideTool } from "@/lib/tools/generate-interview-guide";
import { buildTrialAssessmentTool } from "@/lib/tools/build-trial-assessment";

// Live, the same attendance line reached get_role_rubric's skills,
// readiness_brief's focus areas and generate_interview_guide's questions. The
// four lines below are real ones that got through.
const ATTENDANCE_LINES = [
  "full-time in office presence (40 hours/week)",
  "Must be able to work onsite in El Segundo five days a week",
  "This role is 100% on-site",
  "Hybrid: 3 days per week in our Austin office",
];

const DESCRIPTION = `
WHAT YOU'LL DO

- Design and build real-time flight software in C++
- Integrate new sensors with the autonomy stack
- Support on-site integration and test of vehicles at customer facilities

REQUIRED QUALIFICATIONS

${ATTENDANCE_LINES.map((l) => `- ${l}`).join("\n")}
- Experience with embedded Linux and RTOS
- Strong C++ skills and comfort with hardware-in-the-loop testing
`;

function mockJob() {
  vi.mocked(getJob).mockResolvedValueOnce({
    job: {
      id: "job-1", title: "Flight Software Engineer", company: "Acme Defense", company_slug: "acme-defense",
      company_url: "https://x", url: "https://speedrun-talent-network.com/jobs/job-1", location: "El Segundo, CA",
      remote: false, function: "engineering", seniority: "mid", comp_min: null, comp_max: null, comp_currency: null,
      comp_period: null, published_at: "2026-01-01T00:00:00Z", stealth: false, tier: "a16z", status: "open",
      apply: null, description_text: DESCRIPTION, labels: {},
    },
  });
}

function expectNoAttendanceLine(texts: string[]) {
  for (const line of ATTENDANCE_LINES) {
    expect(texts.some((t) => t.includes(line)), `"${line}" leaked into: ${JSON.stringify(texts)}`).toBe(false);
  }
}

describe("attendance and location lines never reach job-content outputs", () => {
  it("get_role_rubric skillsRubric", async () => {
    mockJob();
    const result = await getRoleRubricTool.handler({ role_id: "job-1" });
    const skills = result.skillsRubric.map((s) => s.skill);
    expectNoAttendanceLine(skills);
    expect(skills).toContain("Experience with embedded Linux and RTOS");
  });

  it("readiness_brief suggestedFocusAreas", async () => {
    mockJob();
    const result = await readinessBriefTool.handler({ role_id: "job-1" });
    const areas = result.template.twoWeekPrepPlan.suggestedFocusAreas;
    expectNoAttendanceLine(areas);
    expect(areas).toContain("Experience with embedded Linux and RTOS");
  });

  it("generate_interview_guide questions", async () => {
    mockJob();
    const result = await generateInterviewGuideTool.handler({ role_id: "job-1", minutes: 60 });
    expectNoAttendanceLine(result.questions.flatMap((q) => [q.question, q.tracedToQuote]));
    // A genuine task line that mentions a site stays interview material.
    expect(result.questions.map((q) => q.tracedToQuote)).toContain(
      "Support on-site integration and test of vehicles at customer facilities",
    );
  });

  it("build_trial_assessment rubric and brief", async () => {
    mockJob();
    const result = await buildTrialAssessmentTool.handler({ role_id: "job-1", minutes: 180 });
    expectNoAttendanceLine([result.brief, ...result.rubric.map((r) => r.tracedToQuote)]);
  });
});
