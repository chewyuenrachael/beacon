import Parser from "rss-parser";
import { z } from "zod";

const ARXIV_API = "https://export.arxiv.org/api/query";

/** Minimum gap between arXiv HTTP calls (stack: 1 req / 3s). */
export const ARXIV_MIN_INTERVAL_MS = 3000;

/** Backoff delays after retryable arXiv failures (mirrors Devpost scraper pattern). */
const ARXIV_RETRY_BACKOFF_MS = [30_000, 60_000, 120_000] as const;

let lastArxivRequestTime = 0;

export async function throttleArxiv(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastArxivRequestTime;
  if (elapsed < ARXIV_MIN_INTERVAL_MS) {
    await new Promise((r) =>
      setTimeout(r, ARXIV_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastArxivRequestTime = Date.now();
}

const ARXIV_FETCH_HEADERS = {
  "user-agent": "Beacon/0.1 (internal; +https://example.invalid)",
} as const;

/**
 * GET the arXiv Atom API with shared throttling and retry/backoff on 429 / 5xx.
 */
export async function fetchArxivApi(
  params: Record<string, string>,
  init?: RequestInit
): Promise<string> {
  const url = new URL(ARXIV_API);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const maxAttempts = 1 + ARXIV_RETRY_BACKOFF_MS.length;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await throttleArxiv();
    const res = await fetch(url.toString(), {
      ...init,
      headers: ARXIV_FETCH_HEADERS,
    });

    if (res.ok) {
      return res.text();
    }

    const retryable =
      res.status === 429 || res.status === 503 || res.status >= 500;
    if (retryable && attempt < ARXIV_RETRY_BACKOFF_MS.length) {
      await new Promise((r) =>
        setTimeout(r, ARXIV_RETRY_BACKOFF_MS[attempt])
      );
      continue;
    }

    throw new Error(`arXiv API HTTP ${res.status}`);
  }

  throw new Error("arXiv API: exhausted retries");
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
  const searchQuery = buildArxivAuthorSearchQuery(arxivAuthorId);
  const xml = await fetchArxivApi({
    search_query: searchQuery,
    start: "0",
    max_results: String(maxResults),
    sortBy: "submittedDate",
    sortOrder: "descending",
  });
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
