// @ownership dhvc-module

import * as cheerio from "cheerio";
import fetch from "node-fetch";

import type { DhvcCandidateDraft, DhvcSourceUrl } from "@/lib/types";

/** Minimum gap between Devpost HTTP calls (2 req/sec cap). */
export const DEVPOST_MIN_INTERVAL_MS = 500;

const RATE_LIMIT_BACKOFF_MS = [30_000, 60_000, 120_000] as const;

const USER_AGENT =
  "Beacon/0.1 (internal campus sourcing; +https://github.com/beacon)";

/**
 * Top-tier US CS schools used in DHVC scoring (`lib/dhvc-scoring.ts` tiers).
 * Maps free-text school strings from Devpost profiles to `institutions.id`.
 */
const SCHOOL_RESOLVERS: Array<{ id: string; test: RegExp }> = [
  { id: "mit", test: /\b(mit|massachusetts institute of technology)\b/i },
  { id: "stanford", test: /\bstanford\b/i },
  {
    id: "cmu",
    test: /\b(cmu|carnegie mellon)\b/i,
  },
  { id: "berkeley", test: /\b(uc berkeley|berkeley|ucb)\b/i },
  { id: "columbia", test: /\bcolumbia\b/i },
  { id: "cornell", test: /\bcornell\b/i },
  { id: "princeton", test: /\bprinceton\b/i },
  { id: "caltech", test: /\bcaltech\b/i },
  {
    id: "gatech",
    test: /\b(georgia tech|georgia institute|gatech)\b/i,
  },
  {
    id: "uiuc",
    test: /\b(uiuc|university of illinois|illinois urbana)\b/i,
  },
  {
    id: "umich",
    test: /\b(umich|university of michigan)\b/i,
  },
  {
    id: "uwash",
    test: /\b(uwash|university of washington)\b/i,
  },
  { id: "ucla", test: /\bucla\b/i },
  { id: "uchicago", test: /\b(uchicago|university of chicago)\b/i },
  { id: "harvard", test: /\bharvard\b/i },
];

export const HACKATHON_URLS = [
  "https://hackmit-2024.devpost.com/project-gallery",
  "https://hackmit-2025.devpost.com/project-gallery",
  "https://treehacks-2025.devpost.com/project-gallery",
  "https://pennapps-2024.devpost.com/project-gallery",
  "https://pennapps-2025.devpost.com/project-gallery",
  "https://calhacks-2024.devpost.com/project-gallery",
  "https://calhacks-2025.devpost.com/project-gallery",
  "https://hackharvard-2024.devpost.com/project-gallery",
  "https://hackharvard-2025.devpost.com/project-gallery",
  "https://hackgt-2024.devpost.com/project-gallery",
  "https://shellhacks-2024.devpost.com/project-gallery",
  "https://hackprinceton-2024.devpost.com/project-gallery",
  "https://hackprinceton-2025.devpost.com/project-gallery",
  "https://makeharvard-2025.devpost.com/project-gallery",
  "https://boilermake-2025.devpost.com/project-gallery",
] as const;

let lastDevpostRequestTime = 0;

function throttleGapMs(): number {
  const raw = process.env.BEACON_DEVPOST_THROTTLE_MS;
  if (raw === undefined || raw === "") return DEVPOST_MIN_INTERVAL_MS;
  const n = Number(raw);
  return Number.isFinite(n) ? n : DEVPOST_MIN_INTERVAL_MS;
}

async function throttleDevpost(): Promise<void> {
  const minGap = throttleGapMs();
  const now = Date.now();
  const elapsed = now - lastDevpostRequestTime;
  if (elapsed < minGap) {
    await new Promise((r) => setTimeout(r, minGap - elapsed));
  }
  lastDevpostRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function resolveDevpostInstitutionId(
  schoolRaw: string | undefined
): string | null {
  if (!schoolRaw) return null;
  const s = schoolRaw.replace(/\s+/g, " ").trim();
  if (!s) return null;
  for (const { id, test } of SCHOOL_RESOLVERS) {
    if (test.test(s)) return id;
  }
  return null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function githubUsernameFromHref(href: string): string | undefined {
  try {
    const u = new URL(href);
    if (!/^github\.com$/i.test(u.hostname.replace(/^www\./i, "")))
      return undefined;
    const parts = u.pathname.split("/").filter(Boolean);
    const user = parts[0];
    if (!user || /^(features|settings|orgs|topics)$/i.test(user))
      return undefined;
    return user;
  } catch {
    return undefined;
  }
}

function twitterHandleFromHref(href: string): string | undefined {
  try {
    const u = new URL(href);
    if (!/^(twitter\.com|x\.com)$/i.test(u.hostname)) return undefined;
    const parts = u.pathname.split("/").filter(Boolean);
    const h = parts[0];
    if (!h || /^(intent|share|home|i)$/i.test(h)) return undefined;
    return h.replace(/^@/, "");
  } catch {
    return undefined;
  }
}

function hackathonDescriptionLabel(galleryUrl: string): string {
  try {
    const host = new URL(galleryUrl).hostname;
    const slug = host.replace(/\.devpost\.com$/i, "");
    const withSpaces = slug.replace(/-/g, " ");
    return withSpaces.replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Devpost";
  }
}

async function fetchDevpostHtml(
  url: string,
  attempt = 0
): Promise<string> {
  await throttleDevpost();
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    redirect: "follow",
  });

  if (res.status === 429 && attempt < RATE_LIMIT_BACKOFF_MS.length) {
    await sleep(RATE_LIMIT_BACKOFF_MS[attempt]);
    return fetchDevpostHtml(url, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Devpost HTTP ${res.status} for ${url}`);
  }

  return res.text();
}

function extractFinalistSubmissionUrls(
  html: string,
  galleryUrl: string
): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const base = new URL(galleryUrl);

  $("a[href*='/submissions/']").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const card = $(el).closest(
      "article, li, [class*='gallery'], [class*='software'], [class*='item'], tr, div"
    );
    const contextText = `${card.text()} ${$(el).text()}`;
    if (!/\b(winner|finalist|runner|prize|track winner|honorable mention)\b/i.test(
      contextText
    )) {
      return;
    }
    const abs = new URL(href, base).toString();
    seen.add(abs.split("#")[0]);
  });

  return [...seen];
}

function pickSubmissionTitle($: cheerio.CheerioAPI): string | undefined {
  const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (h1) return h1;
  const og = $('meta[property="og:title"]').attr("content")?.trim();
  return og || undefined;
}

function extractParticipantProfileUrls(
  html: string,
  submissionUrl: string
): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const base = new URL(submissionUrl);

  const teamRoot = $(
    "#software-team, .software-team, [data-region='Team'], [id*='team-']"
  ).first();
  const scope = teamRoot.length ? teamRoot : $("main, article").first();

  scope.find("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    if (href.includes("/submissions/")) return;
    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      return;
    }
    if (!/devpost\.com$/i.test(abs.hostname)) return;
    const segments = abs.pathname.split("/").filter(Boolean);
    if (segments.length !== 1) return;
    const [slug] = segments;
    if (
      /^(software|hackathons|settings|login|signup|organizations|help|api|users)$/i.test(
        slug
      )
    ) {
      return;
    }
    seen.add(`${abs.origin}/${slug}`);
  });

  return [...seen];
}

function extractSchoolLine($: cheerio.CheerioAPI): string | undefined {
  const fromMeta = $("[data-school]").attr("data-school")?.trim();
  if (fromMeta) return fromMeta;
  const bodyText = $("body").text().replace(/\s+/g, " ");
  const m = bodyText.match(
    /\b(?:student|studying)\s+at\s+([^\n.|]+?)(?:\s*[.|]|\s+[-–]\s|$)/i
  );
  return m?.[1]?.trim();
}

function parseParticipantProfile(
  html: string,
  profileUrl: string,
  projectUrl: string,
  hackathonLabel: string,
  projectTitle: string
): DhvcCandidateDraft | null {
  const $ = cheerio.load(html);
  const name =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $("[itemprop=name]").first().text().replace(/\s+/g, " ").trim();
  if (!name) return null;

  const school =
    extractSchoolLine($) ??
    $(".education, .school, [class*='education']")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
  const institutionId = resolveDevpostInstitutionId(school);
  if (!institutionId) return null;

  let github_username: string | undefined;
  let twitter_handle: string | undefined;
  let email: string | undefined;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const gh = githubUsernameFromHref(href);
    if (gh) github_username = gh;
    const tw = twitterHandleFromHref(href);
    if (tw) twitter_handle = tw;
    if (href.startsWith("mailto:")) {
      email = decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0]);
    }
  });

  if (!github_username && !twitter_handle && !email) return null;

  const observedAt = new Date().toISOString();
  const sourceUrl: DhvcSourceUrl = {
    url: projectUrl,
    source: "devpost",
    observed_at: observedAt,
    description: `${hackathonLabel} finalist — ${projectTitle}`,
  };

  return {
    institution_id: institutionId,
    name,
    email,
    github_username,
    twitter_handle,
    primary_source: "devpost",
    source_urls: [sourceUrl],
  };
}

function mergeDrafts(a: DhvcCandidateDraft, b: DhvcCandidateDraft): void {
  a.email ??= b.email;
  a.github_username ??= b.github_username;
  a.twitter_handle ??= b.twitter_handle;
  a.graduation_year ??= b.graduation_year;
  a.major ??= b.major;
  const urls = new Map<string, DhvcSourceUrl>();
  for (const u of [...a.source_urls, ...b.source_urls]) {
    urls.set(u.url, u);
  }
  a.source_urls = [...urls.values()];
}

export function dedupeDevpostDrafts(
  drafts: DhvcCandidateDraft[]
): DhvcCandidateDraft[] {
  const map = new Map<string, DhvcCandidateDraft>();
  for (const d of drafts) {
    const key = `${normalizeName(d.name)}|${d.institution_id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...d,
        source_urls: [...d.source_urls],
      });
    } else {
      mergeDrafts(existing, d);
    }
  }
  return [...map.values()];
}

export async function scrapeHackathonFinalists(
  galleryUrl: string
): Promise<DhvcCandidateDraft[]> {
  const hackathonLabel = hackathonDescriptionLabel(galleryUrl);
  const galleryHtml = await fetchDevpostHtml(galleryUrl);
  const submissionUrls = extractFinalistSubmissionUrls(galleryHtml, galleryUrl);
  const out: DhvcCandidateDraft[] = [];

  for (const submissionUrl of submissionUrls) {
    try {
      const subHtml = await fetchDevpostHtml(submissionUrl);
      const $sub = cheerio.load(subHtml);
      const projectTitle =
        pickSubmissionTitle($sub) ?? new URL(submissionUrl).pathname;
      const profileUrls = extractParticipantProfileUrls(subHtml, submissionUrl);

      for (const profileUrl of profileUrls) {
        try {
          const profileHtml = await fetchDevpostHtml(profileUrl);
          const draft = parseParticipantProfile(
            profileHtml,
            profileUrl,
            submissionUrl,
            hackathonLabel,
            projectTitle
          );
          if (draft) out.push(draft);
        } catch {
          /* per-profile failure — continue */
        }
      }
    } catch {
      /* per-submission failure — continue */
    }
  }

  return out;
}

export async function discoverFromDevpost(): Promise<DhvcCandidateDraft[]> {
  const drafts: DhvcCandidateDraft[] = [];
  for (const url of HACKATHON_URLS) {
    const finalists = await scrapeHackathonFinalists(url);
    drafts.push(...finalists);
  }
  return dedupeDevpostDrafts(drafts);
}
