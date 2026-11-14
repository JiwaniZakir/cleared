import { describe, it, expect } from "vitest";
import { allSourceRows, checkedDateSummary, ASSESSMENT_SCIENCE_ROWS, LIVE_DATA_SOURCE_ROWS } from "@/lib/sources-rows";
import type { SourceRow } from "@/components/sources-table";

// /sources once had 13 rows with no checked date, one paper listed twice,
// mirror links where a DOI exists, and a row labelled "illustrative, not a
// primary research source".
describe("/sources rows", () => {
  const rows = allSourceRows();

  it("every row has a checked date", () => {
    const undated = rows.filter((r) => !r.lastVerified).map((r) => r.title);
    expect(undated).toEqual([]);
    for (const row of [...ASSESSMENT_SCIENCE_ROWS, ...LIVE_DATA_SOURCE_ROWS]) {
      expect(row.lastVerified, row.title).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("lists each work once", () => {
    const urls = rows.map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
    const works = ASSESSMENT_SCIENCE_ROWS.map((r) => /^(.+?\(\d{4}\))/.exec(r.title)?.[1]);
    expect(works.every(Boolean)).toBe(true);
    expect(new Set(works).size).toBe(works.length);
  });

  it("links papers by DOI, never a mirror, repository or encyclopedia copy", () => {
    for (const row of ASSESSMENT_SCIENCE_ROWS) {
      expect(row.url, row.title).toMatch(/^https:\/\/doi\.org\/10\.\d{4,}\//);
    }
    const mirrors = /gwern\.net|stafforini\.com|weebly\.com|researchgate\.net|core\.ac\.uk|iresearchnet\.com|peoplemanagingpeople\.com/;
    expect(rows.filter((r) => mirrors.test(r.url)).map((r) => r.url)).toEqual([]);
  });

  it("has no row that calls itself illustrative or not a primary source", () => {
    expect(rows.filter((r) => /illustrative|not a primary/i.test(r.title)).map((r) => r.title)).toEqual([]);
  });

  it("the header's date summary is a range and counts undated rows instead of hiding them", () => {
    const sample: SourceRow[] = [
      { title: "a", url: "https://a.example", tag: "a", category: "Live data sources", lastVerified: "2026-11-11" },
      { title: "b", url: "https://b.example", tag: "b", category: "Live data sources", lastVerified: "2026-11-13" },
      { title: "c", url: "https://c.example", tag: "c", category: "Live data sources" },
    ];
    expect(checkedDateSummary(sample)).toEqual({ earliest: "2026-11-11", latest: "2026-11-13", undated: 1 });
    expect(checkedDateSummary(rows).undated).toBe(0);
  });
});
