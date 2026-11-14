import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// Without this, no robots.txt existed at all, and the path fell through to
// the SPA's own 404 shell. Everything on this site is already
// public (no account-gated or user-specific pages exist to disallow).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
