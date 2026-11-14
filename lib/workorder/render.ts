/**
 * Renders a work order as the plain text that starts every pipeline result's
 * text content ("Next: …", then the JSON: tool output is the one channel
 * agents are documented to read).
 */
import { WorkOrderSchema, type WorkOrder, type WorkOrderStep } from "@/lib/workorder/schema";

const WHO_LABEL: Record<WorkOrderStep["who"], string> = {
  you_the_agent: "You (the agent)",
  the_person: "The person you are helping",
  named_person: "A named person",
  other_side: "The other side",
  system: "cleared",
};

const TOOL_PHRASE: Record<NonNullable<WorkOrderStep["useYourTool"]>, string> = {
  none: "",
  email: "Use your own email tool.",
  calendar: "Use your own calendar tool.",
  browser: "Use your own browser.",
  esign: "Use the e-signature tool the person already uses.",
  files: "Use your own file tools.",
};

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function whoLabel(step: WorkOrderStep): string {
  if (step.who === "named_person") return step.role ? `The ${step.role.replace(/_/g, " ")} (a named person)` : WHO_LABEL.named_person;
  return WHO_LABEL[step.who];
}

export function renderStep(step: WorkOrderStep, n: number): string {
  const parts = [`${n}. ${whoLabel(step)}: ${sentence(step.do)}`];
  if (step.useYourTool && TOOL_PHRASE[step.useYourTool]) parts.push(TOOL_PHRASE[step.useYourTool]);
  if (step.url) parts.push(`Open ${step.url}`);
  if (step.bringBack) parts.push(sentence(`Bring back: ${step.bringBack}`));
  if (step.thenCall) parts.push(`Then call ${step.thenCall.tool} with ${JSON.stringify(step.thenCall.args)}.`);
  return parts.join(" ");
}

/** The work order as text. Throws if it is not a valid work order (for example, more than five steps). */
export function renderWorkOrder(input: WorkOrder): string {
  const wo = WorkOrderSchema.parse(input);
  const lines = [`Next: ${sentence(wo.summary)}`];
  wo.steps.forEach((step, i) => lines.push(renderStep(step, i + 1)));
  if (wo.waitingOn) {
    const by = wo.waitingOn.expectedBy ? `, expected by ${wo.waitingOn.expectedBy}` : "";
    lines.push(`Waiting on ${wo.waitingOn.who}: ${wo.waitingOn.what}${by}.`);
  }
  if (wo.pollAgain) lines.push(sentence(wo.pollAgain));
  return lines.join("\n");
}

/**
 * The text content of a tool result: the rendered work order first, when the
 * result has one, then the JSON. Without a work order this is exactly
 * today's text (the JSON alone), so public tools are unaffected.
 */
export function renderResultText(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  const wo = data && typeof data === "object" ? (data as { workOrder?: unknown }).workOrder : undefined;
  if (!wo) return json;
  const parsed = WorkOrderSchema.safeParse(wo);
  return parsed.success ? `${renderWorkOrder(parsed.data)}\n\n${json}` : json;
}
