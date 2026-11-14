/** One record_step step type. */
import type { z } from "zod";
import type { RecordStepSchema } from "@/lib/tools/pipeline/record-step";

export type RecordStep = z.infer<typeof RecordStepSchema>;
export type StepOf<T extends RecordStep["type"]> = Extract<RecordStep, { type: T }>;
