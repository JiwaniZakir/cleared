# cleared

A connector for the AI agent you already use. Add it to Grok Bot or Muse, and your agent finds defense-technology roles in the a16z speedrun Talent Network, checks each role's visa, export-control and clearance rules against what you tell it, and lets you try the work before you apply.

## Add it

Paste this into your agent's chat:

```text
Add this MCP server: https://cleared-mcp.vercel.app/mcp
```

No account and no key. Any client that supports remote MCP servers over Streamable HTTP takes the same URL. Steps for each client are in the [quickstart](docs/quickstart.mdx).

## What it does today

| | |
| --- | --- |
| **Find roles** | `search_defense_roles` searches live postings. Every requirement it reports is labelled *stated* (quoted from the posting) or *inferred*. |
| **Check the rules** | `explain_rule`, `estimate_timeline` and `readiness_brief` give the rule behind each requirement, with its primary source. |
| **Try the work** | `run_job_preview`, `build_trial_assessment` and `fit_debrief` give a simulated first week and a task built from the posting. |
| **Share what you choose** | `verify_evidence` and `prepare_consented_card` prepare evidence and a card that you send yourself. |

There are 16 tools in all; see the [reference](docs/reference/tools.mdx). You can try them without an agent at [/try](https://cleared-mcp.vercel.app/try).

## Not built yet

Sending applications straight into a company's hiring pipeline, review by the company's agents, and interview scheduling are designed but not built. See the [roadmap](docs/roadmap.mdx).

## Limits

- Checks compare postings with what you tell your agent. No status or clearance is verified, and nothing here is legal advice.
- The server never asks for SSNs, dates of birth, ID numbers or clearance records, and a guard rejects them if they are sent.
- More in [privacy and safety](docs/privacy-and-safety.mdx).

## Develop

```bash
pnpm install
pnpm dev       # http://localhost:3000, MCP at /mcp
pnpm verify    # lint, typecheck, tests, link check
```

Node 22.19 or later, and pnpm 10.

```text
app/  lib/  components/   the MCP server and its pages
marketing/                the website (a separate Next.js project)
docs/                     the documentation (Mintlify)
```

## License

[MIT](LICENSE). Report security issues as described in [SECURITY.md](SECURITY.md). Company names and logos belong to their owners, and a listing is not an endorsement.
