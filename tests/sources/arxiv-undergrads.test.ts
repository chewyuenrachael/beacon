import { afterEach, describe, expect, it, vi } from "vitest";
import {
  discoverFromArxivUndergrads,
  matchAffiliationToDhvcTopUsInstitution,
  normalizeDhvcPersonName,
} from "@/lib/sources/arxiv-undergrads";

function atomFeedWithEntries(entriesXml: string, totalResults: number): string {
  return `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom" xmlns="http://www.w3.org/2005/Atom">
  <opensearch:totalResults>${totalResults}</opensearch:totalResults>
  ${entriesXml}
</feed>`;
}

function paperEntry(args: {
  arxivId: string;
  title: string;
  firstAuthor: string;
  affiliation?: string;
  primary: string;
}): string {
  const aff =
    args.affiliation === undefined
      ? ""
      : `\n      <arxiv:affiliation>${args.affiliation}</arxiv:affiliation>`;
  return `
  <entry>
    <id>http://arxiv.org/abs/${args.arxivId}</id>
    <title>${args.title}</title>
    <published>2026-04-01T00:00:00Z</published>
    <link href="https://arxiv.org/abs/${args.arxivId}" rel="alternate" type="text/html"/>
    <arxiv:primary_category term="${args.primary}"/>
    <author>
      <name>${args.firstAuthor}</name>${aff}
    </author>
  </entry>`;
}

describe("normalizeDhvcPersonName", () => {
  it("folds case, punctuation, and combining marks", () => {
    expect(normalizeDhvcPersonName("  O'Brien ")).toBe("o brien");
    expect(normalizeDhvcPersonName("José")).toBe("jose");
  });
});

describe("matchAffiliationToDhvcTopUsInstitution", () => {
  it("matches typical top-school affiliation strings", () => {
    expect(
      matchAffiliationToDhvcTopUsInstitution("MIT CSAIL")
    ).toBe("mit");
    expect(
      matchAffiliationToDhvcTopUsInstitution(
        "University of California, Berkeley"
      )
    ).toBe("berkeley");
    expect(
      matchAffiliationToDhvcTopUsInstitution("University of Oxford")
    ).toBeNull();
  });
});

describe("discoverFromArxivUndergrads", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a draft for a first author at a top US school with an affiliation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T12:00:00Z"));

    const xml = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.00001v1",
        title: "Testing DHVC Matching",
        firstAuthor: "Alex Student",
        affiliation: "Massachusetts Institute of Technology",
        primary: "cs.LG",
      }),
      1
    );

    const fetchArxivFeedXml = vi.fn(async () => xml);
    const loadProfessorNameKeys = vi.fn(async () => new Set<string>());

    const drafts = await discoverFromArxivUndergrads({
      fetchArxivFeedXml,
      loadProfessorNameKeys,
      now: () => new Date("2026-05-03T12:00:00Z"),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      institution_id: "mit",
      name: "Alex Student",
      primary_source: "arxiv",
      major: "Computer Science",
    });
    expect(drafts[0]?.source_urls[0]?.url).toBe(
      "https://arxiv.org/abs/2604.00001v1"
    );
    expect(drafts[0]?.source_urls[0]?.description).toContain(
      'First author on "Testing DHVC Matching"'
    );

    expect(fetchArxivFeedXml).toHaveBeenCalledWith(
      expect.objectContaining({
        search_query: expect.stringMatching(
          /^\(cat:cs\.LG OR cat:cs\.CL OR cat:cs\.AI OR cat:cs\.SE\) AND submittedDate:\[\d{12} TO \d{12}\]$/
        ),
        sortBy: "submittedDate",
        sortOrder: "descending",
        max_results: "2000",
        start: "0",
      })
    );

    expect(loadProfessorNameKeys).toHaveBeenCalledOnce();
  });

  it("skips authors that match known professors", async () => {
    const xml = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.00002v1",
        title: "Paper",
        firstAuthor: "Christopher Manning",
        affiliation: "Stanford University",
        primary: "cs.CL",
      }),
      1
    );

    const keys = new Set([normalizeDhvcPersonName("Christopher Manning")]);

    const drafts = await discoverFromArxivUndergrads({
      fetchArxivFeedXml: async () => xml,
      loadProfessorNameKeys: async () => keys,
    });

    expect(drafts).toHaveLength(0);
  });

  it("skips entries without a first-author affiliation in the feed", async () => {
    const xml = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.00003v1",
        title: "No affiliation block",
        firstAuthor: "Pat Doe",
        affiliation: undefined,
        primary: "cs.AI",
      }),
      1
    );

    const drafts = await discoverFromArxivUndergrads({
      fetchArxivFeedXml: async () => xml,
      loadProfessorNameKeys: async () => new Set(),
    });

    expect(drafts).toHaveLength(0);
  });

  it("skips affiliations that look like faculty titles", async () => {
    const xml = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.00004v1",
        title: "Faculty author",
        firstAuthor: "Pat Doe",
        affiliation: "Professor, Stanford University",
        primary: "cs.SE",
      }),
      1
    );

    const drafts = await discoverFromArxivUndergrads({
      fetchArxivFeedXml: async () => xml,
      loadProfessorNameKeys: async () => new Set(),
    });

    expect(drafts).toHaveLength(0);
  });

  it("paginates until a short page is returned", async () => {
    const page0 = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.01001v1",
        title: "P1",
        firstAuthor: "One Author",
        affiliation: "Harvard University",
        primary: "cs.CL",
      }) +
        paperEntry({
          arxivId: "2604.01002v1",
          title: "P2",
          firstAuthor: "Two Author",
          affiliation: "Harvard University",
          primary: "cs.CL",
        }),
      3
    );
    const page1 = atomFeedWithEntries(
      paperEntry({
        arxivId: "2604.01003v1",
        title: "P3",
        firstAuthor: "Three Author",
        affiliation: "Harvard University",
        primary: "cs.CL",
      }),
      3
    );

    const fetchArxivFeedXml = vi
      .fn()
      .mockResolvedValueOnce(page0)
      .mockResolvedValueOnce(page1);

    const drafts = await discoverFromArxivUndergrads({
      fetchArxivFeedXml,
      loadProfessorNameKeys: async () => new Set(),
      feedPageSize: 2,
    });

    expect(fetchArxivFeedXml).toHaveBeenCalledTimes(2);
    expect(fetchArxivFeedXml.mock.calls[0]?.[0]?.start).toBe("0");
    expect(fetchArxivFeedXml.mock.calls[1]?.[0]?.start).toBe("2");
    expect(drafts.map((d) => d.name).sort()).toEqual([
      "One Author",
      "Three Author",
      "Two Author",
    ]);
  });
});
