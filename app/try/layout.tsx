import type { Metadata } from "next";

// /try/page.tsx is a client component ("use client", for the tab state and
// useSearchParams), so it can't export metadata itself — Next.js only reads
// that from a Server Component. Without this sibling layout, /try silently
// inherited the root layout's bare "cleared" default instead of the
// "<Page> · cleared" template every other page gets.
export const metadata: Metadata = {
  title: "Try it",
  description: "Every cleared tool, live, with no agent or LLM key required.",
};

export default function TryLayout({ children }: LayoutProps<"/try">) {
  return children;
}
