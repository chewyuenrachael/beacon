# Beacon Pipeline

## Data flow

[Sources] → [Ingestion] → [Raw Items] → [Classification/Extraction]
→ [Observations] → [Entity Projection] → [UI]

## Stage-by-stage contracts

### Stage 1: Sources → Ingestion
**Input:** None (cron trigger) or manual trigger with `{source: string, target_id?: string}`
**Output:** `IngestionResult { items: RawItem[], logged_to: string }`
**Trigger:** Vercel cron per source OR manual "Run Now" button
**Failure mode:** Logged to `ingestion_logs.error`, retry next cron cycle

### Stage 2: Ingestion → Raw Items → Observations
**Input:** `RawItem { source, payload, fetched_at }`
**Output:** `Observation[]` written to observations table
**Transformation:** Each raw item produces 1+ observations. Example: one arXiv paper produces observations of type `paper_detected` and potentially `paper_matches_keywords`.
**Failure mode:** Invalid raw items logged as observations with low confidence and `source: "ingestion_error"`.

### Stage 3: Observations → Classification/Extraction
**Input:** Batch of observations of specific types (e.g., all unprocessed `paper_detected` for a professor)
**Output:** Derived observations like `paper_relevance_computed`
**Transformation:** For Beacon, mostly keyword matching and extraction, NO inference-based classification. Optional: Claude for quote extraction from syllabi.
**Failure mode:** Retains original observations, derived observation logged with error payload.

### Stage 4: Observations → Entity Projection
**Input:** Latest N observations per (entity, attribute) pair
**Output:** Updated row in `professors`, `ambassadors`, etc.
**Transformation:** Reduce observations into current state. E.g., sum all `paper_matches_keywords` observations → `recent_relevant_papers_count`.
**Failure mode:** Entity row retains last-known-good state; re-projection is always safe.

### Stage 5: Entity State → UI
**Input:** Entity rows + recent observations for timeline
**Output:** Rendered Next.js pages
**Transformation:** Server components fetch entity state + recent observations, render via Forge MetricCards.
**Failure mode:** Error boundaries per card, skeleton loaders during fetch.

## Cron schedule (per-source, not monolith)

```json
{
  "crons": [
    { "path": "/api/ingest/arxiv", "schedule": "0 2 * * *" },
    { "path": "/api/ingest/github", "schedule": "0 3 * * *" },
    { "path": "/api/ingest/mlh", "schedule": "0 4 * * 1" },
    { "path": "/api/enrichment/run", "schedule": "0 5 * * *" },
    { "path": "/api/workqueue/generate", "schedule": "0 8 * * 1" }
  ]
}
```

## No parallel state

UI reads only from entity projections (which derive from observations). No cached derived tables. No client-side state that diverges. Every displayed number is traceable to an observation.