import type { MetadataRoute } from "next";
import { ORIGIN } from "@/lib/site";

/** The site is one page. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${ORIGIN}/`, changeFrequency: "monthly", priority: 1 }];
}
