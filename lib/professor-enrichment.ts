/**
 * Professor enrichment from arXiv + keyword rules.
 *
 * Observation `source` convention (vertical slice):
 * - paper_detected: source "arxiv", source_url = paper abs URL
 * - paper_matches_keywords: source "keyword_match", source_url = null
 * - professor_enriched: source "arxiv" (aggregate pull), source_url = null
 *
 * Confidence is 0.9 for all three types in this slice.
 * On any error before the final professors UPDATE, the row is left unchanged
 * (last-known-good; PIPELINE.md).
 */

import { subMonths } from "date-fns";
import { logObservation } from "@/lib/observations";
import type { Professor } from "@/lib/types";
import { matchPaperKeywords } from "@/lib/keyword-paper-match";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchRecentPapers } from "@/lib/sources/arxiv";

const SLICE_CONFIDENCE = 0.9;

function mapProfessorRow(row: Record<string, unknown>): Professor {
  let public_statements: Professor["public_statements"] = [];
  const raw = row.public_statements;
  if (Array.isArray(raw)) {
    public_statements = raw as Professor["public_statements"];
  } else if (typeof raw === "string") {
    try {
      public_statements = JSON.parse(raw) as Professor["public_statements"];
    } catch {
      public_statements = [];
    }
  }

  return {
    id: row.id as string,
    institution_id: row.institution_id as string,
    name: row.name as string,
    title: (row.title as string | null) ?? undefined,
    lab_name: (row.lab_name as string | null) ?? undefined,
    arxiv_author_id: (row.arxiv_author_id as string | null) ?? undefined,
    homepage_url: (row.homepage_url as string | null) ?? undefined,
    recent_relevant_papers_count: Number(row.recent_relevant_papers_count ?? 0),
    ai_stance_quote: (row.ai_stance_quote as string | null) ?? undefined,
    ai_stance_source_url: (row.ai_stance_source_url as string | null) ?? undefined,
    public_statements,
    last_enriched_at: (row.last_enriched_at as string | null) ?? undefined,
  };
}

export async function enrichProfessor(professorId: string): Promise<Professor> {
  const { data: profRow, error: loadErr } = await supabaseAdmin
    .from("professors")
    .select("*")
    .eq("id", professorId)
    .single();

  if (loadErr || !profRow) {
    throw new Error(loadErr?.message ?? "Professor not found");
  }

  const arxivAuthorId = (profRow.arxiv_author_id as string | null)?.trim();
  if (!arxivAuthorId) {
    throw new Error("Professor missing arxiv_author_id");
  }

  try {
    const papers = await fetchRecentPapers(arxivAuthorId, 20);
    const cutoff = subMonths(new Date(), 24);
    let recentRelevantPapersCount = 0;

    for (const paper of papers) {
      await logObservation({
        entity_type: "professor",
        entity_id: professorId,
        observation_type: "paper_detected",
        payload: {
          arxiv_id: paper.arxivId,
          title: paper.title,
          abstract: paper.abstract,
          published_at: paper.publishedAt,
        },
        source: "arxiv",
        source_url: paper.url,
        confidence: SLICE_CONFIDENCE,
      });

      const kw = matchPaperKeywords(paper.title, paper.abstract);
      if (kw.matches) {
        await logObservation({
          entity_type: "professor",
          entity_id: professorId,
          observation_type: "paper_matches_keywords",
          payload: {
            arxiv_id: paper.arxivId,
            title: paper.title,
            abstract: paper.abstract,
            published_at: paper.publishedAt,
            matched_keywords: kw.matchedPhrases,
          },
          source: "keyword_match",
          confidence: SLICE_CONFIDENCE,
        });
      }

      const published = new Date(paper.publishedAt);
      if (
        !Number.isNaN(published.getTime()) &&
        published >= cutoff &&
        kw.matches
      ) {
        recentRelevantPapersCount += 1;
      }
    }

    await logObservation({
      entity_type: "professor",
      entity_id: professorId,
      observation_type: "professor_enriched",
      payload: { recent_relevant_papers_count: recentRelevantPapersCount },
      source: "arxiv",
      confidence: SLICE_CONFIDENCE,
    });

    const nowIso = new Date().toISOString();
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("professors")
      .update({
        recent_relevant_papers_count: recentRelevantPapersCount,
        last_enriched_at: nowIso,
      })
      .eq("id", professorId)
      .select()
      .single();

    if (updErr || !updated) {
      throw new Error(updErr?.message ?? "Professor projection update failed");
    }

    return mapProfessorRow(updated as Record<string, unknown>);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
