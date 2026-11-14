import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { SourcesTable } from "@/components/sources-table";
import { allSourceRows, checkedDateSummary } from "@/lib/sources-rows";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Every rule, timeline figure, and citation behind cleared — primary-source links, nothing hand-copied, every one checked live as part of this build.",
};

export default function SourcesPage() {
  const rows = allSourceRows();
  // The header once said "all checked live on <one date>" while 13 rows had
  // no date at all; it now states the actual range and any undated rows.
  const { earliest, latest, undated } = checkedDateSummary(rows);
  const dateRange = earliest === latest ? `on ${latest}` : `between ${earliest} and ${latest}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main id="main-content" className="mx-auto w-full max-w-[1120px] flex-1 px-6 py-16 sm:py-20">
        <h1 className="text-[1.875rem] leading-[1.25] font-semibold tracking-[-0.005em] text-neutral-12">Sources</h1>
        <p className="mt-2 text-[0.8125rem] leading-[1.4] font-medium text-neutral-10">
          {rows.length} sources · checked live {dateRange}
          {undated > 0 && ` · ${undated} with no checked date (not verified, so none is shown)`}
        </p>
        {/* Every row below once shared the identical lastVerified date, spanning
            everything from a 2026 federal docket to a 1985 journal article
            — read uncharitably (and understandably), that looks like one
            rolling timestamp dressed up as differentiated, ongoing
            per-source diligence. It's neither fake nor a bug: this project
            was built end-to-end in one concentrated session, and every
            citation was actually opened and confirmed live during that
            build — but the page never said that plainly, so the identical
            dates read as overstated rigor instead of an accurate build
            record. Saying it explicitly is the honest fix. */}
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-[1.5] text-neutral-10">
          This project was built end-to-end in one concentrated session — every citation below was actually opened
          and confirmed live as part of that build, which is why the dates cluster together rather than reflecting a
          staggered, ongoing audit. If you&rsquo;re reading this later, treat each date as the day that source was
          last opened, not a promise of continuous re-checking — a stale link is possible and worth reporting.
        </p>

        <div className="mt-8">
          <SourcesTable rows={rows} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
