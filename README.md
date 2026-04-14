# Beacon

Campus Intelligence OS for Cursor's Campus Lead. Manages ambassador operations, community programs, and strategic faculty intelligence across target universities.

```
app/            Next.js 16 App Router (pages + 60 API routes)
components/     UI primitives and domain components
lib/            Domain logic, Supabase clients, types
content/        Markdown playbooks and FAQs (resource hub)
supabase/       Migrations (001–007) and seed script
tests/          Vitest unit tests + eval harness
scripts/        One-off tooling (enrich-all)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                    │
│                                                         │
│  Dashboard (SSR)          API Routes (60 endpoints)     │
│  ┌─────────────────┐      ┌──────────────────────────┐  │
│  │ Strategic Intel  │      │ /api/ambassadors/*       │  │
│  │ Ambassador Ops   │      │ /api/events/*            │  │
│  │ Community Ops    │      │ /api/outreach/*          │  │
│  │ Discount Mgmt    │      │ /api/professors/*/enrich │  │
│  │ Outreach CRM     │      │ /api/verification/*      │  │
│  │ Resource Hub     │      │ /api/workqueue/*         │  │
│  └────────┬────────┘      │ /api/ingest/*            │  │
│           │               │ /api/cron                │  │
│           ▼               └────────────┬─────────────┘  │
│  ┌─────────────────────────────────────┴──────────────┐  │
│  │              lib/ — domain logic                    │  │
│  │  workqueue · scoring · enrichment · outreach       │  │
│  │  observations · events · resources · discount      │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   Supabase                         │  │
│  │  institutions · professors · observations          │  │
│  │  ambassadors · events · outreach_touchpoints       │  │
│  │  verification_attempts · resource_views            │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Product layers

| Layer | What it does | Key routes |
|-------|-------------|------------|
| **Strategic intelligence** | Metrics for 5 target schools (MIT, Stanford, CMU, Berkeley, Columbia). Faculty keyword signals, observation timelines, coverage gap detection. | `/dashboard`, `/dashboard/institutions/[id]`, `/dashboard/professors/[id]` |
| **Ambassador ops** | Application pipeline, scoring, health tracking, stage advancement. Resource hub with playbooks and FAQs. | `/dashboard/ambassadors`, `/dashboard/resources` |
| **Community ops** | Event creation, RSVP tracking, attendance capture. SheerID discount verification queue with geography analysis. | `/dashboard/events`, `/dashboard/discount` |
| **Outreach CRM** | Faculty outreach drafts (Anthropic-powered), touchpoint logging, stage tracking. | `/dashboard/outreach` |
| **Workqueue** | Priority-ranked weekly task list pulling from all domains: verifications, ambassador reviews, outreach candidates, events, coverage gaps, enrichment backlog. | `/dashboard/workqueue` |

## Data model

7 migrations, 8 core tables:

| Migration | Tables | Purpose |
|-----------|--------|---------|
| `001` | `institutions`, `professors`, `observations` | Faculty tracking + append-only observation log |
| `002` | `ambassadors`, `ambassador_activity` | Ambassador CRM pipeline |
| `003` | `events`, `event_attendees` | Event management + RSVP |
| `004` | `resource_views` | Analytics for enablement resources |
| `005` | `verification_attempts` | SheerID discount verification |
| `007` | `outreach_touchpoints` | Faculty outreach tracking |

## Tech stack

| Category | Tools |
|----------|-------|
| Framework | Next.js 16, React 18, TypeScript |
| Styling | Tailwind CSS 3 + `@tailwindcss/typography` |
| Data | Supabase (Postgres + auth + SSR client) |
| AI | Anthropic Claude (outreach drafts, classification) |
| Content | react-markdown, remark-gfm, remark-sectionize, rehype-slug |
| Charts | Recharts, react-simple-maps |
| Validation | Zod |
| Testing | Vitest (7 test suites, 54 tests) |

## Setup

### Prerequisites

- Node.js 20+
- A Supabase project (local or hosted)

### Environment variables

Create `.env.local`:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key

# Optional
ANTHROPIC_API_KEY=              # Outreach draft generation
CRON_SECRET=                    # Bearer token for /api/cron
```

### Install and run

```bash
npm install
npm run dev
```

### Seed the database

Apply migrations to your Supabase project, then:

```bash
npm run seed
```

Seeds 5 institutions, 1 professor, 5 verification attempts, 3 ambassadors, and 3 outreach touchpoints.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run Vitest (54 tests) |
| `npm run lint` | ESLint |
| `npm run seed` | Seed Supabase with demo data |
| `npm run eval` | Run professor enrichment evals |
| `npm run enrich-all` | Batch-enrich all professors |

## Tests

```bash
npm test
```

| Suite | Covers |
|-------|--------|
| `workqueue` | Priority ranking, tie-breaking, cap enforcement |
| `ambassador-scoring` | Application rubric scoring |
| `outreach-generator` | Draft generation with factual basis |
| `keyword-paper-match` | arXiv paper relevance matching |
| `event-playbooks` | Playbook suggestion logic |
| `sheerid-mock` | Discount verification mock responses |
| `resources` | Markdown rendering, display helpers, view logging |

## Project structure

```
app/
  dashboard/
    page.tsx                  # Campus intelligence home
    layout.tsx                # Sidebar shell
    workqueue/                # Priority task queue
    ambassadors/              # Pipeline + detail + application
    resources/                # Hub + detail + analytics
    events/                   # List + detail + creation
    discount/                 # Queue + geography
    outreach/                 # CRM list + detail + drafting
    professors/               # List + detail + enrichment
    institutions/[id]/        # Per-school deep dive
    settings/                 # Configuration
  api/                        # 60 route handlers
  login/                      # Supabase auth
  r/[trackingCode]/           # Public event RSVP

components/
  ui/                         # Button, Card, Modal, Tabs, Badge, etc.
  intelligence/               # SchoolCard, WorkqueueItem
  ambassadors/                # Table, ScoreCard
  events/                     # EventCard, Checklist, Attendance
  discount/                   # VerificationQueue, GeographyMap
  outreach/                   # Pipeline
  resources/                  # ResourceCard, ResourceContent, Toc

lib/
  types/                      # Domain models (7 type modules)
  sources/                    # Ingest: arXiv, HN, Reddit, RSS, YouTube
  workqueue.ts                # Candidate generation + ranking
  institution-metrics.ts      # Per-school roll-ups
  ambassador-scoring.ts       # Application rubric
  outreach-generator.ts       # LLM-powered draft generation
  professor-enrichment.ts     # arXiv enrichment pipeline
  resource-content.ts         # Filesystem-backed resource loader
  resource-display.ts         # Title stripping, read time, ToC
  resource-markdown.tsx       # Remark/rehype pipeline
  classify.ts                 # LLM mention classification
  observations.ts             # Append-only observation model

content/resources/            # 8 markdown resources (playbooks + FAQs)

supabase/
  migrations/                 # 001–007 active migrations
  seed.ts                     # Demo data seeder
```

## Related docs

- [`SPEC.md`](SPEC.md) — full feature specification
- [`SCHEMA.md`](SCHEMA.md) — data model reference
- [`PIPELINE.md`](PIPELINE.md) — observation and enrichment flow
