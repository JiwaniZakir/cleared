/**
 * The one place that says which parts of the recruiting pipeline are live.
 *
 * The recruiter guide (/docs/recruiter) describes the product as designed.
 * Each part names the build slice that delivers it (data/pipeline-steps.json
 * `slices`; the slices are listed in docs/roadmap.mdx). Until a slice is listed here, the
 * guide marks that part "Not built yet". When a slice lands, add its id;
 * when every slice is listed, no note shows. Nothing else needs editing.
 */
export const BUILT_SLICES: ReadonlySet<string> = new Set<string>([
  // S15a: the explain_rule pre-employment topics, this guide, and the
  // anonymous pool without citizenship status.
  "S15a",
]);

export function isBuilt(slices: readonly string[]): boolean {
  return slices.every((slice) => BUILT_SLICES.has(slice));
}

export const NOT_BUILT_LABEL = "Not built yet";

export const NOT_BUILT_BANNER =
  "Most of what this guide says cleared does is designed but not built yet. Parts marked “Not built yet” describe the design, not something you can use today. What works today: the public tools (role search, role rubrics, explain_rule, timelines, trial briefs, interview guides) with no sign-in.";
