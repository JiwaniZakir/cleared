# Security policy

## Report a vulnerability

Report it privately through GitHub: open this repository's **Security** tab and choose **Report a vulnerability**. Only the maintainers see the report.

Do not open a public issue, pull request or discussion for a security problem.

Include what you found, the steps to reproduce it, and what an attacker could do with it. Do not include real personal data in the report. If you found a way past the privacy guard, a synthetic example, such as `123-45-6789`, is enough.

## What is in scope

- The production server at `https://cleared-mcp.vercel.app`, including the MCP endpoint at `/mcp` and the REST endpoint at `/api/tools/*`.
- A way to get an identifier past the privacy guard (`lib/guard/pii.ts`), on either endpoint.
- A way to read or change another person's or another employer's data, once the pipeline ships.
- Secrets or personal data in this repository.

Testing must not degrade the service for others, and must not use real personal data.

## Supported versions

Only the current production deployment, built from `main`, is supported.
