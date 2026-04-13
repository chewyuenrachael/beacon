# /eval

Run the eval harness and report accuracy.

## Steps

1. Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (same as seed / enrichment).
2. Execute `npm run eval` (runs `tsx tests/evals/runner.ts`).
3. For each fixture, compare actual output to expected.
4. Report single number: accuracy percentage (scored professors only; `verify_needed` rows are excluded).
5. Report per-fixture diffs where expected ≠ actual (within tolerance).
6. Write result to `tests/evals/results/{ISO-timestamp}.json` (gitignored).
7. Diff against last run manually. Flag regressions.

## Targets

- `recent_relevant_papers_count` accuracy: 80%+ across 20 professor fixture (`tests/evals/professors-20.json`)
- `ai_stance_extraction` accuracy: 90%+ exact quote match across 10 syllabus fixture *(not wired yet)*
- `institutional_resolution` accuracy: 85%+ on 50 GitHub profile fixture *(not wired yet)*

## Failure handling

If eval drops below target, do not merge. Investigate specific failures before proceeding.
