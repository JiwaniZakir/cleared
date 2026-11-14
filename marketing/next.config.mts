import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// A WebGL page needs two things the main app's policy doesn't allow:
// `blob:` for images and fetches (three.js turns textures embedded in a model
// into blob URLs — Safari loads them through <img>, Chromium through fetch),
// and blob workers for any decoder. Everything else stays as strict as the
// main app's policy. 'unsafe-inline' on script-src is the same tested
// tradeoff the main app makes: Next.js emits inline
// hydration scripts, and nonces would force dynamic rendering.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    // This project lives inside the main app's repository, which has its own
    // lockfile one level up. Pin the root here so Turbopack never resolves
    // modules from the parent project.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          // No `preload`: putting a domain on the browsers' preload list is a deliberate decision, and hard to undo.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        // The partner marks keep their file names when a company replaces one, so a browser keeps them for a day, not for good.
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

/** `PHASE_PRODUCTION_BUILD` in `next/constants`: the config is being loaded by `next build`. */
const BUILDING = "phase-production-build";

export default function config(phase: string): NextConfig {
  // A build that is going to be deployed must know its own public address: the canonical URL and the
  // link-preview tags are absolute, and they are written into the HTML at build time (lib/site.ts). Without
  // one they would point at localhost. A local build keeps that fallback; a deploy build stops here instead.
  const deploying = process.env.VERCEL_ENV === "production" || !!process.env.CI;
  if (phase === BUILDING && deploying && !process.env.NEXT_PUBLIC_SITE_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    throw new Error(
      "No site URL for this deploy build. Set NEXT_PUBLIC_SITE_URL to the site's public origin (for example https://example.com), " +
        "or build on Vercel with system environment variables exposed (VERCEL_PROJECT_PRODUCTION_URL). " +
        "Without it the canonical URL and the link-preview image would point at http://localhost:3310.",
    );
  }
  return nextConfig;
}
