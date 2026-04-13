# /eval

Run the eval harness and report accuracy.

## Steps

1. Execute `tsx tests/evals/runner.ts`.
2. For each fixture, compare actual output to expected.
3. Report single number: accuracy percentage.
4. Report per-fixture diffs where expected ≠ actual.
5. Write result to `tests/evals/results/NNN-timestamp.json`.
6. Diff against last run. Flag regressions.

## Targets

- `recent_relevant_papers_count` accuracy: 80%+ across 20 professor fixture
- `ai_stance_extraction` accuracy: 90%+ exact quote match across 10 syllabus fixture
- `institutional_resolution` accuracy: 85%+ on 50 GitHub profile fixture

## Failure handling

If eval drops below target, do not merge. Investigate specific failures before proceeding.