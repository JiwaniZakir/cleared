/**
 * The twelve pipeline tools, in the design's order.
 * Slice S1 created each as a disabled stub; each later slice sets its own
 * tool's `enabled` and nothing here changes. lib/tools/registry.ts appends
 * the enabled ones, so a disabled tool is on neither transport.
 */
import type { AnyToolDef } from "@/lib/tools/pipeline/shared";
import { getUpdatesTool } from "@/lib/tools/pipeline/get-updates";
import { getApplicationTool } from "@/lib/tools/pipeline/get-application";
import { getApplicationFormTool } from "@/lib/tools/pipeline/get-application-form";
import { submitApplicationTool } from "@/lib/tools/pipeline/submit-application";
import { respondToRequestTool } from "@/lib/tools/pipeline/respond-to-request";
import { updateMyApplicationTool } from "@/lib/tools/pipeline/update-my-application";
import { setUpRoleTool } from "@/lib/tools/pipeline/set-up-role";
import { rankCandidatesTool } from "@/lib/tools/pipeline/rank-candidates";
import { recordAssessmentTool } from "@/lib/tools/pipeline/record-assessment";
import { sendRequestTool } from "@/lib/tools/pipeline/send-request";
import { proposeDecisionTool } from "@/lib/tools/pipeline/propose-decision";
import { recordStepTool } from "@/lib/tools/pipeline/record-step";

export const PIPELINE_TOOLS: readonly AnyToolDef[] = [
  getUpdatesTool,
  getApplicationTool,
  getApplicationFormTool,
  submitApplicationTool,
  respondToRequestTool,
  updateMyApplicationTool,
  setUpRoleTool,
  rankCandidatesTool,
  recordAssessmentTool,
  sendRequestTool,
  proposeDecisionTool,
  recordStepTool,
];

export function enabledPipelineTools(): AnyToolDef[] {
  return PIPELINE_TOOLS.filter((t) => t.enabled !== false);
}
