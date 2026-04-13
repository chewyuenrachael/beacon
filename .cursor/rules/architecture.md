# Architecture

Beacon is a three-layer operating tool (Ambassador Ops / Community Ops / Strategic Intelligence) composing into a single Next.js 16 app with Supabase.

Data flow is defined in `PIPELINE.md`. Every fact about every entity flows through the append-only `observations` table defined in `SCHEMA.md`. UI reads from entity projections that derive from observations.

Key principle: when in doubt, log an observation. Never update entity tables without a corresponding observation row.

Pages live under `app/dashboard/`. Server components fetch data, client components handle interaction. API routes live under `app/api/`.