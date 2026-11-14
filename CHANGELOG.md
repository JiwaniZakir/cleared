# Changelog

All notable changes to cleared, newest first.

## [Unreleased] — renamed to cleared (2026-11-14)

The product was formerly called Clearance Lens. The server exposes 16 public tools, 3 resources and 4 prompts. The 12 pipeline tools exist only as disabled stubs, and no client can call them.

### change
- Renamed to cleared: the MCP server's name (`serverInfo.name`), its `instructions`, page titles and metadata, the Open Graph image, the install snippets, the health check (`service: "cleared"`) and the `source=` attribution sent to the Talent Network API.
- The MCP endpoint is `https://cleared-mcp.vercel.app/mcp`. The old address, `clearance-lens.vercel.app`, still answers from the same deployment.
- Breaking: the resource URIs are now `cleared://rules.json`, `cleared://timelines.json` and `cleared://disclaimers.json`.
- The Claude Code command and the JSON config snippets name the server `cleared`.
- The interest pool's storage keys keep their `clearance-lens:` prefix, so contributions already stored stay readable.

### fix
- `/privacy` and the FAQ said every request is forgotten at once. Public data a tool looks up is cached briefly: postings for 5 minutes, and a GitHub, GitLab or Cosign profile for up to 10 minutes. The privacy page now says so, and lists the usernames and signed claims some tools receive.
- The home page and metadata called the server "stateless". The interest pool keeps state, so they now say "remote MCP server".
- The recruiter guide's banner says the pipeline is "designed but not built yet", not "being built now".
- `verify_evidence` and the `share_intro_card` prompt no longer cite an internal decisions file.
- `pnpm typecheck` runs `next typegen` first, so it passes on a clean checkout. CI had failed on `LayoutProps` since 2026-11-12.
- CI starts the server with `next start -p 3100`. The old `pnpm start -- -p 3100` handed a literal `--` to Next.js, which then exited.

## 2026-11-13 — guard fixes: ids and lenient decoding

### fix
- About 1 random UUID in 100 was refused as an SSN or a card number, and so was about 1 Talent Network posting id in 100 sent back as `role_id`. The guard's ROT13 view now keeps the UUID exemption. On 100,000 random UUIDv4s: 932 refused before, 0 after.
- Percent view: one malformed escape (a lone `%`, `%3`, `%FF`) made the whole view give up, so a percent-encoded SSN with a stray `%` got through. Well-formed escapes are now always decoded, and each decoded layer is normalised.
- Base64 view: an encoded SSN sentence with one to three characters glued to its end is now refused.
- About 3 in 100,000 ids were refused as case numbers because the id's own groups looked like one. A match wholly inside a UUID no longer counts.

### test
- 91 new guard tests, including 100 real posting ids as fixtures. A false-positive sweep over about 73,000 ordinary strings changed no result.

## 2026-11-13 — pipeline groundwork

The first two slices of the recruiting pipeline. Nothing a client can call changed: no pipeline tool is registered.

### feat
- Postgres schema: 34 tables and 54 enums, with Drizzle migrations in `drizzle/`. Row-level security is enabled and forced on 32 tables, and every scoped transaction runs as a non-superuser role. The audit log is append-only in the database.
- Database client: `pg` when `DATABASE_URL` is set; otherwise an embedded PGlite under `.data/pglite` (never on Vercel). No route opens it yet.
- The work-order schema and renderer (`lib/workorder/*`). `callTool` takes an optional caller context, per-tool access and input limits, and five pipeline error codes.
- Twelve pipeline tool stubs (`lib/tools/pipeline/*`), disabled, with their input schemas.
- A daily cron route, `GET /api/cron/tick`, which needs `Authorization: Bearer $CRON_SECRET`. Every job in it is disabled.
- `explain_rule`: eight topics for the steps after an offer: FCRA background checks, adverse action, fair-chance timing, Form I-9, E-Verify, offer contingencies, confidentiality and invention-assignment agreements, and the export check after an offer.
- `/docs/recruiter`: a guide to the 38 steps from opening a role to day one, generated from `data/pipeline-steps.json`. Parts not built are marked "Not built yet".

### change
- The anonymous interest pool no longer collects or shows citizenship status. `scripts/strip-pool-citizenship.ts` removes it from records stored before.

## 2026-11-13 — search filters, ignored keys and accuracy

### feat
- Every tool result lists `ignoredInputKeys`: input keys the tool does not take, dropped unused.
- `search_defense_roles` filters by `level`, `min_experience`, `employment_type` and `company`, and returns `matchedTotal`, `examined` and `nextCursor`, so a filtered search can cover every match. Breaking: `rolesScanned` removed.
- `howToApply`, the posting's own application page, in `get_role_rubric`, `readiness_brief`, `fit_debrief` and `prepare_consented_card`.

### fix
- The server `instructions` name the true scope: defense and space roles from the a16z speedrun Talent Network.
- The citizenship rule is titled "Security Clearances Require U.S. Citizenship: a Green Card Is Not Enough".
- Attendance and location lines no longer reach skills rubrics, prep plans, interview questions or trial rubrics.
- `run_job_preview` labels each outcome as written by the product, not as what real teams report, and shows the clearance scenes only when the posting states or implies a clearance. Breaking: `whatRealTeamsReportByChoice` is now `possibleOutcomeByChoice`.
- `generate_interview_guide` cites Sackett et al. (2022).
- Signed attestations: the verifier returns `statedTimeCheck` and flags a stated time older than 30 days or in the future.
- `get_aggregated_signal` updates in steps of five, gives the total as a band and rounds to the nearest 5, so two reads cannot isolate one contributor. Breaking: `totalContributions` is now `contributionsReflected` and `totalContributionsBand`.

## 2026-11-12 — the citizenship rule, request scanning, connector support

### fix
- Security clearances require U.S. citizenship; green card holders had been told otherwise. A sourced `clearance-citizenship` rule was added, a stated clearance now implies a citizenship signal, and `estimate_timeline` returns the rule, not a day count, for non-citizens.
- Breaking: `prepare_consented_card` no longer receives field values. It takes `approved_fields`, the names of the fields the person approved, and returns a `cardTemplate` the agent fills in locally.
- Every MCP request is scanned before the SDK sees it: tool names, arguments, prompt arguments, resource URIs and key names. No error echoes its input. About 40 more payload shapes are refused.
- Timeline data: three day-ranges that no cited source contains were removed, and a wrong-quarter figure was corrected.
- `search_defense_roles` has per-request timeouts and one overall budget.
- `/try` works on phones.

### feat
- Server `instructions`, per-tool annotations and a normalised `Accept` header, for agents that do not show MCP prompts.

## 2026-11-12 — new tools

### feat
- `generate_interview_guide`: a structured interview guide for a hiring team's own panel, built from the posting. It takes no candidate input and returns no score.
- `prepare_signed_attestation` and `verify_signed_attestation`: wrap a status claim in an Ed25519-signed credential the candidate's own agent signs, and check one. A valid signature proves which key signed, never that the claim is true.
- `contribute_anonymous_signal` and `get_aggregated_signal`: an opt-in, anonymous interest pool, read back only once five people have contributed. A short per-role cooldown blocks burst fabrication.
- `verify_evidence` also reads public GitLab profiles and the public Cosign directory, each only when given that site's URL.
- The `share_intro_card` prompt.
- A Content Security Policy, `robots.txt` and a sitemap.

## 2026-11-12 — review fixes

### fix
- The privacy guard gained detectors for card numbers, classification markings, emails, phone numbers, bare birthdates and SSN fragments split across fields, and closed rephrasings of case numbers, dates and clearance jargon.
- An extra, undeclared `tools/call` argument was dropped by the MCP SDK before the guard saw it. The route now scans the raw request.
- `explain_rule` gained the `laa-non-citizen` rule and more everyday synonyms.
- `search_defense_roles` became location-aware for citizenship and clearance signals, stopped double-counting "Top Secret security clearance", and keeps earlier pages when a later one fails.
- `estimate_timeline` explains single-figure results and the facility-clearance wait.
- The signed credential carries the exact signed bytes, so its recipient can verify it.
- `/try` gained a tab for every tool, deep links, and tabs that switch on any click. Accessibility fixes: focus-ring contrast, a skip link, labelled switches and heading order.
- `/mcp`'s CORS preflight advertises only `POST` and `OPTIONS`, matching what it serves.

## 2026-11-11 — first release

### feat
- A remote MCP server at `/mcp` with 11 tools: `explain_rule`, `estimate_timeline`, `search_defense_roles`, `verify_evidence`, `get_company_profile`, `build_trial_assessment`, `run_job_preview`, `get_role_rubric`, `readiness_brief`, `fit_debrief` and `prepare_consented_card`. Three resources and three prompts.
- The privacy guard on every input, the Talent Network and GitHub clients, and the rules and timelines data, each rule with its sources.
- The web app: `/`, `/try`, `/privacy` and `/sources`, deployed on Vercel.

### test
- Unit tests, a protocol suite with a real MCP client, Playwright end-to-end tests with axe accessibility checks, and Lighthouse CI.
