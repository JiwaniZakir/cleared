import type { MetadataRoute } from "next";
import { ORIGIN } from "@/lib/site";

/** Everything here is public: one page. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${ORIGIN}/sitemap.xml` };
}
