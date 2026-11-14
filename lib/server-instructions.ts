/**
 * The MCP server's `instructions`: grok.com, Grok Bot, and the Muse
 * app don't surface MCP prompts, so the workflow has to reach the agent here.
 * Kept out of app/mcp/route.ts so it can be unit tested: a route file may only
 * export route handlers and segment config.
 *
 * The first sentence used to say "defense-tech roles at a16z speedrun
 * companies", which narrows the scope. The roles are
 * the a16z speedrun Talent Network's defense and space postings, which
 * include a16z-tier and market-tier companies, so the sentence names the
 * network instead. The last sentence is the ignored-keys notice.
 */
export const SERVER_INSTRUCTIONS = [
  "cleared helps someone pursue defense and space roles from the a16z speedrun Talent Network — and helps the teams posting them hire — from inside their own agent.",
  "Start with search_defense_roles; its roles[].id is the role_id and roles[].companySlug the company_slug every other tool takes.",
  "Everything about the user stays with you: get_role_rubric and readiness_brief are for you to evaluate privately; prepare_consented_card returns a template you fill in locally. Never send names, contact details, ID numbers, dates of birth, or clearance records — every input is scanned and rejected if it contains them. Pass status only in general terms (e.g. citizenship_status: \"green_card\").",
  "A U.S. security clearance requires U.S. citizenship; a green card satisfies ITAR's U.S.-person test, not a clearance (explain_rule \"clearance-citizenship\").",
  "contribute_anonymous_signal writes to a shared anonymous pool: call it only after the user explicitly agrees, every time.",
  "For a hiring team: generate_interview_guide, build_trial_assessment, and run_job_preview are built from the posting alone; verify_signed_attestation checks a credential a candidate shares. Nothing here scores or ranks people.",
  "Every result lists ignoredInputKeys: input keys that tool does not take, which were dropped unused and not stored. If one is there, that tool cannot do what you sent it for.",
].join(" ");
