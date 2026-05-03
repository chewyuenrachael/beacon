// @ownership dhvc-module

import type { DhvcCandidateDraft, DhvcSourceUrl } from "@/lib/types";

const API_BASE = "https://api.github.com";

/** Top-20 US CS targets (Beacon `institution_id` slug + GitHub Search `location:"…"` probe). */
const TOP_US_CS_SCHOOLS = [
  {
    institution_id: "mit",
    searchLocation: "MIT",
    profileMatch: profileBlobMatches(/massachusetts institute of technology|\bmit\b/i),
  },
  {
    institution_id: "stanford",
    searchLocation: "Stanford University",
    profileMatch: profileBlobMatches(/\bstanford\b/i),
  },
  {
    institution_id: "cmu",
    searchLocation: "Carnegie Mellon University",
    profileMatch: profileBlobMatches(/\bcmu\b|carnegie mellon/i),
  },
  {
    institution_id: "berkeley",
    searchLocation: "Berkeley, CA",
    profileMatch: profileBlobMatches(
      /\buc berkeley\b|university of california,? berkeley|\bberkeley\b/i
    ),
  },
  {
    institution_id: "columbia",
    searchLocation: "Columbia University",
    profileMatch: profileBlobMatches(/\bcolumbia\b/i),
  },
  {
    institution_id: "cornell",
    searchLocation: "Cornell University",
    profileMatch: profileBlobMatches(/\bcornell\b/i),
  },
  {
    institution_id: "princeton",
    searchLocation: "Princeton University",
    profileMatch: profileBlobMatches(/\bprinceton\b/i),
  },
  {
    institution_id: "caltech",
    searchLocation: "California Institute of Technology",
    profileMatch: profileBlobMatches(/\bcaltech\b|california institute of technology/i),
  },
  {
    institution_id: "gatech",
    searchLocation: "Georgia Institute of Technology",
    profileMatch: profileBlobMatches(
      /\bgatech\b|georgia institute of technology|\bgeorgia tech\b/i
    ),
  },
  {
    institution_id: "uiuc",
    searchLocation: "Champaign, IL",
    profileMatch: profileBlobMatches(
      /\buiuc\b|university of illinois|urbana.?champaign/i
    ),
  },
  {
    institution_id: "umich",
    searchLocation: "University of Michigan",
    profileMatch: profileBlobMatches(/\bumich\b|university of michigan|\bmichigan\b/i),
  },
  {
    institution_id: "uwash",
    searchLocation: "Seattle, WA",
    profileMatch: profileBlobMatches(
      /\buw\b|university of washington|uw seattle|^washington(?![, ]dc)/i
    ),
  },
  {
    institution_id: "ucla",
    searchLocation: "Los Angeles, CA",
    profileMatch: profileBlobMatches(/\bucla\b|university of california,? los angeles/i),
  },
  {
    institution_id: "uchicago",
    searchLocation: "University of Chicago",
    profileMatch: profileBlobMatches(/\buchicago\b|university of chicago|\buchi\b/i),
  },
  {
    institution_id: "harvard",
    searchLocation: "Harvard University",
    profileMatch: profileBlobMatches(/\bharvard\b/i),
  },
  {
    institution_id: "duke",
    searchLocation: "Duke University",
    profileMatch: profileBlobMatches(/\bduke\b/i),
  },
  {
    institution_id: "penn",
    searchLocation: "University of Pennsylvania",
    profileMatch: profileBlobMatches(
      /\bupenn\b|university of pennsylvania|\bpenn\b(?!\s*state)/i
    ),
  },
  {
    institution_id: "ucsd",
    searchLocation: "La Jolla, CA",
    profileMatch: profileBlobMatches(
      /\bucsd\b|university of california,? san diego/i
    ),
  },
  {
    institution_id: "utaustin",
    searchLocation: "Austin, TX",
    profileMatch: profileBlobMatches(/\but austin\b|university of texas at austin|\butexas\b/i),
  },
  {
    institution_id: "yale",
    searchLocation: "Yale University",
    profileMatch: profileBlobMatches(/\byale\b/i),
  },
] as const;

const COMMITS_THRESHOLD = 50;
const STARS_THRESHOLD = 100;
const TWELVE_MONTH_MS = 365 * 24 * 60 * 60 * 1000;

const SEARCH_PER_PAGE = 100;
/** Cap pages per school so a single run stays bounded vs rate limits & noise. */
const MAX_SEARCH_PAGES = 4;

/** Search API: ~10/min unauthenticated; ~30/min with token. Conservative spacing. */
function githubMinSpacingMs(): number {
  if (process.env.VITEST === "true") return 0;
  return process.env.GITHUB_TOKEN ? 2100 : 6500;
}

let lastGithubRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function throttleGithub(): Promise<void> {
  const min = githubMinSpacingMs();
  const now = Date.now();
  const elapsed = now - lastGithubRequestAt;
  if (elapsed < min) await sleep(min - elapsed);
  lastGithubRequestAt = Date.now();
}

function profileBlobMatches(re: RegExp): (blob: string) => boolean {
  return (blob: string) => re.test(blob);
}

interface GhUser {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  email: string | null;
}

interface GhRepoEvent {
  type: string;
  created_at: string;
  repo?: { id?: number; name?: string; url?: string };
  payload?: { size?: number; push_id?: number };
}

interface SearchUsersResult {
  items: { login: string }[];
}

function isoNow(): string {
  return new Date().toISOString();
}

async function ghFetch(url: string, token: string | undefined): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Beacon/0.1 (DHVC; +https://github.com/beacon-internal)",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let backoffMs = 1000;
  let lastStatus = 0;

  for (let attempt = 0; attempt < 8; attempt++) {
    const fetchStartedAt = Date.now();
    await throttleGithub();
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    process.stderr.write(
      `[github-students] ${res.status} ${url} (${Date.now() - fetchStartedAt}ms, rl=${
        res.headers.get("x-ratelimit-remaining") ?? "?"
      })\n`
    );

    if (res.status === 429 || res.status === 403) {
      const retryAfter = res.headers.get("retry-after");
      const reset = res.headers.get("x-ratelimit-reset");
      const waitFromHeader = retryAfter
        ? Number.parseInt(retryAfter, 10) * 1000
        : reset
          ? Math.max(
              0,
              Number.parseInt(reset, 10) * 1000 - Date.now() + Math.random() * 500
            )
          : backoffMs;
      const computedSleep = Math.min(120_000, Math.max(backoffMs, waitFromHeader));
      await sleep(computedSleep);
      backoffMs = Math.min(backoffMs * 2, 120_000);
      continue;
    }

    if (res.ok || res.status < 500) return res;

    await sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 2, 120_000);
  }

  throw new Error(`GitHub request failed after retries (last HTTP ${lastStatus})`);
}

async function readJsonOk<T>(
  url: string,
  token: string | undefined,
  ctx: string
): Promise<T> {
  const res = await ghFetch(url, token);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${ctx}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function searchUsersPage(
  school: (typeof TOP_US_CS_SCHOOLS)[number],
  page: number,
  token: string | undefined
): Promise<SearchUsersResult> {
  const q = `location:"${school.searchLocation.replace(/"/g, "")}" type:user`;
  const u = new URL(`${API_BASE}/search/users`);
  u.searchParams.set("q", q);
  u.searchParams.set("per_page", String(SEARCH_PER_PAGE));
  u.searchParams.set("page", String(page));
  return readJsonOk<SearchUsersResult>(u.toString(), token, "GitHub search/users");
}

async function fetchUser(login: string, token: string | undefined): Promise<GhUser> {
  const url = `${API_BASE}/users/${encodeURIComponent(login)}`;
  return readJsonOk<GhUser>(url, token, `GitHub users/${login}`);
}

async function fetchEvents(login: string, token: string | undefined): Promise<GhRepoEvent[]> {
  const url = `${API_BASE}/users/${encodeURIComponent(login)}/events?per_page=100`;
  return readJsonOk<GhRepoEvent[]>(url, token, `GitHub users/${login}/events`);
}

async function fetchStars(
  fullName: string,
  token: string | undefined,
  cache: Map<string, number>
): Promise<number> {
  const hit = cache.get(fullName);
  if (hit !== undefined) return hit;
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return 0;

  interface RepoPayload {
    stargazers_count?: number;
  }

  const data = await readJsonOk<RepoPayload>(
    `${API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    token,
    `GitHub repos/${fullName}`
  );
  const n = typeof data.stargazers_count === "number" ? data.stargazers_count : 0;
  cache.set(fullName, n);
  return n;
}

function commitsInWindow(events: GhRepoEvent[], sinceMs: number): number {
  let total = 0;
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = Date.parse(e.created_at);
    if (Number.isNaN(t) || t < sinceMs) continue;
    const size = typeof e.payload?.size === "number" ? e.payload.size : 0;
    total += size;
  }
  return total;
}

async function hasPopularRepoContribution(
  events: GhRepoEvent[],
  sinceMs: number,
  token: string | undefined,
  starCache: Map<string, number>
): Promise<{ fullName?: string; stars?: number }> {
  const seenRepo = new Set<string>();
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const t = Date.parse(e.created_at);
    if (Number.isNaN(t) || t < sinceMs) continue;
    const name = e.repo?.name;
    if (!name || seenRepo.has(name)) continue;
    seenRepo.add(name);
    const stars = await fetchStars(name, token, starCache);
    if (stars >= STARS_THRESHOLD) return { fullName: name, stars };
  }
  return {};
}

function candidateDraft(opts: {
  school: (typeof TOP_US_CS_SCHOOLS)[number];
  user: GhUser;
  qualifyingRepo?: string;
  stars?: number;
}): DhvcCandidateDraft {
  const login = opts.user.login;
  const repoBit =
    opts.qualifyingRepo && opts.stars != null
      ? `; popular repo touchpoint ${opts.qualifyingRepo} (${opts.stars}+ stars)`
      : "";

  const sourceUrls: DhvcSourceUrl[] = [
    {
      url: `https://github.com/${login}`,
      source: "github",
      observed_at: isoNow(),
      description:
        `GitHub profile matched ${opts.school.searchLocation} (${opts.school.institution_id})${repoBit}`,
    },
  ];

  if (opts.qualifyingRepo) {
    sourceUrls.push({
      url: `https://github.com/${opts.qualifyingRepo}`,
      source: "github",
      observed_at: isoNow(),
      description: `Contribution activity on ${opts.qualifyingRepo} (≥ ${STARS_THRESHOLD} GitHub stars)`,
    });
  }

  const displayName = opts.user.name?.trim() || login;

  const draft: DhvcCandidateDraft = {
    institution_id: opts.school.institution_id,
    name: displayName,
    github_username: login,
    primary_source: "github",
    source_urls: sourceUrls,
  };

  if (opts.user.email) draft.email = opts.user.email;
  return draft;
}

export async function discoverFromGitHubStudents(): Promise<DhvcCandidateDraft[]> {
  const token = process.env.GITHUB_TOKEN?.trim() || undefined;
  const cutoff = Date.now() - TWELVE_MONTH_MS;
  const drafts: DhvcCandidateDraft[] = [];
  const seenLogin = new Set<string>();
  const starCache = new Map<string, number>();

  for (const school of TOP_US_CS_SCHOOLS) {
    process.stderr.write(`[github-students] >>> school: ${school.institution_id} (drafts so far: ${drafts.length})\n`);
    for (let page = 1; page <= MAX_SEARCH_PAGES; page++) {
      process.stderr.write(`[github-students]   page ${page}/${MAX_SEARCH_PAGES}\n`);
      let batch: SearchUsersResult;
      try {
        batch = await searchUsersPage(school, page, token);
      } catch {
        break;
      }
      const items = batch.items ?? [];
      if (items.length === 0) break;

      for (const row of items) {
        const login = row.login;
        if (!login || seenLogin.has(login)) continue;

        let profile: GhUser;
        try {
          profile = await fetchUser(login, token);
        } catch {
          continue;
        }

        const blob = `${profile.location ?? ""} ${profile.bio ?? ""}`;
        if (!school.profileMatch(blob)) continue;

        let events: GhRepoEvent[];
        try {
          events = await fetchEvents(login, token);
        } catch {
          continue;
        }

        const commits = commitsInWindow(events, cutoff);
        if (commits < COMMITS_THRESHOLD) continue;

        const popular = await hasPopularRepoContribution(events, cutoff, token, starCache);
        if (!popular.fullName || popular.stars == null) continue;

        seenLogin.add(login);
        drafts.push(
          candidateDraft({
            school,
            user: profile,
            qualifyingRepo: popular.fullName,
            stars: popular.stars,
          })
        );
        process.stderr.write(
          `[github-students]     + draft: ${login} (${school.institution_id}) commits=${commits} stars=${popular.stars} repo=${popular.fullName}\n`
        );
      }

      if (items.length < SEARCH_PER_PAGE) break;
    }
  }

  process.stderr.write(`[github-students] DONE: ${drafts.length} drafts\n`);
  return drafts;
}
