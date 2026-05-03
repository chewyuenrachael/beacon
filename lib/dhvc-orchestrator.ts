// @ownership dhvc-module

import { logObservation } from "@/lib/observations";
import {
  computeDhvcScoreFromCandidate,
  scoreDhvcCandidate,
} from "@/lib/dhvc-scoring";
import { discoverFromArxivUndergrads } from "@/lib/sources/arxiv-undergrads";
import { discoverFromDevpost } from "@/lib/sources/devpost";
import { discoverFromGitHubStudents } from "@/lib/sources/github-students";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  DhvcCandidate,
  DhvcCandidateDraft,
  DhvcReviewStage,
  DhvcScore,
  DhvcSource,
  DhvcSourceUrl,
} from "@/lib/types";

const DISCOVERED_CONFIDENCE = 0.9;
const ENRICHED_CONFIDENCE = 0.9;

export interface IngestionResult {
  source: "devpost" | "github" | "arxiv";
  drafts_found: number;
  candidates_inserted: number;
  candidates_updated: number;
  errors: string[];
}

interface DiscoverFn {
  (): Promise<DhvcCandidateDraft[]>;
}

interface OrchestratorDeps {
  discoverFromDevpostFn?: DiscoverFn;
  discoverFromGithubFn?: DiscoverFn;
  discoverFromArxivFn?: DiscoverFn;
}

const SOURCE_CHANNELS: ReadonlyArray<{
  source: IngestionResult["source"];
  pick: (deps: OrchestratorDeps) => DiscoverFn;
}> = [
  {
    source: "devpost",
    pick: (deps) => deps.discoverFromDevpostFn ?? discoverFromDevpost,
  },
  {
    source: "github",
    pick: (deps) => deps.discoverFromGithubFn ?? discoverFromGitHubStudents,
  },
  {
    source: "arxiv",
    pick: (deps) => deps.discoverFromArxivFn ?? discoverFromArxivUndergrads,
  },
];

export function mapDhvcCandidateRow(
  row: Record<string, unknown>
): DhvcCandidate {
  const sourceUrlsRaw = row.source_urls;
  const source_urls: DhvcSourceUrl[] = Array.isArray(sourceUrlsRaw)
    ? (sourceUrlsRaw as DhvcSourceUrl[])
    : [];

  const scoreRaw = row.score;
  let score: DhvcScore | undefined;
  if (scoreRaw && typeof scoreRaw === "object" && !Array.isArray(scoreRaw)) {
    const s = scoreRaw as Record<string, unknown>;
    score = {
      technical_output: Number(s.technical_output ?? 0),
      public_reach: Number(s.public_reach ?? 0),
      school_fit: Number(s.school_fit ?? 0),
      cursor_signal: Number(s.cursor_signal ?? 0),
      total: Number(s.total ?? 0),
    };
  }

  return {
    id: row.id as string,
    institution_id: row.institution_id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? undefined,
    github_username: (row.github_username as string | null) ?? undefined,
    twitter_handle: (row.twitter_handle as string | null) ?? undefined,
    primary_source: row.primary_source as DhvcSource,
    source_urls,
    graduation_year:
      typeof row.graduation_year === "number"
        ? (row.graduation_year as number)
        : (row.graduation_year as number | null) ?? undefined,
    major: (row.major as string | null) ?? undefined,
    score,
    review_stage: row.review_stage as DhvcReviewStage,
    reviewed_by: (row.reviewed_by as string | null) ?? undefined,
    reviewed_at: (row.reviewed_at as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    discovered_at: row.discovered_at as string,
    last_enriched_at: (row.last_enriched_at as string | null) ?? undefined,
  };
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeSourceUrls(
  existing: DhvcSourceUrl[],
  incoming: DhvcSourceUrl[]
): DhvcSourceUrl[] {
  const byUrl = new Map<string, DhvcSourceUrl>();
  for (const u of existing) byUrl.set(u.url, u);
  for (const u of incoming) {
    if (!byUrl.has(u.url)) byUrl.set(u.url, u);
  }
  return [...byUrl.values()];
}

async function findExistingCandidate(
  draft: DhvcCandidateDraft
): Promise<DhvcCandidate | null> {
  if (draft.github_username) {
    const { data, error } = await supabaseAdmin
      .from("dhvc_candidates")
      .select("*")
      .eq("github_username", draft.github_username)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapDhvcCandidateRow(data as Record<string, unknown>);
  }

  if (draft.twitter_handle) {
    const { data, error } = await supabaseAdmin
      .from("dhvc_candidates")
      .select("*")
      .eq("twitter_handle", draft.twitter_handle)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapDhvcCandidateRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabaseAdmin
    .from("dhvc_candidates")
    .select("*")
    .eq("institution_id", draft.institution_id)
    .ilike("name", normalizeName(draft.name))
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return mapDhvcCandidateRow(data as Record<string, unknown>);
  return null;
}

interface PersistResult {
  candidate: DhvcCandidate;
  created: boolean;
}

async function persistDraft(
  draft: DhvcCandidateDraft
): Promise<PersistResult> {
  const existing = await findExistingCandidate(draft);

  if (existing) {
    const mergedSourceUrls = mergeSourceUrls(
      existing.source_urls,
      draft.source_urls
    );
    const merged: Pick<
      DhvcCandidate,
      | "institution_id"
      | "graduation_year"
      | "github_username"
      | "twitter_handle"
      | "source_urls"
    > = {
      institution_id: existing.institution_id,
      graduation_year: existing.graduation_year ?? draft.graduation_year,
      github_username: existing.github_username ?? draft.github_username,
      twitter_handle: existing.twitter_handle ?? draft.twitter_handle,
      source_urls: mergedSourceUrls,
    };
    const newScore = computeDhvcScoreFromCandidate(merged);

    const updateFields: Record<string, unknown> = {
      source_urls: mergedSourceUrls,
      score: newScore,
      last_enriched_at: new Date().toISOString(),
    };
    if (!existing.email && draft.email) updateFields.email = draft.email;
    if (!existing.github_username && draft.github_username) {
      updateFields.github_username = draft.github_username;
    }
    if (!existing.twitter_handle && draft.twitter_handle) {
      updateFields.twitter_handle = draft.twitter_handle;
    }
    if (!existing.graduation_year && draft.graduation_year) {
      updateFields.graduation_year = draft.graduation_year;
    }
    if (!existing.major && draft.major) updateFields.major = draft.major;

    const { data: updated, error } = await supabaseAdmin
      .from("dhvc_candidates")
      .update(updateFields)
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "dhvc update failed");
    }

    await logObservation({
      entity_type: "dhvc_candidate",
      entity_id: existing.id,
      observation_type: "dhvc_candidate_enriched",
      payload: {
        merged_from_source: draft.primary_source,
        new_urls_count: draft.source_urls.length,
      },
      source: draft.primary_source,
      confidence: ENRICHED_CONFIDENCE,
    });

    const refreshed = mapDhvcCandidateRow(updated as Record<string, unknown>);
    await scoreDhvcCandidate(refreshed);

    return { candidate: refreshed, created: false };
  }

  const initialScore = computeDhvcScoreFromCandidate(draft);
  const insertRow = {
    institution_id: draft.institution_id,
    name: draft.name,
    email: draft.email ?? null,
    github_username: draft.github_username ?? null,
    twitter_handle: draft.twitter_handle ?? null,
    primary_source: draft.primary_source,
    source_urls: draft.source_urls,
    graduation_year: draft.graduation_year ?? null,
    major: draft.major ?? null,
    score: initialScore,
    last_enriched_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("dhvc_candidates")
    .insert(insertRow)
    .select()
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "dhvc insert failed");
  }

  const candidate = mapDhvcCandidateRow(inserted as Record<string, unknown>);

  await logObservation({
    entity_type: "dhvc_candidate",
    entity_id: candidate.id,
    observation_type: "dhvc_candidate_discovered",
    payload: {
      primary_source: candidate.primary_source,
      source_urls_count: candidate.source_urls.length,
      institution_id: candidate.institution_id,
    },
    source: candidate.primary_source,
    confidence: DISCOVERED_CONFIDENCE,
  });

  for (const u of candidate.source_urls) {
    await logObservation({
      entity_type: "dhvc_candidate",
      entity_id: candidate.id,
      observation_type: "dhvc_signal_observed",
      payload: {
        signal_source: u.source,
        description: u.description,
      },
      source: u.source,
      source_url: u.url,
      confidence: DISCOVERED_CONFIDENCE,
    });
  }

  await scoreDhvcCandidate(candidate);

  return { candidate, created: true };
}

/**
 * Run all three scrapers, dedupe across results, score, persist, and observe.
 * Returns per-source counts for the dashboard.
 */
export async function runDhvcIngestion(
  deps: OrchestratorDeps = {}
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const channel of SOURCE_CHANNELS) {
    const result: IngestionResult = {
      source: channel.source,
      drafts_found: 0,
      candidates_inserted: 0,
      candidates_updated: 0,
      errors: [],
    };

    try {
      const drafts = await channel.pick(deps)();
      result.drafts_found = drafts.length;

      for (const draft of drafts) {
        try {
          const persisted = await persistDraft(draft);
          if (persisted.created) result.candidates_inserted++;
          else result.candidates_updated++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          result.errors.push(`${draft.name}: ${msg}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`Source ${channel.source} failed: ${msg}`);
    }

    results.push(result);
  }

  return results;
}

/**
 * Insert a manual draft (e.g. from the dashboard "Add candidate" form),
 * applying the same persist + observation pipeline.
 */
export async function persistManualDhvcDraft(
  draft: DhvcCandidateDraft
): Promise<DhvcCandidate> {
  const result = await persistDraft({ ...draft, primary_source: "manual" });
  return result.candidate;
}
