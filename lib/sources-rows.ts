import type { SourceRow, DisplayCategory } from "@/components/sources-table";
import { RULES, type RuleEntry } from "@/lib/rules-data";
import { TIMELINES } from "@/lib/timelines-data";
import { PIPELINE_SOURCES } from "@/lib/pipeline-steps-data";

/** The rows the /sources page renders. Kept out of app/sources/page.tsx so
 *  they can be unit tested (a page file may only export the page and its
 *  metadata); see tests/unit/sources-page.test.ts. */

function displayCategoryForRule(category: RuleEntry["category"]): DisplayCategory {
  switch (category) {
    case "itar":
      return "ITAR & export control";
    // Everything else is "how the clearance process itself works" —
    // eligibility criteria, process steps, sponsorship, reciprocity,
    // continuous vetting, and the verification-tech survey all land in the
    // one remaining process bucket of the page's category list.
    case "eligibility":
    case "clearance-process":
    case "sponsorship":
    case "reciprocity":
    case "continuous-vetting":
    case "verification-tech":
      return "Clearance process & timelines";
    // FCRA, fair-chance, I-9, E-Verify, offers and confidentiality
    // agreements are hiring-compliance law.
    case "pre-employment":
      return "Hiring compliance & bias law";
    default: {
      // Exhaustiveness guard: if RuleCategorySchema ever gains a new
      // category, this fails tsc at build time instead of silently
      // dropping its sources from the page.
      const exhaustive: never = category;
      return exhaustive;
    }
  }
}

/**
 * Pulled directly from the typed, validated accessors (lib/rules-data.ts,
 * lib/timelines-data.ts) rather than hand-copied, so this list can't drift
 * from data/rules.json / data/timelines.json. Deduplicated by URL: several rules and timeline modifiers
 * cite the exact same primary document (e.g. the SEAD 7 text, or the
 * Trusted Workforce 2.0 quarterly report) — each unique source still
 * appears exactly once, just tagged with whichever rule/modifier id first
 * introduced it, rather than once per citing rule.
 */
export function ruleAndTimelineRows(): SourceRow[] {
  const rows: SourceRow[] = [];

  for (const rule of RULES) {
    const category = displayCategoryForRule(rule.category);
    for (const source of rule.sources) {
      rows.push({ title: source.title, url: source.url, lastVerified: source.lastVerified, tag: rule.id, category });
    }
  }

  for (const level of ["secret", "ts"] as const) {
    const stats = TIMELINES.investigations[level];
    rows.push({
      title: stats.source.title,
      url: stats.source.url,
      lastVerified: stats.source.lastVerified,
      tag: `investigations.${level}`,
      category: "Clearance process & timelines",
    });
  }

  for (const modifier of TIMELINES.modifiers) {
    for (const source of [modifier.source, ...(modifier.additionalSources ?? [])]) {
      rows.push({
        title: source.title,
        url: source.url,
        lastVerified: source.lastVerified,
        tag: modifier.id,
        category: "Clearance process & timelines",
      });
    }
  }

  const seen = new Map<string, SourceRow>();
  for (const row of rows) {
    if (!seen.has(row.url)) seen.set(row.url, row);
  }
  return [...seen.values()];
}

/**
 * The hiring-compliance and bias-law items, each verified on 2026-11-11 in
 * a dedicated research pass. Each row uses the item's own PRIMARY/
 * authoritative source; secondary news write-ups (Law360,
 * Bloomberg Law commentary on Mobley v. Workday) are corroboration, not a
 * separate citation, so they're intentionally not duplicated as rows here.
 * Never replace a row with an invented placeholder citation.
 */
export const HIRING_COMPLIANCE_ROWS: SourceRow[] = [
  {
    category: "Hiring compliance & bias law",
    tag: "42 U.S.C. §2000e-2(k)",
    title: "Title VII disparate-impact doctrine (42 U.S.C. § 2000e-2(k))",
    url: "https://www.law.cornell.edu/uscode/text/42/2000e-2",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "E.O. 14281",
    title: 'E.O. 14281, "Restoring Equality of Opportunity and Meritocracy" (Apr. 23, 2025)',
    url: "https://www.govinfo.gov/content/pkg/FR-2025-04-28/html/2025-07378.htm",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "EEOC AI guidance",
    title: "EEOC's 2023 AI adverse-impact guidance — archived mirror (removed from eeoc.gov Jan. 2025)",
    url: "https://data.aclum.org/storage/2025/01/EOCC_www_eeoc_gov_laws_guidance_select-issues-assessing-adverse-impact-software-algorithms-and-artificial.pdf",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "NYC Local Law 144",
    title: "NYC Local Law 144 — automated employment decision tools",
    url: "https://www.nyc.gov/site/dca/about/automated-employment-decision-tools.page",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "IL P.A. 103-0804",
    title:
      "Illinois AI hiring-notice law, Public Act 103-0804 — secondary-corroborated; primary statute text not independently re-confirmed this pass",
    url: "https://www.ilga.gov/Legislation/PublicActs/View/103-0804",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "CO SB 26-189",
    title: "Colorado automated decision-making law, SB 26-189 (replaces the repealed SB 24-205) — effective Jan. 1, 2027, still contested",
    url: "https://leg.colorado.gov/bills/SB26-189",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "EU AI Act Annex III",
    title: "EU AI Act, Annex III point 4 — hiring/employment AI classified high-risk",
    url: "https://ai-act-service-desk.ec.europa.eu/en/ai-act/annex-3",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "Digital Omnibus",
    title: "EU AI Act — Digital Omnibus delay of the high-risk compliance deadline to Dec. 2, 2027",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "Mobley v. Workday",
    title: "Mobley v. Workday — court docket, N.D. Cal. No. 3:23-cv-00770-RFL",
    url: "https://www.pacermonitor.com/public/case/47898981/Mobley_v_WORKDAY,_INC",
    lastVerified: "2026-11-11",
  },
  {
    category: "Hiring compliance & bias law",
    tag: "Mobley v. Workday",
    title: "Mobley v. Workday — case tracker, Civil Rights Litigation Clearinghouse (Univ. of Michigan Law)",
    url: "https://clearinghouse.net/case/44074/",
    lastVerified: "2026-11-11",
  },
];

// Checking every URL the tools actually cite against this page found a gap:
// it listed rules and research but not the live data the tools read — including the a16z
// speedrun Talent Network, the source of every role and company in the
// product. Every URL here was resolved live (HTTP 200) before being added, and
// each was opened again on 2026-11-13 to record a checked date.
export const LIVE_DATA_SOURCE_ROWS: SourceRow[] = [
  {
    category: "Live data sources",
    tag: "speedrun",
    title: "a16z speedrun Talent Network — every role and company (search_defense_roles, get_company_profile, and every role-based tool)",
    url: "https://speedrun-talent-network.com",
    lastVerified: "2026-11-13",
  },
  {
    category: "Live data sources",
    tag: "GitHub",
    title: "GitHub public REST API — already-public profile signal (verify_evidence)",
    url: "https://docs.github.com/en/rest",
    lastVerified: "2026-11-13",
  },
  {
    category: "Live data sources",
    tag: "GitLab",
    title: "GitLab public REST API — already-public profile signal (verify_evidence)",
    url: "https://docs.gitlab.com/api/rest/",
    lastVerified: "2026-11-13",
  },
  {
    category: "Live data sources",
    tag: "Cosign",
    title: "Cosign public directory API — already-public directory entry only (verify_evidence)",
    url: "https://cosign.co/docs",
    lastVerified: "2026-11-13",
  },
];

/**
 * These rows once had no checked date, Callinan &
 * Robertson (2000) was listed twice (an encyclopedia page and the DOI),
 * four linked to mirrors or repositories (gwern.net, stafforini.com, a
 * weebly.com upload, ResearchGate, CORE) although each paper has a DOI, and
 * one row was a practitioner blog labelled "illustrative". Each row now links
 * the paper's DOI, checked on 2026-11-13 against the DOI's Crossref record
 * (title, authors, year, journal, volume and pages match the work cited),
 * and the blog row is replaced by the paper that introduced behaviorally
 * anchored rating scales.
 */
export const ASSESSMENT_SCIENCE_ROWS: SourceRow[] = [
  {
    category: "Assessment science",
    tag: "Sackett et al. 2022",
    title:
      "Sackett, Zhang, Berry & Lievens (2022) — Revisiting meta-analytic estimates of validity in personnel selection, Journal of Applied Psychology 107(11) (structured interview .42, unstructured .19)",
    url: "https://doi.org/10.1037/apl0000994",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Sackett et al. 2023",
    title:
      "Sackett, Zhang, Berry & Lievens (2023) — Revisiting the design of selection systems in light of new findings regarding the validity of widely used predictors, Industrial and Organizational Psychology 16(3)",
    url: "https://doi.org/10.1017/iop.2023.24",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Schmidt & Hunter 1998",
    title:
      "Schmidt & Hunter (1998) — The validity and utility of selection methods in personnel psychology, Psychological Bulletin 124(2) (structured interview .51, unstructured .38; revised by Sackett et al. 2022)",
    url: "https://doi.org/10.1037/0033-2909.124.2.262",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Callinan & Robertson 2000",
    title: "Callinan & Robertson (2000) — Work sample testing, International Journal of Selection and Assessment 8(4)",
    url: "https://doi.org/10.1111/1468-2389.00154",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Campion et al. 1997",
    title: "Campion, Palmer & Campion (1997) — A review of structure in the selection interview, Personnel Psychology 50(3)",
    url: "https://doi.org/10.1111/j.1744-6570.1997.tb00709.x",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Smith & Kendall 1963",
    title:
      "Smith & Kendall (1963) — Retranslation of expectations: an approach to the construction of unambiguous anchors for rating scales, Journal of Applied Psychology 47(2) (behaviorally anchored rating scales)",
    url: "https://doi.org/10.1037/h0047060",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Premack & Wanous 1985",
    title: "Premack & Wanous (1985) — A meta-analysis of realistic job preview experiments, Journal of Applied Psychology 70(4)",
    url: "https://doi.org/10.1037/0021-9010.70.4.706",
    lastVerified: "2026-11-13",
  },
  {
    category: "Assessment science",
    tag: "Earnest et al. 2011",
    title:
      "Earnest, Allen & Landis (2011) — Mechanisms linking realistic job previews with turnover: a meta-analytic path analysis, Personnel Psychology 64(4)",
    url: "https://doi.org/10.1111/j.1744-6570.2011.01230.x",
    lastVerified: "2026-11-13",
  },
];

/** The law behind each of the 38 steps in the recruiter guide
 *  (/docs/recruiter), from data/pipeline-steps.json. Rows whose URL another
 *  section already lists are left to that section. */
export function recruiterGuideRows(exclude: ReadonlySet<string>): SourceRow[] {
  return Object.entries(PIPELINE_SOURCES)
    .filter(([, s]) => !exclude.has(s.url))
    .map(([key, s]) => ({
      category: "Hiring compliance & bias law" as const,
      tag: key,
      title: `${s.title} (recruiter guide)`,
      url: s.url,
      lastVerified: s.checked,
    }));
}

/** Every row /sources renders, in page order. */
export function allSourceRows(): SourceRow[] {
  const rows = [...ruleAndTimelineRows(), ...HIRING_COMPLIANCE_ROWS, ...ASSESSMENT_SCIENCE_ROWS, ...LIVE_DATA_SOURCE_ROWS];
  return [...rows, ...recruiterGuideRows(new Set(rows.map((r) => r.url)))];
}

/** The page header's date line: the range of checked dates, and how many
 *  rows have none — never one date presented as if it covered every row. */
export function checkedDateSummary(rows: SourceRow[]): { earliest: string | null; latest: string | null; undated: number } {
  const dates = rows.map((r) => r.lastVerified).filter((d): d is string => Boolean(d)).sort();
  return { earliest: dates[0] ?? null, latest: dates.at(-1) ?? null, undated: rows.length - dates.length };
}
