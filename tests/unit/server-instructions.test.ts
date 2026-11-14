import { describe, it, expect } from "vitest";
import { SERVER_INSTRUCTIONS } from "@/lib/server-instructions";

// The server `instructions` once narrowed the scope to "a16z speedrun
// companies"; the roles are the Talent Network's defense and space postings.
describe("server instructions", () => {
  it("names the true scope: defense and space roles from the a16z speedrun Talent Network", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/defense and space roles from the a16z speedrun Talent Network/);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/at a16z speedrun companies/);
    expect(SERVER_INSTRUCTIONS).not.toMatch(/those startups/);
  });

  it("still says nothing here scores or ranks people (true until ranking ships)", () => {
    expect(SERVER_INSTRUCTIONS).toContain("Nothing here scores or ranks people.");
  });

  it("tells the agent about ignoredInputKeys", () => {
    expect(SERVER_INSTRUCTIONS).toMatch(/ignoredInputKeys/);
  });

  it("stays a reasonable size for clients that show it in a system prompt", () => {
    expect(SERVER_INSTRUCTIONS.length).toBeLessThan(1600);
  });
});
