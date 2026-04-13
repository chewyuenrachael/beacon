import Parser from "rss-parser";
import { z } from "zod";

const ARXIV_API = "http://export.arxiv.org/api/query";

/** Minimum gap between arXiv HTTP calls (stack: 1 req / 3s). */
const ARXIV_MIN_INTERVAL_MS = 3000;

let lastArxivRequestTime = 0;

async function throttleArxiv(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastArxivRequestTime;
  if (elapsed < ARXIV_MIN_INTERVAL_MS) {
    await new Promise((r) =>
      setTimeout(r, ARXIV_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastArxivRequestTime = Date.now();
}

/**
 * Build `search_query` fragment for the arXiv API.
 * If `arxivAuthorId` contains `:`, treat it as a full search_query (already prefixed).
 * Otherwise wrap as disambiguated author phrase: au:"…"
 */
export function buildArxivAuthorSearchQuery(arxivAuthorId: string): string {
  const trimmed = arxivAuthorId.trim();
  if (trimmed.includes(":")) return trimmed;
  const inner = trimmed.replace(/"/g, "");
  return `au:\"${inner}\"`;
}

const paperSchema = z.object({
  arxivId: z.string(),
  title: z.string(),
  abstract: z.string(),
  publishedAt: z.string(),
  url: z.string().min(1),
});

export type ArxivPaper = z.infer<typeof paperSchema>;

const feedItemSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    link: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    contentSnippet: z.string().optional(),
    pubDate: z.string().optional(),
    published: z.string().optional(),
    isoDate: z.string().optional(),
  })
  .passthrough();

function stripTitleNoise(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function extractAbsUrl(item: z.infer<typeof feedItemSchema>): string | null {
  const link = item.link ?? "";
  if (link.includes("arxiv.org/abs/")) {
    return link.replace(/^http:\/\//, "https://");
  }
  const id = item.id ?? "";
  const m = id.match(/arxiv\.org\/abs\/([^?\s#]+)/i);
  if (m) return `https://arxiv.org/abs/${m[1]}`;
  return null;
}

function extractArxivIdFromUrl(absUrl: string): string {
  const m = absUrl.match(/arxiv\.org\/abs\/([^/?#]+)/i);
  return m?.[1] ?? absUrl;
}

function pickAbstract(item: z.infer<typeof feedItemSchema>): string {
  const s = item.summary ?? item.content ?? item.contentSnippet ?? "";
  return s.replace(/\s+/g, " ").trim();
}

function pickPublished(item: z.infer<typeof feedItemSchema>): string {
  const raw =
    item.isoDate ?? item.published ?? item.pubDate ?? new Date().toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * Fetch the N most recent papers for an author from the arXiv Atom API.
 */
export async function fetchRecentPapers(
  arxivAuthorId: string,
  maxResults = 20
): Promise<ArxivPaper[]> {
  await throttleArxiv();

  const searchQuery = buildArxivAuthorSearchQuery(arxivAuthorId);
  const url = new URL(ARXIV_API);
  url.searchParams.set("search_query", searchQuery);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(maxResults));
  url.searchParams.set("sortBy", "submittedDate");
  url.searchParams.set("sortOrder", "descending");

  const res = await fetch(url.toString(), {
    headers: { "user-agent": "Beacon/0.1 (internal; +https://example.invalid)" },
  });
  if (!res.ok) {
    throw new Error(`arXiv API HTTP ${res.status}`);
  }

  const xml = await res.text();
  const parser = new Parser({
    customFields: { item: ["summary", "published", "id", "arxiv:doi"] },
  });
  const feed = await parser.parseString(xml);

  const papers: ArxivPaper[] = [];
  for (const raw of feed.items ?? []) {
    const parsed = feedItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const title = stripTitleNoise(item.title ?? "");
    const absUrl = extractAbsUrl(item);
    if (!title || !absUrl) continue;

    const abstract = pickAbstract(item);
    const publishedAt = pickPublished(item);
    const arxivId = extractArxivIdFromUrl(absUrl);

    const candidate = {
      arxivId,
      title,
      abstract,
      publishedAt,
      url: absUrl,
    };
    const validated = paperSchema.safeParse(candidate);
    if (validated.success) papers.push(validated.data);
  }

  return papers.slice(0, maxResults);
}
