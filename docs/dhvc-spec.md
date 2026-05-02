# DHVC Curation Module — Technical Spec

**Author:** Rachael Chew
**For:** Cursor SDK cloud agent (Claude Opus or Composer 2)
**Repo:** `/Users/rachaelchew/beacon`
**Branch:** `dhvc-module`
**Build target:** ship to Beacon `main`, deployable to Vercel, against Supabase `gtggbwcncdpzyfndohvg`

## 0. Scope and non-goals

**In scope (Day 1):**

- New entity type `dhvc_candidate` with full Beacon-compliant lifecycle (observations → projection)
- Three external scrapers: Devpost finalists, GitHub OSS contributors at top 20 schools, arXiv undergrad first-author papers
- Four-dimension scoring rubric (mirrors ambassador scoring architecturally; different inputs)
- Curation queue UI in `/dashboard/dhvc` with accept/reject workflow
- Workqueue integration: pending DHVC reviews surface in the Monday Morning Workqueue
- One-click handoff to outreach engine for accepted candidates

**Out of scope (deferred):**

- Internal Cursor `.edu` usage data ingestion (Privacy/legal review on critical path; ships as Q2 enrichment when access lands)
- Identity resolution between scraped candidates and existing Cursor users (deferred until matching is needed at scale; at N=100 it's eyeballed)
- LinkedIn or Twitter scraping (Twitter API requires paid tier; LinkedIn scraping is ToS violation — handle later via official partner integrations)
- Real-time scheduled enrichment (Day 1 is on-demand refresh from the dashboard; Vercel cron added Week 2)
- Two-pipeline architecture (external + internal) — not needed at N=100

## 1. Data model additions

### Migration: `supabase/migrations/008_dhvc.sql`

Two enums + one table. Follows the exact pattern of `007_outreach.sql`.

```sql
-- DHVC source enum: where the candidate was discovered
CREATE TYPE dhvc_source AS ENUM (
  'devpost',
  'github',
  'arxiv',
  'manual'
);

-- DHVC review stage: lifecycle of a candidate from discovery to action
CREATE TYPE dhvc_review_stage AS ENUM (
  'pending_review',
  'accepted',
  'rejected',
  'archived'
);

CREATE TABLE dhvc_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name text NOT NULL,
  email text,
  github_username text,
  twitter_handle text,
  primary_source dhvc_source NOT NULL,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  graduation_year int,
  major text,
  score jsonb,
  review_stage dhvc_review_stage NOT NULL DEFAULT 'pending_review',
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_enriched_at timestamptz,
  CONSTRAINT dhvc_candidates_email_or_handle_chk
    CHECK (email IS NOT NULL OR github_username IS NOT NULL OR twitter_handle IS NOT NULL)
);

CREATE INDEX dhvc_candidates_institution_idx ON dhvc_candidates(institution_id);
CREATE INDEX dhvc_candidates_review_stage_idx ON dhvc_candidates(review_stage);
CREATE INDEX dhvc_candidates_score_idx ON dhvc_candidates((score->>'total'));
CREATE INDEX dhvc_candidates_discovered_at_idx ON dhvc_candidates(discovered_at DESC);

-- RLS following Beacon convention
ALTER TABLE dhvc_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY dhvc_candidates_anon_select ON dhvc_candidates
  FOR SELECT TO anon USING (true);

CREATE POLICY dhvc_candidates_service_role_insert ON dhvc_candidates
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY dhvc_candidates_service_role_update ON dhvc_candidates
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON dhvc_candidates TO anon;
GRANT ALL ON dhvc_candidates TO service_role;
```

### Type module: `lib/types/dhvc.ts`

```typescript
// @ownership dhvc-module

export const DHVC_SOURCES = ['devpost', 'github', 'arxiv', 'manual'] as const;
export type DhvcSource = (typeof DHVC_SOURCES)[number];

export const DHVC_REVIEW_STAGES = [
  'pending_review',
  'accepted',
  'rejected',
  'archived',
] as const;
export type DhvcReviewStage = (typeof DHVC_REVIEW_STAGES)[number];

export interface DhvcSourceUrl {
  url: string;
  source: DhvcSource;
  observed_at: string;
  description: string;  // "HackMIT 2025 finalist", "Top contributor to repo X", "First author on Paper Y"
}

export interface DhvcScore {
  technical_output: number;       // 0-100, weighted 30%
  public_reach: number;           // 0-100, weighted 20%
  school_fit: number;             // 0-100, weighted 25%
  cursor_signal: number;          // 0-100, weighted 25%
  total: number;                  // 0-100, weighted sum
}

export interface DhvcCandidate {
  id: string;
  institution_id: string;
  name: string;
  email?: string;
  github_username?: string;
  twitter_handle?: string;
  primary_source: DhvcSource;
  source_urls: DhvcSourceUrl[];
  graduation_year?: number;
  major?: string;
  score?: DhvcScore;
  review_stage: DhvcReviewStage;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  discovered_at: string;
  last_enriched_at?: string;
}
```

Then add to `lib/types.ts`:

```typescript
export * from "./types/dhvc";
```

### New `entity_type` and `observation_type` values

Update `lib/types/beacon-core.ts`:

```typescript
// Add to the entity_type union:
| "dhvc_candidate"

// Add to ObservationType:
| "dhvc_candidate_discovered"
| "dhvc_candidate_enriched"
| "dhvc_candidate_scored"
| "dhvc_candidate_accepted"
| "dhvc_candidate_rejected"
| "dhvc_signal_observed"  // for individual external signals (a Devpost win, a GitHub commit graph, a Cursor mention)

// Add to ObservationSource (already declared but unused — now used):
// "github" -> now used by GitHub scraper
// "devpost" -> NEW, add it
| "devpost"
```

## 2. Scoring function

`lib/dhvc-scoring.ts`. Mirrors `lib/ambassador-scoring.ts` exactly in shape: pure function, no I/O, weighted dimensions, `clamp100`, capped keyword bonuses. Each score component traces to specific observation rows.

```typescript
// @ownership dhvc-module

import { logObservation } from "@/lib/observations";
import type { DhvcCandidate, DhvcScore, DhvcSourceUrl } from "@/lib/types";

const W_TECHNICAL = 0.30;
const W_REACH = 0.20;
const W_FIT = 0.25;
const W_CURSOR = 0.25;

const SCORING_CONFIDENCE = 0.7;

// School tier ranking — top 5 vs top 10 vs top 20 vs other
const TIER_1 = new Set(['mit', 'stanford', 'cmu', 'berkeley', 'columbia']);
const TIER_2 = new Set(['cornell', 'princeton', 'caltech', 'gatech', 'uiuc',
                         'umich', 'uwash', 'ucla', 'uchicago', 'harvard']);
const TIER_3_BASELINE_SCORE = 50;

// Year multipliers — rising senior > sophomore > grad student for calcification thesis
const YEAR_MULTIPLIERS: Record<string, number> = {
  rising_senior: 1.0,
  rising_junior: 0.95,
  rising_sophomore: 0.85,
  rising_freshman: 0.6,
  grad_student: 0.7,
  unknown: 0.75,
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function inferYearLabel(graduationYear: number | undefined): string {
  if (!graduationYear) return 'unknown';
  const currentYear = new Date().getFullYear();
  const yearsToGrad = graduationYear - currentYear;
  if (yearsToGrad <= 0) return 'unknown';
  if (yearsToGrad === 1) return 'rising_senior';
  if (yearsToGrad === 2) return 'rising_junior';
  if (yearsToGrad === 3) return 'rising_sophomore';
  if (yearsToGrad === 4) return 'rising_freshman';
  return 'grad_student';
}

/**
 * Technical output: number, recency, and depth of public artifacts.
 * Inputs: count of source URLs by type, recency of those URLs.
 */
function scoreTechnicalOutput(sourceUrls: DhvcSourceUrl[]): number {
  if (sourceUrls.length === 0) return 10;

  const devpostCount = sourceUrls.filter(s => s.source === 'devpost').length;
  const githubCount = sourceUrls.filter(s => s.source === 'github').length;
  const arxivCount = sourceUrls.filter(s => s.source === 'arxiv').length;

  // arXiv first-author paper as undergrad is the strongest signal
  let base = 25;
  base += Math.min(35, arxivCount * 25);          // each undergrad paper = strong
  base += Math.min(30, devpostCount * 12);        // each finalist appearance
  base += Math.min(20, githubCount * 4);          // each significant contribution

  // Recency: at least one signal within 12 months
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const hasRecentSignal = sourceUrls.some(s =>
    new Date(s.observed_at).getTime() > oneYearAgo
  );
  if (hasRecentSignal) base += 10;

  return clamp100(base);
}

/**
 * Public reach: presence and visibility on public channels.
 * Inputs: github_username present, twitter_handle present, count of public URLs.
 */
function scorePublicReach(candidate: Pick<DhvcCandidate,
  'github_username' | 'twitter_handle' | 'source_urls'>): number {
  let base = 30;
  if (candidate.github_username) base += 15;
  if (candidate.twitter_handle) base += 25;  // Twitter handle is the strongest reach signal
  base += Math.min(30, candidate.source_urls.length * 4);

  // Bonus for cross-platform presence
  const sources = new Set(candidate.source_urls.map(s => s.source));
  if (sources.size >= 2) base += 10;
  if (sources.size >= 3) base += 5;

  return clamp100(base);
}

/**
 * School fit: institution tier × year multiplier.
 * Inputs: institution_id, graduation_year.
 */
function scoreSchoolFit(institutionId: string, graduationYear?: number): number {
  let baseTierScore: number;
  if (TIER_1.has(institutionId)) baseTierScore = 95;
  else if (TIER_2.has(institutionId)) baseTierScore = 80;
  else baseTierScore = TIER_3_BASELINE_SCORE;

  const yearLabel = inferYearLabel(graduationYear);
  const multiplier = YEAR_MULTIPLIERS[yearLabel] ?? 0.75;

  return clamp100(baseTierScore * multiplier);
}

/**
 * Cursor signal: have they shown public Cursor affinity?
 * Inputs: source_urls with description matching Cursor mentions.
 * NOTE: Day 1 is heuristic on description text. Day 30+ enrichment will scan
 * GitHub repos for Cursor commit trailers and Twitter mentions.
 */
function scoreCursorSignal(sourceUrls: DhvcSourceUrl[]): number {
  if (sourceUrls.length === 0) return 0;

  const cursorMentions = sourceUrls.filter(s =>
    /\bcursor\b/i.test(s.description) ||
    /\bbuilt with cursor\b/i.test(s.description)
  ).length;

  if (cursorMentions === 0) return 15;  // baseline: no signal yet, but they're DHVC-worthy on other axes
  if (cursorMentions === 1) return 50;
  if (cursorMentions === 2) return 75;
  return 95;
}

/**
 * Pure scoring for tests and reuse (no I/O).
 */
export function computeDhvcScoreFromCandidate(
  candidate: Pick<DhvcCandidate,
    'institution_id' | 'graduation_year' |
    'github_username' | 'twitter_handle' | 'source_urls'>
): DhvcScore {
  const technical_output = scoreTechnicalOutput(candidate.source_urls);
  const public_reach = scorePublicReach(candidate);
  const school_fit = scoreSchoolFit(candidate.institution_id, candidate.graduation_year);
  const cursor_signal = scoreCursorSignal(candidate.source_urls);

  const total = clamp100(
    W_TECHNICAL * technical_output +
    W_REACH * public_reach +
    W_FIT * school_fit +
    W_CURSOR * cursor_signal
  );

  return { technical_output, public_reach, school_fit, cursor_signal, total };
}

/**
 * Score a candidate and persist the score + observation.
 */
export async function scoreDhvcCandidate(candidate: DhvcCandidate): Promise<DhvcScore> {
  const score = computeDhvcScoreFromCandidate(candidate);

  await logObservation({
    entity_type: 'dhvc_candidate',
    entity_id: candidate.id,
    observation_type: 'dhvc_candidate_scored',
    payload: {
      score,
      weights: { technical_output: W_TECHNICAL, public_reach: W_REACH,
                 school_fit: W_FIT, cursor_signal: W_CURSOR },
    },
    source: 'manual',
    confidence: SCORING_CONFIDENCE,
  });

  return score;
}
```

Same shape as ambassador scoring. Tests live at `tests/dhvc-scoring.test.ts` and follow the same pattern.

## 3. Three external scrapers

All three live under `lib/sources/`. Each follows the same contract: `async function discoverFromX(): Promise<DhvcCandidateDraft[]>` where `DhvcCandidateDraft` is a pre-projection shape that the orchestrator turns into `dhvc_candidate` rows + observations.

```typescript
// lib/types/dhvc.ts (additional)
export interface DhvcCandidateDraft {
  institution_id: string;
  name: string;
  email?: string;
  github_username?: string;
  twitter_handle?: string;
  primary_source: DhvcSource;
  source_urls: DhvcSourceUrl[];
  graduation_year?: number;
  major?: string;
}
```

### `lib/sources/devpost.ts`

**Strategy:** Scrape Devpost finalist pages for the top 15 collegiate hackathons. Devpost has a public web interface; the relevant pages are the per-hackathon "submissions" pages with finalist filter.

**Hackathon list (Day 1, hardcoded):**

- HackMIT 2024 + 2025
- TreeHacks 2025
- PennApps 2024 + 2025
- CalHacks 2024 + 2025
- HackHarvard 2024 + 2025
- HackGT 2024
- ShellHacks 2024
- HackPrinceton 2024 + 2025
- MakeHarvard 2025
- BoilerMake 2025

(Maintained as a TS const; refresh quarterly. Future enhancement: pull MLH event list dynamically.)

**Mechanics:**

- Use `node-fetch` + `cheerio` to scrape (no Devpost API). Throttle 2 requests/sec.
- For each hackathon, fetch the public submissions page filtered by award status.
- Each finalist project links to participants. Each participant has a Devpost profile.
- Parse: name, school (when listed in profile), GitHub link, Twitter link, project URL.
- Filter for top-20 US schools only.
- Output `DhvcCandidateDraft` per participant, with one source URL per project.

**Rate-limit handling:** in-process gap (`DEVPOST_MIN_INTERVAL_MS = 500`), 30s/60s/120s backoff on HTTP 429 (mirror arXiv pattern).

```typescript
// lib/sources/devpost.ts skeleton

import * as cheerio from 'cheerio';
import type { DhvcCandidateDraft } from '@/lib/types';

const HACKATHON_URLS = [
  'https://hackmit-2024.devpost.com/project-gallery',
  'https://hackmit-2025.devpost.com/project-gallery',
  // ... 13 more
] as const;

const DEVPOST_MIN_INTERVAL_MS = 500;
let lastDevpostRequest = 0;

async function throttleDevpost(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastDevpostRequest;
  if (elapsed < DEVPOST_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, DEVPOST_MIN_INTERVAL_MS - elapsed));
  }
  lastDevpostRequest = Date.now();
}

export async function discoverFromDevpost(): Promise<DhvcCandidateDraft[]> {
  const drafts: DhvcCandidateDraft[] = [];
  for (const url of HACKATHON_URLS) {
    const finalists = await scrapeHackathonFinalists(url);
    drafts.push(...finalists);
  }
  return dedupe(drafts);  // by name + institution
}

// Implementation details: scrapeHackathonFinalists fetches the page,
// extracts winning project cards, follows each to the project page,
// extracts participant cards, follows each to the participant profile,
// extracts (name, school, github_username, twitter_handle).
// Falls through cleanly if any step fails for a single project.
```

### `lib/sources/github-students.ts`

**Strategy:** Use the GitHub Search API (public, no auth required for low rate; with `GITHUB_TOKEN` for higher rate) to find users whose profiles list a top-20 US school AND who've contributed 50+ commits in the last 12 months to repos with 100+ stars.

**Mechanics:**

- For each top-20 school, query `/search/users?q=location:"<school>"+type:user`.
- For each returned user, fetch `/users/{username}` and `/users/{username}/events`.
- Filter for: location/bio contains the school, commits in last 12 months ≥ 50, and at least one contribution to a repo with 100+ stars.
- This is the noisiest scraper; expect 60% false-positive rate. The accept/reject queue handles this.

**Rate limit:** 10 requests/minute unauthenticated; 30/min with token. Handle 403 + 429 with exponential backoff.

### `lib/sources/arxiv-undergrads.ts`

**Strategy:** Reuse the existing `lib/sources/arxiv.ts` pattern. Query for cs.LG / cs.CL / cs.AI / cs.SE papers from the last 12 months where the first author's affiliation matches a top-20 school AND the author lacks a "Prof." or PhD-marker pattern (heuristic: name doesn't appear on the school's faculty page).

**Mechanics:**

- arXiv API query: `cat:cs.LG OR cat:cs.CL OR cat:cs.AI OR cat:cs.SE`, `submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]` for the past 12 months.
- Parse author affiliations from paper metadata.
- Filter for first-author-only matches at top-20 schools.
- Cross-reference against `professors` table — if the author is already a known professor, skip (it's a faculty member, not an undergrad).
- Output `DhvcCandidateDraft` with arXiv author URL as primary source.

**Reuse:** the existing throttle (`ARXIV_MIN_INTERVAL_MS = 3000`) and exponential backoff from `lib/sources/arxiv.ts`. Don't duplicate.

## 4. Orchestrator: `lib/dhvc-orchestrator.ts`

The function that turns scraper drafts into Beacon-compliant rows. Single entry point, called by the API route or by a cron.

```typescript
// @ownership dhvc-module

import { supabaseAdmin } from '@/lib/supabase-admin';
import { logObservation } from '@/lib/observations';
import { computeDhvcScoreFromCandidate, scoreDhvcCandidate } from '@/lib/dhvc-scoring';
import { discoverFromDevpost } from '@/lib/sources/devpost';
import { discoverFromGitHubStudents } from '@/lib/sources/github-students';
import { discoverFromArxivUndergrads } from '@/lib/sources/arxiv-undergrads';
import type { DhvcCandidate, DhvcCandidateDraft } from '@/lib/types';

interface IngestionResult {
  source: 'devpost' | 'github' | 'arxiv';
  drafts_found: number;
  candidates_inserted: number;
  candidates_updated: number;
  errors: string[];
}

/**
 * Run all three scrapers, dedupe, score, persist, and observe.
 * Returns per-source counts for the dashboard.
 */
export async function runDhvcIngestion(): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const [source, discoverFn] of [
    ['devpost', discoverFromDevpost],
    ['github', discoverFromGitHubStudents],
    ['arxiv', discoverFromArxivUndergrads],
  ] as const) {
    const result: IngestionResult = {
      source, drafts_found: 0, candidates_inserted: 0,
      candidates_updated: 0, errors: [],
    };

    try {
      const drafts = await discoverFn();
      result.drafts_found = drafts.length;

      for (const draft of drafts) {
        try {
          const persisted = await persistDraft(draft);
          if (persisted.created) result.candidates_inserted++;
          else result.candidates_updated++;
        } catch (e) {
          result.errors.push(`${draft.name}: ${(e as Error).message}`);
        }
      }
    } catch (e) {
      result.errors.push(`Source ${source} failed: ${(e as Error).message}`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Insert a new candidate, OR merge into an existing one (matched on
 * (institution_id, name) or (github_username) or (twitter_handle)).
 */
async function persistDraft(draft: DhvcCandidateDraft): Promise<{
  candidate: DhvcCandidate;
  created: boolean;
}> {
  // 1. Try to find existing candidate by github_username, then twitter_handle, then (institution_id, name)
  const existing = await findExistingCandidate(draft);

  if (existing) {
    // Merge: append source_urls, update fields if newly available
    const mergedSourceUrls = mergeSourceUrls(existing.source_urls, draft.source_urls);
    const updateFields: Partial<DhvcCandidate> = {
      source_urls: mergedSourceUrls,
      email: existing.email ?? draft.email,
      github_username: existing.github_username ?? draft.github_username,
      twitter_handle: existing.twitter_handle ?? draft.twitter_handle,
      graduation_year: existing.graduation_year ?? draft.graduation_year,
      major: existing.major ?? draft.major,
    };

    // Re-score with merged data
    const newScore = computeDhvcScoreFromCandidate({
      ...existing, ...updateFields,
    });
    updateFields.score = newScore;

    const { data: updated, error } = await supabaseAdmin
      .from('dhvc_candidates')
      .update(updateFields)
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !updated) throw new Error(error?.message ?? 'update failed');

    await logObservation({
      entity_type: 'dhvc_candidate',
      entity_id: existing.id,
      observation_type: 'dhvc_candidate_enriched',
      payload: { merged_from_source: draft.primary_source, new_urls_count: draft.source_urls.length },
      source: draft.primary_source,
      confidence: 0.9,
    });

    // Re-score observation
    await scoreDhvcCandidate(mapDhvcCandidateRow(updated));

    return { candidate: mapDhvcCandidateRow(updated), created: false };
  }

  // 2. Insert new
  const initialScore = computeDhvcScoreFromCandidate(draft);
  const { data: inserted, error } = await supabaseAdmin
    .from('dhvc_candidates')
    .insert({ ...draft, score: initialScore })
    .select()
    .single();

  if (error || !inserted) throw new Error(error?.message ?? 'insert failed');

  await logObservation({
    entity_type: 'dhvc_candidate',
    entity_id: inserted.id,
    observation_type: 'dhvc_candidate_discovered',
    payload: {
      primary_source: draft.primary_source,
      source_urls_count: draft.source_urls.length,
      institution_id: draft.institution_id,
    },
    source: draft.primary_source,
    confidence: 0.9,
  });

  await scoreDhvcCandidate(mapDhvcCandidateRow(inserted));

  return { candidate: mapDhvcCandidateRow(inserted), created: true };
}

// Helpers: findExistingCandidate, mergeSourceUrls, mapDhvcCandidateRow ...
```

## 5. API routes

Six routes, all following Beacon's existing conventions (Zod validation, error code shape, mappers).

### `POST /api/dhvc/ingest` — kick off ingestion

```typescript
// app/api/dhvc/ingest/route.ts
// Calls runDhvcIngestion(), returns counts per source.
// No body required. Service-role auth (will gate with API key when middleware exists).
```

### `GET /api/dhvc/candidates` — list candidates

Query params: `review_stage`, `institution_id`, `min_score`, `limit`, `cursor`. Default sort: `score.total DESC`.

### `GET /api/dhvc/candidates/[id]` — fetch one

Includes observation timeline (mirrors professor detail view).

### `PATCH /api/dhvc/candidates/[id]` — update fields

Only `notes`, `email`, `graduation_year`, `major` are user-editable. Score-affecting fields trigger a re-score and observation.

### `POST /api/dhvc/candidates/[id]/accept` — accept candidate

Transitions `review_stage` to `accepted`, logs `dhvc_candidate_accepted`. Returns the candidate. Optionally creates an outreach touchpoint via the existing outreach engine (`source: 'dhvc_pipeline'`).

### `POST /api/dhvc/candidates/[id]/reject` — reject candidate

Transitions to `rejected`, logs `dhvc_candidate_rejected` with optional reason payload.

All routes return the standard `{ error, code }` shape on failure with codes from the established set: `VALIDATION`, `NOT_FOUND`, `DB_ERROR`, `ILLEGAL_TRANSITION`, `INGEST_FAILED`.

## 6. Dashboard UI

### `/dashboard/dhvc` — main candidates table

- Three tabs: **Pending Review** (default), **Accepted**, **Rejected**.
- Filters: institution, primary source, min score, graduation year.
- Sort: score total (default DESC), discovered_at, institution.
- Each row: name, institution, primary source badge, graduation year, score (with mini breakdown on hover), last_enriched_at, action buttons (Accept / Reject / View).
- "Refresh sources" button at top right → POST `/api/dhvc/ingest` → toast with per-source counts.

### `/dashboard/dhvc/[id]` — candidate detail

- Score breakdown (5 `MetricCard`s, exactly like `AmbassadorScoreCard`).
- Source URLs list with descriptions.
- Editable fields: notes, graduation_year, major, email.
- Observation timeline (mirrors professor detail).
- Action buttons:
  - **Accept** → moves to accepted, opens the outreach drafting flow (existing engine, new `dhvc` target type or reuse `student_org` for now).
  - **Reject** → modal asks for optional reason, archives.
  - **Re-enrich** → re-runs the relevant scraper for this specific candidate (future enhancement; Day 1 just shows last_enriched_at).

### `/dashboard/dhvc/new` — manual entry

For candidates the Campus Lead meets in person and wants to add directly. Same form fields as the scraper schema, marks `primary_source: 'manual'`.

## 7. Workqueue integration

Update `lib/workqueue.ts` to add a new candidate source:

```typescript
// New parallel query in generateWorkqueue():
supabaseAdmin
  .from('dhvc_candidates')
  .select('id, name, institution_id, score, primary_source')
  .eq('review_stage', 'pending_review')
  .gte('score->>total', 70)  // only high-score pending reviews surface in the workqueue
  .order('score->>total', { ascending: false })
  .limit(8),
```

Priority score for DHVC reviews: `72 + min((score - 70) * 0.3, 8)` — range 72–80, sits between events (61–74) and outreach (68–72.2). Tie-breaker: `dhvc` slots between `outreach` (2) and `events` (3) in `SOURCE_TIE_ORDER`.

## 8. Cursor SDK orchestration

This is where the Cursor SDK earns its keep. The DHVC module is ~6 files of code, ~600 lines, plus a migration. Building it manually = 1–2 days. Building it with a Cursor cloud agent = ~30 minutes of agent time + ~1 hour of human review.

### Recommended approach: cloud agent, single PR

```typescript
// scripts/build-dhvc.ts
import { Agent } from '@cursor/sdk';
import 'dotenv/config';

const SPEC_PATH = 'docs/dhvc-spec.md';

const PROMPT = `
You are extending the Beacon codebase with a new module: DHVC Curation.

The full specification is at ${SPEC_PATH}. Read it carefully before starting.

Critical constraints:
1. Follow Beacon's observation-first architecture. Every entity mutation must
   call logObservation() from lib/observations.ts. Read the existing pattern in
   lib/ambassador-pipeline.ts and lib/professor-enrichment.ts.
2. Mirror the four-dimension scoring pattern from lib/ambassador-scoring.ts —
   pure function, weighted dimensions, clamp100, capped keyword bonuses.
3. File naming: kebab-case.ts for libs, PascalCase.tsx for components.
4. Add types to lib/types/dhvc.ts and re-export from lib/types.ts.
5. API routes follow the { error, code } error shape with documented codes.
6. Zod schemas live in app/api/dhvc/schemas.ts.
7. Mappers live with the entity's main lib file.
8. RLS: anon SELECT, service_role INSERT/UPDATE.

Build order:
1. Migration (supabase/migrations/008_dhvc.sql)
2. Types (lib/types/dhvc.ts), update lib/types/beacon-core.ts and lib/types.ts
3. Scoring (lib/dhvc-scoring.ts) + tests (tests/dhvc-scoring.test.ts)
4. Three scrapers (lib/sources/devpost.ts, github-students.ts, arxiv-undergrads.ts)
5. Orchestrator (lib/dhvc-orchestrator.ts) + tests
6. API routes (app/api/dhvc/...)
7. Dashboard UI (app/dashboard/dhvc/...)
8. Workqueue integration (update lib/workqueue.ts)
9. Run vitest, fix failures, run tsc, fix failures
10. Add a sidebar entry in app/dashboard/layout.tsx under "Strategic"

Open a PR with all changes. Title: "DHVC Curation Module v1".
Body: summary of files created, design decisions, what was tested.
`;

const agent = await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: 'claude-opus-4.7' },  // Use Opus for the integrator — this is a long, multi-file build
  cloud: {
    repos: [{
      url: 'https://github.com/chewyuenrachael/beacon',
      startingRef: 'dhvc-module',
    }],
    autoCreatePR: true,
  },
});

const run = await agent.send(PROMPT);
console.log(`Started ${run.id}`);

// Wait for completion
const result = await (
  await Agent.getRun(run.id, { runtime: 'cloud', agentId: run.agentId })
).wait();

console.log(`PR: ${result.git?.branches[0]?.prUrl}`);
```

### Why Opus for the integrator and Composer 2 for the scrapers later

The integrator agent does long-context, multi-file synthesis — it's reading the spec, reading 8 different existing Beacon files, and writing 12 new files coherently. That's an Opus-class task, ~$5–10 in tokens.

For ongoing scraper runs (the daily ingestion job once it's deployed), use Composer 2 because the work is repetitive structured extraction, not multi-file synthesis. ~$0.50–1 per run.

### Why cloud not local

The integrator job takes 20–40 minutes of agent thinking and tool use. Cloud means it survives your laptop sleep, you can check on it from your phone, and it auto-creates the PR. Local would tie up your machine and force you to keep it awake.

### Hooks worth setting up

Create `.cursor/hooks.json` to enforce two things during the agent's build:

```json
{
  "preToolUse": {
    "writeFile": {
      "command": "node scripts/check-naming.js",
      "description": "Reject PascalCase library files; reject kebab-case component files"
    }
  },
  "postToolUse": {
    "writeFile": {
      "command": "npx prettier --write {file}",
      "description": "Auto-format every file the agent writes"
    }
  }
}
```

## 9. Test plan

Mirror Beacon's existing test patterns:

- `tests/dhvc-scoring.test.ts` — pure function tests, edge cases (empty source URLs, single source, all sources, year boundaries, school tier transitions). Pattern: `tests/ambassador-scoring.test.ts`.
- `tests/dhvc-orchestrator.test.ts` — mocks the three scrapers, asserts dedup logic, observation writes, score persistence.
- `tests/evals/dhvc-fixtures.json` — 30 hand-curated candidates across the three sources with expected scores. Pattern: `tests/evals/professors-20.json`.

## 10. Risks and what to do about them

**Devpost ToS:** Scraping is technically against Devpost's ToS. Risk is low for the volume (15 hackathons × monthly refresh), but worth flagging. Mitigation: use a `User-Agent` that identifies the project, throttle aggressively, cache aggressively. Long-term: reach out to Devpost for an API or partnership.

**GitHub Search API rate limits:** 10/min unauth, 30/min with token. At 20 schools × ~100 candidates/school = 2000 user fetches, ingestion takes ~70 minutes unauthenticated. Mitigation: get a `GITHUB_TOKEN` (free) on Day 1.

**False-positive rate from GitHub:** The "lives in " + "contributes to popular repo" filter is noisy. Expected 60% noise. Mitigation: the accept/reject queue is the filter. The Campus Lead's eye is the disambiguator.

**arXiv affiliation parsing:** Affiliations are unstructured. Mitigation: Day 1 ships with a simple substring match against a school name list. Day 30+: use a small Claude call (~$0.01 per paper) to extract structured affiliation if the substring match fails.

**The legacy cron is dead.** The Beacon brief flagged that `vercel.json` points at `/api/cron` which does nothing. The DHVC ingestion needs its own cron entry. Add it Day 7 once the on-demand button has proven the ingestion works:

```json
{
  "crons": [
    { "path": "/api/cron", "schedule": "0 9 * * *" },
    { "path": "/api/dhvc/ingest", "schedule": "0 6 * * 1" }
  ]
}
```

(Monday 6am UTC weekly refresh.)

**No central Anthropic helper.** If the scrapers need Claude (e.g., for arXiv affiliation parsing), I'd factor out `lib/anthropic.ts` from `lib/outreach-generator.ts:265-327` first. The integrator agent should do this as part of the build if the spec requires Claude calls. Day 1 spec doesn't require it, so this is deferred.