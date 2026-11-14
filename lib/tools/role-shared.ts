import { z } from "zod";
import { getJob } from "@/lib/speedrun/client";
import { extractRequirementSignals, looksNonUsLocation, type RequirementSignal } from "@/lib/speedrun/infer";
import type { SpeedrunJobApply, SpeedrunJobLabels } from "@/lib/speedrun/types";
import type { SourceRef } from "@/lib/tools/wrap";

/** Every role/company-derived tool cites the platform data came from — not a
 * statistic, just provenance, but included in `sources[]` for consistency. */
/** Every role-based tool's role_id. Described once so an agent learns where
 *  ids come from even on clients that never surface MCP prompts. */
export const RoleIdSchema = z
  .string()
  .min(1)
  .max(100)
  .describe("A role id from search_defense_roles (roles[].id). Search first if you don't have one.");

export const CompanySlugSchema = z
  .string()
  .min(1)
  .max(100)
  .describe("A company slug from search_defense_roles (roles[].companySlug) — a guessed slug from a company's common name often won't match.");

export const SPEEDRUN_SOURCE: SourceRef = {
  title: "a16z speedrun Talent Network",
  url: "https://speedrun-talent-network.com",
};

export interface ResolvedRole {
  id: string;
  title: string;
  company: string;
  // null for a stealth posting — there's no public company page to slug.
  companySlug: string | null;
  url: string;
  location: string | null;
  remote: boolean;
  workplaceType: string | null;
  compMin: number | null;
  compMax: number | null;
  compCurrency: string | null;
  publishedAt: string;
  descriptionText: string;
  labels: SpeedrunJobLabels;
  /** The posting's own "how to apply": resolveRole used to drop it. */
  apply: SpeedrunJobApply | null;
  signals: RequirementSignal[];
}

/** Fetches a role by id and extracts its requirement signals in one place, so
 * every tool that needs "a role plus what it says/implies about eligibility"
 * (get_role_rubric, readiness_brief, build_trial_assessment, run_job_preview,
 * fit_debrief) shares one implementation rather than six near-duplicates.
 * Throws SpeedrunApiError on failure — callers let it propagate to callTool,
 * which already maps a 404 to a friendly not_found result. */
export async function resolveRole(roleId: string): Promise<ResolvedRole> {
  const { job } = await getJob(roleId);
  // Every role surfaced by search_defense_roles comes from an industry=defense_space
  // query, so this context is always true for a role reached through this product.
  const signals = extractRequirementSignals(job.description_text, {
    industry: "defense_space",
    location: job.location,
  });
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    companySlug: job.company_slug,
    url: job.url,
    location: job.location,
    remote: job.remote,
    workplaceType: job.workplace_type ?? null,
    compMin: job.comp_min,
    compMax: job.comp_max,
    compCurrency: job.comp_currency,
    publishedAt: job.published_at,
    descriptionText: job.description_text,
    labels: job.labels,
    apply: job.apply ?? null,
    signals,
  };
}

/** How to apply for a role, as the posting gives it. The
 *  upstream detail carries `apply: { kind, url }` (every one of 60 live
 *  defense postings checked on 2026-11-13 had kind "external", a link to the
 *  company's own applicant-tracking page); resolveRole used to drop it, so
 *  no tool could say where the application actually goes. */
export const HowToApplySchema = z.object({
  listingUrl: z.string(),
  applicationUrl: z.string().nullable(),
  kind: z.string().nullable(),
  note: z.string(),
});
export type HowToApply = z.infer<typeof HowToApplySchema>;

export function howToApply(role: Pick<ResolvedRole, "url" | "company" | "apply">): HowToApply {
  // Only a plain web link is passed on: the value is upstream data, and a
  // consumer may render it as a link.
  const applicationUrl = role.apply && /^https?:\/\//i.test(role.apply.url) ? role.apply.url : null;
  if (applicationUrl) {
    return {
      listingUrl: role.url,
      applicationUrl,
      kind: role.apply?.kind ?? null,
      note: `Applications go through ${role.company}'s own application page (applicationUrl). cleared never applies or submits anything — the user applies there themselves.`,
    };
  }
  return {
    listingUrl: role.url,
    applicationUrl: null,
    kind: null,
    note: "The posting gives no separate application link — apply from the listing page. cleared never applies or submits anything.",
  };
}

export type ClearanceFilter = "none" | "secret" | "ts" | "ts_sci";

/** A role "matches" a clearance filter when its detected level signal (stated
 * or inferred) is that exact level, or — for "secret" — an unspecified "a
 * clearance is required" signal (reads as "at least Secret" in practice).
 * "none" matches roles where no clearance_level signal was detected at all. */
/** `location` is optional only for callers (tests, other tools) that don't
 *  have it handy and are checking a specific level directly (`levels.includes`
 *  below needs no geography) — the "secret ~ unspecified" fallback is the
 *  ONLY path this gates, since it's the one that assumes US DoD Secret by
 *  default rather than matching an explicitly-stated level. */
export function matchesClearanceFilter(
  signals: RequirementSignal[],
  clearance: ClearanceFilter,
  location?: string | null,
): boolean {
  const levels = signals.filter((s) => s.kind === "clearance_level").map((s) => s.value);
  if (clearance === "none") return levels.length === 0;
  if (levels.includes(clearance)) return true;
  // A UK Leonardo posting's generic "Security Clearance"
  // mention (clearance_required_unspecified — the UK has its own, different
  // vetting system) matched a "secret" filter query as if it meant the US
  // DoD Secret clearance this product is entirely about. The fallback below
  // assumes "an unspecified clearance" defaults to US Secret, a reasonable
  // default for a US-based posting but not a foreign one.
  if (clearance === "secret" && levels.includes("clearance_required_unspecified") && !looksNonUsLocation(location)) {
    return true;
  }
  return false;
}

/** True when the posting states a clearance, or implies one: an inferred
 *  "clearance possibly required" (government, DoD or classified work), a
 *  polygraph, or a SCIF. The clearance-wait and SCIF job-preview scenes and
 *  readiness_brief's clearance and FCL questions depend on it: a posting with
 *  only a U.S.-person requirement has no clearance to wait for. */
export function roleImpliesClearance(signals: RequirementSignal[]): boolean {
  return signals.some(
    (s) =>
      s.kind === "clearance_level" ||
      s.kind === "polygraph" ||
      s.kind === "facility_access" ||
      s.value === "us_citizen_required_for_clearance",
  );
}

export function looksItarRestricted(signals: RequirementSignal[]): boolean {
  return signals.some(
    (s) =>
      s.kind === "citizenship" &&
      (s.value === "us_person_required" ||
        s.value === "us_citizen_required" ||
        s.value === "us_person_likely" ||
        // A clearance requires citizenship, which implies U.S.-person status.
        s.value === "us_citizen_required_for_clearance"),
  );
}
