# Beacon Eval Harness

## Purpose

Intelligence tools fail silently. A classifier at 60% still produces outputs. The eval harness catches regressions before they reach production.

## Fixtures

### `professors-20.json`

20 real professors across MIT, Stanford, CMU, Berkeley, Columbia. Each entry has hand-validated expected values.

```json
{
  "professors": [
    {
      "id": "sasha-rush",
      "institution_id": "cornell",
      "name": "Alexander Rush",
      "arxiv_author_id": "rush_a_1",
      "expected": {
        "recent_relevant_papers_count": 8,
        "ai_stance_quote": null,
        "public_statements_count": 2
      },
      "notes": "NLP focus, many recent LLM papers, Cornell Tech NYC"
    }
  ]
}
```

### `github-institutional-50.json`

50 GitHub profiles with hand-verified institutional ground truth. For identity resolution eval.

```json
{
  "profiles": [
    {
      "github_username": "example-user",
      "expected_institution": "mit",
      "signals_available": ["github_org", "course_repo"]
    }
  ]
}
```

## Running

```bash
pnpm eval
```

Outputs accuracy percentage + per-fixture diffs. Writes JSON result to `tests/evals/results/`.

## Targets

- 80%+ on `recent_relevant_papers_count`
- 90%+ on `ai_stance_quote` exact match
- 85%+ on institutional resolution

## Maintaining fixtures

Re-verify fixtures monthly. Professors publish new papers; expected counts change. Use fixture-timestamps to track staleness.