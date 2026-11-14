# Contributing to cleared

Thanks for helping. This file covers setup, tests, and how to propose a change.

## Set up

You need Node.js 22.19 or later and pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000, MCP endpoint at /mcp
```

No environment variables are needed for the public tools. To set any, copy the names you need from `.env.example` into `.env.local`, which git ignores. Never commit a value, and never paste a key into an issue or a chat.

## Test

Run these before you open a pull request:

```bash
pnpm verify                                         # lint, typecheck, unit tests, link check
MCP_URL=http://localhost:3000/mcp pnpm test:protocol  # with pnpm dev running
```

`pnpm test:e2e` runs Playwright against a production build; see `playwright.config.ts`. CI runs all of these on every pull request.

Unit tests need no network or account. Database tests run on an embedded Postgres (PGlite), one fresh in-memory database per test file.

## Propose a change

1. Open an issue first for anything larger than a fix, so the approach can be agreed before you build it.
2. Branch from `main`. Use conventional-commit messages, as in `CHANGELOG.md` (`fix:`, `feat:`, `docs:`).
3. Keep each pull request to one change. Add or update tests with it.
4. Explain any design decision in the pull request: what you decided, why, and what it affects. Add a line to `CHANGELOG.md`.

### Project rules

- **One tool core.** Add a tool by adding a `ToolDef` to `lib/tools/registry.ts`. Both endpoints pick it up. Never call a handler outside `callTool`.
- **Every fact has a source.** A rule, number or claim a tool returns needs a primary source with a URL and a verified date in `data/`, and the URL in `SOURCES.md`.
- **The guard is not optional.** Do not weaken a detector to fix a false refusal without a test for both the refusal you remove and the identifiers it must still catch.
- **Annotations match behaviour.** A tool that writes must declare `readOnlyHint: false`.
- **Nothing export-controlled.** Generated content comes only from the public posting.
- **Next.js 16.** This version differs from older ones. Read the guide in `node_modules/next/dist/docs/` before changing routes, cookies or server actions.

## Documentation

The docs live in `docs/` as a Mintlify site (`docs/docs.json` plus MDX pages). Pages are mostly plain Markdown, so they also read on GitHub.

The tools reference is generated from the registry. After you change a tool, run:

```bash
pnpm docs:tools           # rewrites docs/reference/tools.mdx
pnpm docs:tools --check   # exits 1 if the page is out of date
```

To preview the site, install the Mintlify CLI (it needs Node.js 20.17 or later) and run it from `docs/`:

```bash
npm i -g mint
cd docs
mint dev --port 3400
mint broken-links
```

Every page carries a status for each feature: **Available**, **Groundwork** (built and tested, but nothing a client can call uses it yet) or **Not built yet**. Keep that true when you change a feature.

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](./SECURITY.md).
