/**
 * Where this site is served from, for the absolute addresses a link preview, the canonical URL, robots.txt
 * and the sitemap need. Set NEXT_PUBLIC_SITE_URL once the site has its own domain; until then a Vercel
 * build uses the project's production address. It is read at build time: a deploy build without either
 * fails (next.config.mts) rather than publishing localhost.
 */
export const ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3310")
).replace(/\/+$/, "");
