/**
 * The ONE place the production URLs are defined. Every install snippet,
 * the Claude Code one-liner, and any other reference interpolates these —
 * never hand-duplicated.
 */
export const SITE_URL = "https://cleared-mcp.vercel.app";
export const MCP_URL = `${SITE_URL}/mcp`;
export const GITHUB_REPO_URL = "https://github.com/JiwaniZakir/cleared";
export const CLAUDE_CODE_INSTALL_COMMAND = `claude mcp add --transport http cleared ${MCP_URL}`;
