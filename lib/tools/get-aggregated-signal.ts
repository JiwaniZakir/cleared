import { z } from "zod";
import { resolveRole, SPEEDRUN_SOURCE, RoleIdSchema, CompanySlugSchema } from "@/lib/tools/role-shared";
import { getCompany } from "@/lib/speedrun/client";
import {
  getSignalStore,
  getReleasedAggregate,
  MIN_CONTRIBUTORS,
  RELEASE_STEP,
  PERCENT_STEP,
  type ReleasedAggregate,
} from "@/lib/signal/store";
import { DISCLAIMERS } from "@/lib/disclaimers";
import { SourceRefSchema, type ToolDef } from "@/lib/tools/wrap";

/**
 * The read side of the anonymous signal pool, companion to
 * contribute_anonymous_signal. Anyone can call this — there's no recruiter
 * login anywhere in this product, so the
 * privacy protection comes from the k-anonymity floor itself
 * (MIN_CONTRIBUTORS, lib/signal/store.ts), not from gating who asks.
 *
 * Honesty, not false precision: this reflects unauthenticated,
 * self-reported contributions with no protection against duplicates or
 * bad-faith submissions — every response says so. It is a rough,
 * directional signal, never a rigorous survey, and never a ranking of any
 * individual.
 */

const InputSchema = z
  .object({
    role_id: RoleIdSchema.optional(),
    company_slug: CompanySlugSchema.optional(),
  })
  .strict()
  .refine((obj) => (obj.role_id ? 1 : 0) + (obj.company_slug ? 1 : 0) === 1, {
    message: "Pass exactly one of role_id or company_slug, not both and not neither.",
  });

const BreakdownFieldSchema = z.record(z.string(), z.number()).nullable();

const OutputSchema = z.object({
  scope: z.object({ type: z.enum(["role", "company"]), label: z.string() }),
  // Null below the floor. Exact counts under 5 (1, 2, 3) used to be
  // returned, which lets a reader diff before/after their own call and pick
  // out a single contributor's answer once the breakdown appears. Above the
  // floor the exact total did the same, so the read
  // side now shows whole steps of RELEASE_STEP contributions only — see
  // getReleasedAggregate in lib/signal/store.ts for the reasoning.
  contributionsReflected: z.number().nullable(),
  totalContributionsBand: z.object({ atLeast: z.number(), fewerThan: z.number() }).nullable(),
  releaseStep: z.number(),
  percentStep: z.number(),
  meetsFloor: z.boolean(),
  percentages: z
    .object({
      // No citizenship breakdown: the pool no longer collects it, and
      // the store drops it from records written before that change.
      clearanceLevel: BreakdownFieldSchema,
      yearsExperience: BreakdownFieldSchema,
    })
    .nullable(),
  sources: z.array(SourceRefSchema),
  disclaimer: z.string(),
});

function toPercentages(counts: Partial<Record<string, number>> | null, total: number): Record<string, number> | null {
  if (!counts) return null;
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    if (count === undefined) continue;
    out[key] = Math.round((count / total) * (100 / PERCENT_STEP)) * PERCENT_STEP;
  }
  return out;
}

export const getAggregatedSignalTool: ToolDef<z.infer<typeof InputSchema>, z.infer<typeof OutputSchema>> = {
  name: "get_aggregated_signal",
  title: "Read a role or company's aggregated anonymous signal",
  description:
    "Reads back the anonymous signal pool contribute_anonymous_signal writes to, as percentages rounded to the nearest 5 — never an individual record, and never before at least 5 people have contributed for this exact role or company (a k-anonymity floor: below that, or for any specific bucket value with fewer than 5 contributors, this returns nothing for it rather than a number that could single someone out). It updates only in steps of 5 contributions and gives the total as a band, so comparing two reads can never isolate one new contributor. Pass exactly one of role_id (that specific posting only) or company_slug (every contribution across all of that company's postings).",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  handler: async ({ role_id, company_slug }) => {
    const store = getSignalStore();
    let scopeType: "role" | "company";
    let scopeId: string;
    let label: string;

    if (role_id) {
      const role = await resolveRole(role_id);
      scopeType = "role";
      scopeId = role.id;
      label = `${role.title} at ${role.company}`;
    } else {
      // company_slug is guaranteed set here by InputSchema's refine.
      const slug = company_slug as string;
      const { company } = await getCompany(slug);
      label = company.name;
      scopeType = "company";
      scopeId = slug;
    }

    const breakdown: ReleasedAggregate = await getReleasedAggregate(store, scopeType, scopeId);
    const reflected = breakdown.contributionsReflected;

    const notDurableNote =
      store.backend === "in-memory"
        ? " This instance is currently running on non-durable, in-memory storage (no persistent store is configured yet) — contribution counts may reset between deployments rather than accumulating reliably."
        : "";

    return {
      scope: { type: scopeType, label },
      contributionsReflected: breakdown.meetsFloor ? reflected : null,
      totalContributionsBand: breakdown.meetsFloor ? { atLeast: reflected, fewerThan: reflected + RELEASE_STEP } : null,
      releaseStep: RELEASE_STEP,
      percentStep: PERCENT_STEP,
      meetsFloor: breakdown.meetsFloor,
      percentages: breakdown.meetsFloor
        ? {
            clearanceLevel: toPercentages(breakdown.clearanceLevel, reflected),
            yearsExperience: toPercentages(breakdown.yearsExperience, reflected),
          }
        : null,
      sources: [SPEEDRUN_SOURCE],
      disclaimer:
        (breakdown.meetsFloor
          ? `Reflects the oldest ${reflected} anonymous contributions for this ${scopeType} (the total is at least ${reflected} and fewer than ${reflected + RELEASE_STEP}): the breakdown updates only in steps of ${RELEASE_STEP} contributions, and percentages are rounded to the nearest ${PERCENT_STEP}, so comparing two reads can't single out one new contributor. Any individual bucket value with fewer than ${MIN_CONTRIBUTORS} contributors is folded into "otherBelowFloor" rather than shown on its own, so no reader can single out a small subgroup. `
          : `Fewer than ${MIN_CONTRIBUTORS} people have contributed for this ${scopeType} yet, so no breakdown is shown — this protects the few contributors who do exist from being identifiable. `) +
        "This reflects unauthenticated, self-reported contributions. A short per-role cooldown blocks only the fastest burst-style fabrication (see contribute_anonymous_signal) — it is not a full anti-fabrication system, and nothing stops a slower, more patient bad-faith actor. Treat this as a rough, directional signal, never a rigorous survey, and never a ranking or score of any individual candidate." +
        notDurableNote +
        " " +
        DISCLAIMERS.noDemographicInference,
    };
  },
};
