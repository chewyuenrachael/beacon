# Beacon Eval Harness

## Purpose

Intelligence tools fail silently. A classifier at 60% still produces outputs. The eval harness catches regressions before they reach production.

## Fixtures

### `professors-20.json`

Twenty real professors across MIT, Stanford, CMU, Berkeley, and Columbia. Each entry includes:

- `id` — slug used as `professors.id` during eval
- `institution_id` — one of `mit`, `stanford`, `cmu`, `berkeley`, `columbia`
- `name`, `arxiv_author_id` — passed to `fetchRecentPapers` / DB (phrase or `search_query` with `:` per [`lib/sources/arxiv.ts`](../../lib/sources/arxiv.ts))
- `expected_count` — hand-computed `recent_relevant_papers_count` (top 20 arXiv papers, same keyword + 24‑month rules as [`lib/professor-enrichment.ts`](../../lib/professor-enrichment.ts))
- `verify_needed` — if `true`, row is excluded from accuracy (ambiguous arXiv author); still runs `enrichProfessor` for smoke
- `notes` — one-line context

```json
{
  "version": 1,
  "professors": [
    {
      "id": "graham-neubig",
      "institution_id": "cmu",
      "name": "Graham Neubig",
      "arxiv_author_id": "Graham Neubig",
      "expected_count": 16,
      "verify_needed": false,
      "notes": "NLP, code generation, neural MT"
    }
  ]
}
```

### `github-institutional-50.json`

Fifty GitHub profiles with hand-verified institutional ground truth. Used when the identity-resolution eval is wired up.

## Running

```bash
npm run eval
```

- Upserts institutions + professors, then calls real `enrichProfessor()` per row (live arXiv + Supabase).
- **~5–10 minutes** (3s spacing between professors + observation writes).
- Tolerance: \(|actual - expected| \le 1\) counts as a match.
- Exit **0** if accuracy ≥ **80%** on scored rows; **1** otherwise.
- Writes `tests/evals/results/<ISO-timestamp>.json` (ignored by git).

## Maintaining expected counts

Re-verify when keyword rules or the 24‑month window logic changes:

```bash
npx tsx tests/evals/scripts/compute-expected-counts.ts
```

Uses real arXiv calls with 3s delays; paste JSON into `professors-20.json` after review. Mark `verify_needed` where arXiv author search is ambiguous.

## Targets

- 80%+ on `recent_relevant_papers_count` (professors fixture)
- 90%+ on `ai_stance_quote` exact match *(future)*
- 85%+ on institutional resolution *(future)*
