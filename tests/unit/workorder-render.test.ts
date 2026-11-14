/**
 * S1: the work order schema and its plain-text rendering, which starts every
 * pipeline result's text content ("Next: …", then the JSON).
 */
import { describe, expect, it } from "vitest";
import { renderResultText, renderWorkOrder } from "@/lib/workorder/render";
import { WorkOrderSchema, type WorkOrder } from "@/lib/workorder/schema";

const order: WorkOrder = {
  summary: "Application received",
  steps: [
    {
      who: "you_the_agent",
      do: "Tell the person they will get an email receipt",
      useYourTool: "none",
    },
    {
      who: "named_person",
      role: "security_officer",
      do: "Confirm the access class",
      url: "/org/0b9f2c1e-6a4d-4c35-9e8f-1f2a3b4c5d6e/requisitions",
    },
    {
      who: "you_the_agent",
      do: "Add the interview to the person's calendar",
      useYourTool: "calendar",
      bringBack: "nothing",
      thenCall: { tool: "get_updates", args: { limit: 5 } },
    },
  ],
  waitingOn: { who: "the hiring team", what: "a decision on the evidence", expectedBy: "2026-11-20" },
  pollAgain: "Call get_updates in 2 days or when the person asks",
};

describe("renderWorkOrder", () => {
  it("starts with 'Next:' and the summary, then numbers the steps", () => {
    const lines = renderWorkOrder(order).split("\n");
    expect(lines[0]).toBe("Next: Application received.");
    expect(lines[1]).toBe("1. You (the agent): Tell the person they will get an email receipt.");
    expect(lines[2]).toBe("2. The security officer (a named person): Confirm the access class. Open /org/0b9f2c1e-6a4d-4c35-9e8f-1f2a3b4c5d6e/requisitions");
    expect(lines[3]).toBe(
      '3. You (the agent): Add the interview to the person\'s calendar. Use your own calendar tool. Bring back: nothing. Then call get_updates with {"limit":5}.',
    );
  });

  it("ends with who it is waiting on and when to look again", () => {
    const lines = renderWorkOrder(order).split("\n");
    expect(lines.at(-2)).toBe("Waiting on the hiring team: a decision on the evidence, expected by 2026-11-20.");
    expect(lines.at(-1)).toBe("Call get_updates in 2 days or when the person asks.");
  });

  it("renders a work order with no steps as the summary alone", () => {
    expect(renderWorkOrder({ summary: "Nothing is waiting on you.", steps: [] })).toBe("Next: Nothing is waiting on you.");
  });

  it("refuses more than five steps", () => {
    const six: WorkOrder = { summary: "Too much", steps: Array.from({ length: 6 }, () => ({ who: "system" as const, do: "x" })) };
    expect(WorkOrderSchema.safeParse(six).success).toBe(false);
    expect(() => renderWorkOrder(six)).toThrow();
  });

  it("refuses an email address anywhere in a work order: the server sends mail to the other side itself", () => {
    const leaky: WorkOrder = { summary: "Ask them", steps: [{ who: "you_the_agent", do: "Email the recruiter at recruiter@example.test" }] };
    expect(WorkOrderSchema.safeParse(leaky).success).toBe(false);
    const inArgs: WorkOrder = { summary: "x", steps: [{ who: "you_the_agent", do: "x", thenCall: { tool: "t", args: { to: "someone@example.test" } } }] };
    expect(WorkOrderSchema.safeParse(inArgs).success).toBe(false);
  });

  it("refuses an unknown actor or agent tool", () => {
    expect(WorkOrderSchema.safeParse({ summary: "x", steps: [{ who: "robot", do: "x" }] }).success).toBe(false);
    expect(WorkOrderSchema.safeParse({ summary: "x", steps: [{ who: "system", do: "x", useYourTool: "fax" }] }).success).toBe(false);
  });
});

describe("renderResultText", () => {
  it("puts the rendered work order first, then the JSON", () => {
    const data = { applicationId: "0b9f2c1e-6a4d-4c35-9e8f-1f2a3b4c5d6e", workOrder: order, ignoredInputKeys: [] };
    const text = renderResultText(data);
    expect(text.startsWith("Next: Application received.\n1. ")).toBe(true);
    expect(text.endsWith(JSON.stringify(data, null, 2))).toBe(true);
  });

  it("is exactly today's text (the JSON alone) for a result without a work order, as public tools return", () => {
    const data = { roles: [], ignoredInputKeys: [] };
    expect(renderResultText(data)).toBe(JSON.stringify(data, null, 2));
  });
});
