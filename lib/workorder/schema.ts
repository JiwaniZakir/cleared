/**
 * The work order: the plain next-step block every pipeline result ends with. It says what to do
 * next, with which of the agent's own tools, what to bring back, and which
 * tool to call. At most five steps (one or two external actions per order
 * is the aim).
 *
 * Steps never carry another person's contact details: where an email must go
 * to the other side, the server sends it. The schema refuses an email
 * address anywhere in a work order.
 */
import { z } from "zod";

export const WORK_ORDER_WHO = ["you_the_agent", "the_person", "named_person", "other_side", "system"] as const;
export const WORK_ORDER_TOOLS = ["none", "email", "calendar", "browser", "esign", "files"] as const;

export const WorkOrderStepSchema = z.object({
  who: z.enum(WORK_ORDER_WHO),
  /** e.g. "decider", for named_person */
  role: z.string().optional(),
  /** plain instruction */
  do: z.string(),
  useYourTool: z.enum(WORK_ORDER_TOOLS).optional(),
  /** what to return to this server, if anything */
  bringBack: z.string().optional(),
  thenCall: z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) }).optional(),
  /** e.g. a confirmation page */
  url: z.string().optional(),
});

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

export const WorkOrderSchema = z
  .object({
    /** one line: where things stand */
    summary: z.string(),
    steps: z.array(WorkOrderStepSchema).max(5),
    waitingOn: z.object({ who: z.string(), what: z.string(), expectedBy: z.string().optional() }).optional(),
    /** e.g. "call get_updates after 2026-11-20" */
    pollAgain: z.string().optional(),
  })
  .superRefine((wo, ctx) => {
    if (stringsIn(wo).some((s) => EMAIL_IN_TEXT.test(s))) {
      ctx.addIssue({
        code: "custom",
        message: "A work order never carries an email address; the server sends mail to the other side itself.",
      });
    }
  });

export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type WorkOrderStep = z.infer<typeof WorkOrderStepSchema>;
