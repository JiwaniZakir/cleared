import { z } from "zod";
import stepsJson from "@/data/pipeline-steps.json";

/**
 * The 38 steps from requisition to day one, as data: who may do each, the
 * named role, the record it produces, the law behind it, the matching
 * explain_rule topic, and what cleared does as designed. Validated at
 * import, like lib/rules-data.ts. The recruiter guide (/docs/recruiter) is
 * generated from it; the designed get_application tool would also build
 * `PipelineStep` from it.
 *
 * Kept outside lib/pipeline/ on purpose: that folder is the service layer;
 * this is reference data any page or tool may read.
 */

export const STEP_CLASSES = ["AGENT", "PREP+SIGN", "NAMED ROLE", "GOV ONLY"] as const;
export type StepClass = (typeof STEP_CLASSES)[number];

/** The designed member roles, plus the candidate. */
export const PRODUCT_ROLES = ["admin", "recruiter", "decider", "interviewer", "security_officer", "export_lead", "candidate"] as const;

/** Build slice ids (S1–S16; see docs/roadmap.mdx). */
const SliceSchema = z.string().regex(/^S\d{1,2}[ab]?$/);

const BasisSchema = z.strictObject({ source: z.string(), cite: z.string().min(1) });

const StepSchema = z.strictObject({
  n: z.number().int().min(1).max(38),
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  stage: z.string(),
  title: z.string().min(3),
  detail: z.string().min(20),
  class: z.enum(STEP_CLASSES),
  r12Class: z.string(),
  whoMustAct: z.string(),
  namedRole: z.string().nullable(),
  productRoles: z.array(z.enum(PRODUCT_ROLES)),
  whyPerson: z.string().nullable(),
  record: z.string().min(3),
  basis: z.array(BasisSchema),
  basisNote: z.string().nullable(),
  ruleTopic: z.string().nullable(),
  productDoes: z.string().min(3),
  slices: z.array(SliceSchema),
  r12Step: z.string(),
});
export type PipelineStepEntry = z.infer<typeof StepSchema>;

const StageSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  whatHappens: z.string(),
  appliesTo: z.string(),
  firstStep: z.number().int(),
  lastStep: z.number().int(),
});
export type PipelineStage = z.infer<typeof StageSchema>;

const GateSchema = z.strictObject({
  id: z.string(),
  rule: z.string(),
  notBefore: z.number().int().nullable(),
  steps: z.array(z.number().int().min(1).max(38)).min(1),
  basis: z.array(BasisSchema),
  slices: z.array(SliceSchema).min(1),
});
export type PipelineGate = z.infer<typeof GateSchema>;

const SourceSchema = z.strictObject({
  title: z.string(),
  url: z.url(),
  checked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type PipelineSource = z.infer<typeof SourceSchema>;

/** A legal or product term, defined before the guide first uses it. */
const TermSchema = z.strictObject({ term: z.string(), means: z.string(), source: z.string().nullable() });
export type PipelineTerm = z.infer<typeof TermSchema>;

const FileSchema = z.strictObject({
  about: z.string(),
  checked: z.string(),
  classes: z.array(z.strictObject({ id: z.enum(STEP_CLASSES), label: z.string(), means: z.string() })).length(4),
  whyPerson: z.record(z.string(), z.string()),
  terms: z.array(TermSchema).min(1),
  stages: z.array(StageSchema).min(1),
  sources: z.record(z.string(), SourceSchema),
  steps: z.array(StepSchema).length(38),
  gates: z.array(GateSchema).min(1),
});

const parsed = FileSchema.parse(stepsJson);

export const PIPELINE_STEPS: PipelineStepEntry[] = parsed.steps;
export const PIPELINE_STAGES: PipelineStage[] = parsed.stages;
export const PIPELINE_GATES: PipelineGate[] = parsed.gates;
export const PIPELINE_SOURCES: Record<string, PipelineSource> = parsed.sources;
export const STEP_CLASS_INFO = parsed.classes;
export const WHY_PERSON: Record<string, string> = parsed.whyPerson;
export const PIPELINE_TERMS: PipelineTerm[] = parsed.terms;
export const PIPELINE_STEPS_CHECKED: string = parsed.checked;

export function stepsInStage(stageId: string): PipelineStepEntry[] {
  return PIPELINE_STEPS.filter((s) => s.stage === stageId);
}
