# /ingest-fixture

Run one fixture through the full pipeline end-to-end for smoke testing.

## Steps

1. Read fixture name from argument (e.g., `sasha-rush`).
2. Look up fixture in `tests/fixtures/<name>.json`.
3. Run ingestion for that entity: arXiv → observations.
4. Run enrichment: observations → entity projection.
5. Render UI: fetch `localhost:3000/dashboard/professors/<id>` via curl.
6. Report: observations created, entity fields populated, UI renders.

## Use cases

- After adding new source: verify pipeline still ends-to-end.
- After schema change: verify projection still derives correctly.
- Before demo: spot-check that known-good data still flows.