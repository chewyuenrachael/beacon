// @ownership dhvc-module

import { fetchArxivApi } from "@/lib/sources/arxiv";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { DhvcCandidateDraft } from "@/lib/types";

/** Top-20 US targets for DHVC (Beacon `institution_id` slugs + CS rank peers). */
const DHVC_TOP_20_US_AFFILIATION_RULES: ReadonlyArray<{
  institution_id: string;
  patterns: ReadonlyArray<RegExp>;
}> = [
  {
    institution_id: "berkeley",
    patterns: [
      /University of California,?\s*Berkeley/i,
      /\bUC\s*Berkeley\b/i,
    ],
  },
  {
    institution_id: "ucla",
    patterns: [
      /University of California,?\s*Los Angeles/i,
      /\bUCLA\b/i,
    ],
  },
  {
    institution_id: "ucsd",
    patterns: [
      /University of California,?\s*San Diego/i,
      /\bUCSD\b/i,
      /\bUC\s*San Diego\b/i,
    ],
  },
  {
    institution_id: "umich",
    patterns: [/University of Michigan/i, /\bUMich\b/i],
  },
  {
    institution_id: "uiuc",
    patterns: [
      /University of Illinois(?:,?|\s+at)?\s*Urbana-Champaign/i,
      /\bUIUC\b/i,
    ],
  },
  { institution_id: "uwash", patterns: [/University of Washington/i] },
  {
    institution_id: "ut_austin",
    patterns: [/University of Texas at Austin/i, /\bUT\s*Austin\b/i],
  },
  {
    institution_id: "mit",
    patterns: [/\bMIT\b/i, /Massachusetts Institute of Technology/i],
  },
  {
    institution_id: "stanford",
    patterns: [/Stanford University/i, /\bStanford\b/i],
  },
  {
    institution_id: "cmu",
    patterns: [/Carnegie Mellon University/i, /Carnegie Mellon/i, /\bCMU\b/i],
  },
  {
    institution_id: "caltech",
    patterns: [/California Institute of Technology/i, /\bCaltech\b/i],
  },
  {
    institution_id: "gatech",
    patterns: [/Georgia Institute of Technology/i, /Georgia Tech/i],
  },
  {
    institution_id: "harvard",
    patterns: [/Harvard University/i, /\bHarvard\b/i],
  },
  {
    institution_id: "princeton",
    patterns: [/Princeton University/i, /\bPrinceton\b/i],
  },
  {
    institution_id: "yale",
    patterns: [/Yale University/i, /\bYale\b/i],
  },
  {
    institution_id: "columbia",
    patterns: [/Columbia University/i],
  },
  {
    institution_id: "cornell",
    patterns: [/Cornell University/i, /\bCornell\b/i],
  },
  {
    institution_id: "uchicago",
    patterns: [/University of Chicago/i, /\bUChicago\b/i],
  },
  {
    institution_id: "duke",
    patterns: [/Duke University/i, /\bDuke\b/i],
  },
  {
    institution_id: "penn",
    patterns: [/University of Pennsylvania/i, /\bUPenn\b/i],
  },
];

const ARXIV_CATEGORY_QUERY = "(cat:cs.LG OR cat:cs.CL OR cat:cs.AI OR cat:cs.SE)";
const FEED_PAGE_SIZE = 2000;

function formatArxivSubmittedDate(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

function buildSubmittedDateWindow(now: Date): { from: string; to: string } {
  const end = new Date(now.getTime());
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - 12);
  return {
    from: `${formatArxivSubmittedDate(start)}0000`,
    to: `${formatArxivSubmittedDate(end)}2359`,
  };
}

function decodeBasicXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function normalizeDhvcPersonName(name: string): string {
  return decodeBasicXmlEntities(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\u2019'`-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchAffiliationToDhvcTopUsInstitution(
  affiliation: string
): string | null {
  const t = affiliation.trim();
  if (!t) return null;
  for (const rule of DHVC_TOP_20_US_AFFILIATION_RULES) {
    for (const p of rule.patterns) {
      if (p.test(t)) return rule.institution_id;
    }
  }
  return null;
}

function splitFeedEntries(feedXml: string): string[] {
  const entries: string[] = [];
  const re = /<entry>\s*([\s\S]*?)\s*<\/entry>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(feedXml)) !== null) {
    entries.push(m[0]);
  }
  return entries;
}

function parseOpenSearchTotalResults(feedXml: string): number | null {
  const m = feedXml.match(
    /<opensearch:totalResults>\s*(\d+)\s*<\/opensearch:totalResults>/
  );
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function parseFirstAuthor(entryXml: string): {
  name: string;
  affiliation?: string;
} | null {
  const m = entryXml.match(/<author>\s*([\s\S]*?)\s*<\/author>/);
  if (!m) return null;
  const block = m[1];
  const nameM = block.match(/<name>\s*([^<]*?)\s*<\/name>/);
  if (!nameM) return null;
  const name = decodeBasicXmlEntities(nameM[1]).replace(/\s+/g, " ").trim();
  const affM = block.match(
    /<arxiv:affiliation>\s*([^<]*?)\s*<\/arxiv:affiliation>/
  );
  const affiliation = affM
    ? decodeBasicXmlEntities(affM[1]).replace(/\s+/g, " ").trim()
    : undefined;
  if (!name) return null;
  return { name, affiliation };
}

function extractAbsUrl(entryXml: string): string | null {
  const m = entryXml.match(
    /<link[^>]+href="(https:\/\/arxiv\.org\/abs\/[^"]+)"[^>]*rel="alternate"/
  );
  if (m) return m[1];
  const m2 = entryXml.match(
    /<link[^>]+rel="alternate"[^>]+href="(https:\/\/arxiv\.org\/abs\/[^"]+)"/
  );
  return m2?.[1] ?? null;
}

function extractTitle(entryXml: string): string {
  const m = entryXml.match(/<entry>[\s\S]*?<title>\s*([^<]*?)\s*<\/title>/);
  const raw = m?.[1] ?? "";
  return decodeBasicXmlEntities(raw).replace(/\s+/g, " ").trim();
}

function extractPrimaryCategory(entryXml: string): string | null {
  const m = entryXml.match(/<arxiv:primary_category\s+term="([^"]+)"/);
  return m?.[1] ?? null;
}

function inferMajorFromArxivCategory(term: string | null): string | undefined {
  if (!term) return undefined;
  if (term.startsWith("cs.")) return "Computer Science";
  return undefined;
}

function affiliationLooksFaculty(affiliation: string): boolean {
  return /\b(Professor|Prof\.|Faculty|Chair|Lecturer)\b/i.test(affiliation);
}

async function defaultLoadProfessorNameKeys(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("professors")
    .select("name");
  if (error) {
    throw new Error(`professors: ${error.message}`);
  }
  return new Set(
    (data ?? []).map((r) => normalizeDhvcPersonName(r.name as string))
  );
}

export interface ArxivUndergradsDeps {
  /** Override arXiv HTTP (defaults to shared `fetchArxivApi` from `arxiv.ts`). */
  fetchArxivFeedXml?: (params: Record<string, string>) => Promise<string>;
  loadProfessorNameKeys?: () => Promise<Set<string>>;
  now?: () => Date;
  /** Tests: set low to exercise pagination without 2k-entry fixtures. */
  feedPageSize?: number;
}

/**
 * Discover DHVC drafts from arXiv first-author CS papers at top-20 US schools,
 * excluding authors who match existing `professors` rows.
 */
export async function discoverFromArxivUndergrads(
  deps: ArxivUndergradsDeps = {}
): Promise<DhvcCandidateDraft[]> {
  const now = deps.now?.() ?? new Date();
  const observedAt = now.toISOString();
  const { from, to } = buildSubmittedDateWindow(now);
  const searchQuery = `${ARXIV_CATEGORY_QUERY} AND submittedDate:[${from} TO ${to}]`;

  const pageSize = deps.feedPageSize ?? FEED_PAGE_SIZE;

  const fetchXml =
    deps.fetchArxivFeedXml ??
    ((params: Record<string, string>) => fetchArxivApi(params));

  const professorKeys = await (
    deps.loadProfessorNameKeys ?? defaultLoadProfessorNameKeys
  )();

  const draftsByKey = new Map<string, DhvcCandidateDraft>();

  let start = 0;
  let total: number | null = null;

  for (;;) {
    const xml = await fetchXml({
      search_query: searchQuery,
      start: String(start),
      max_results: String(pageSize),
      sortBy: "submittedDate",
      sortOrder: "descending",
    });

    if (total === null) {
      total = parseOpenSearchTotalResults(xml);
    }

    const entryXmls = splitFeedEntries(xml);
    if (entryXmls.length === 0) break;

    for (const entryXml of entryXmls) {
      const author = parseFirstAuthor(entryXml);
      if (!author?.affiliation) continue;
      if (affiliationLooksFaculty(author.affiliation)) continue;

      const institution_id = matchAffiliationToDhvcTopUsInstitution(
        author.affiliation
      );
      if (!institution_id) continue;

      const nameKey = normalizeDhvcPersonName(author.name);
      if (!nameKey || professorKeys.has(nameKey)) continue;

      const absUrl = extractAbsUrl(entryXml);
      if (!absUrl) continue;
      const title = extractTitle(entryXml);
      const primaryCategory = extractPrimaryCategory(entryXml);
      const major = inferMajorFromArxivCategory(primaryCategory);

      const key = `${institution_id}::${nameKey}`;
      if (draftsByKey.has(key)) continue;

      draftsByKey.set(key, {
        institution_id,
        name: author.name,
        primary_source: "arxiv",
        source_urls: [
          {
            url: absUrl,
            source: "arxiv",
            observed_at: observedAt,
            description: title
              ? `First author on "${title}"`
              : "First author on arXiv paper",
          },
        ],
        graduation_year: undefined,
        major,
      });
    }

    start += entryXmls.length;
    if (entryXmls.length < pageSize) break;
    if (total !== null && start >= total) break;
  }

  return [...draftsByKey.values()];
}
