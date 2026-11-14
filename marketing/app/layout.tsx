import type { Metadata, Viewport } from "next";
import { Mona_Sans } from "next/font/google";
import type { ReactNode } from "react";
import { MODE_SCRIPT } from "@/lib/capability";
import { ORIGIN } from "@/lib/site";
import "./globals.css";

// One family in every role: the variable roman with its width axis. Headlines and text use it at normal
// width; the condensed capital labels and buttons are the same file at font-stretch 82%. Downloaded at build
// time and served from this origin: the browser never contacts Google.
const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });

// The hero's line with both names (the form it takes wherever it cannot roll), and the hero's own line with the
// network named.
const TITLE = "cleared. Get hired for defense through your Grok Bot or Muse.";
const DESCRIPTION = "Add cleared to Grok Bot or Muse. It finds defense roles on the a16z speedrun Talent Network and sends what you approve.";

export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", siteName: "cleared", url: "/" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#ebe9e5", colorScheme: "light" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mode="still" suppressHydrationWarning className={mona.variable}>
      <head>
        {/* Before first paint: does this visitor get the live stage? (lib/capability.ts) */}
        <script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
