# Beacon

Campus Intelligence OS for Cursor's Campus Lead role.

Beacon is an internal operating tool for running Cursor's student discount program, Campus Ambassador program, and faculty outreach across the top CS programs in the US. One Campus Lead, 50 schools, 20 priority professors, 3 ambassadors, dozens of concurrent workflows — coordinated through a single dashboard.

## The problem

The Campus Lead role is a 10-year PLG capture bet. Students today are professional programmers in 3 years. Copilot has an 8-year free-for-students head start. Anthropic pays its Campus Ambassadors. Cursor's wedge is owning the editor end-to-end and having the strongest research story — but the Campus Lead has to execute against that advantage without a tool stack.

Day 1 in the role, you inherit:

- No CRM for faculty outreach
- No pipeline for ambassador applications
- No way to detect which students at top schools are already Cursor users
- A student discount flow that silently fails for Indian and Romanian students (documented on Cursor's own forums)
- No way to prioritize which of 50 schools to focus on this week

Beacon is what the tool should look like on Day 30.

## What it does

Beacon has three layers:

**Ambassador Operations** — Application intake, four-dimension scoring, stage FSM, health tracking, and activity logs. A new ambassador application is scored and surfaced to the workqueue in under a minute.

**Community Operations** — SheerID verification queue with manual override for the India/Romania edge cases. Event toolkit with pre-built playbooks for Cafe Cursor, hackathon sponsorships, workshops, lab demos, and professor talks.

**Strategic Intelligence** — 20 priority professors across MIT, Stanford, CMU, Berkeley, Columbia automatically enriched from arXiv. Each professor's recent LLM-related publication count is tracked, feeding a prioritization engine that surfaces the highest-leverage faculty to contact this week.

Every action flows through an append-only observations table that drives a Monday Morning Workqueue — 10 ranked actions synthesized across all three layers.

## Architectural principle

**Observation-first truth.** Every fact about every entity flows through the `observations` table with source, timestamp, and confidence. Entity tables are projections derived from observations. Nothing is written to an entity without a corresponding observation row.

This means:

- Every number on the dashboard is traceable to a verifiable source
- The Quarterly Review generator can reconstruct attribution narratives from the log
- A professor's `recent_relevant_papers_count` of 14 doesn't come from a classifier's guess — it comes from 14 specific arXiv papers, each logged as its own observation

The counter-principle would have been "classify everything with an LLM." Beacon explicitly rejects classification for fuzzy latents. AI-friendliness scores were removed from the design early — they produced confident-looking numbers from unverifiable inference. Retrieval-based facts (keyword matching, syllabus extraction, quote retrieval) replaced them throughout.

## The 10 features

| # | Feature | Status |
|---|---------|--------|
| 1 | Ambassador Pipeline Manager | Shipped |
| 2 | Community Hub (Slack/Discord) | Post-hire |
| 3 | Discount Provisioning Dashboard | Shipped |
| 4 | Campus Intelligence Dashboard | Shipped |
| 5 | Faculty Outreach Generator | Shipped |
| 6 | Event Operations Toolkit | Shipped |
| 7 | Enablement Resource Hub | Shipped |
| 8 | Identity Resolution + Enrichment | Partial — enrichment shipped, identity resolution post-hire |
| 9 | Monday Morning Workqueue | Shipped |
| 10 | Quarterly Review Generator | Post-hire |

## Tech stack

- **Framework:** Next.js 16 App Router, TypeScript strict mode
- **Database:** Supabase (Postgres + RLS, service role for writes, anon SELECT for reads)
- **Styling:** Tailwind CSS with a custom design system
- **AI:** Claude Sonnet via direct REST (no SDK, prefill-JSON pattern for structured output)
- **Ingestion:** arXiv API with 3-second rate limiting and exponential backoff
- **Testing:** Vitest with 33+ tests covering keyword matching, ambassador scoring, event playbooks, resources, SheerID mock, outreach generation, and workqueue prioritization
- **Eval:** Custom harness with 20 hand-researched professors hitting 100% accuracy on `recent_relevant_papers_count`

## Getting started

```bash
git clone https://github.com/chewyuenrachael/beacon.git
cd beacon
npm install
```

Create `.env.local` with four keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key
```

Link Supabase and apply migrations:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Seed and run:

```bash
npm run seed
npm run dev
```

Visit [localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build        # Production build
npm run start        # Production server
npm run typecheck    # TypeScript strict mode check
npm run test         # Vitest test suite
npm run eval         # Eval harness vs 20-professor fixture
npm run seed         # Seed 7 institutions, 20 professors, 3 ambassadors, 5 verifications, 3 events, 3 outreach touchpoints
npm run enrich-all   # Run arXiv enrichment across all seeded professors
```

## Project structure

```
beacon/
├── app/
│   ├── api/                    # API routes for each feature
│   ├── dashboard/              # Page components per feature
│   │   ├── page.tsx            # Home: 5-school overview
│   │   ├── workqueue/          # Monday Morning Workqueue
│   │   ├── professors/         # Faculty intelligence
│   │   ├── institutions/[id]/  # Per-school deep dive
│   │   ├── ambassadors/        # Pipeline manager
│   │   ├── events/             # Event toolkit
│   │   ├── resources/          # Playbook library
│   │   ├── discount/           # SheerID dashboard
│   │   └── outreach/           # Faculty CRM kanban
│   └── r/[trackingCode]/       # Public RSVP landing pages
├── lib/
│   ├── types/                  # Feature-owned type files, re-exported via barrel
│   ├── observations.ts         # Source-of-truth writer
│   ├── professor-enrichment.ts # arXiv → observations → entity projection
│   ├── workqueue.ts            # Cross-feature action prioritization
│   ├── institution-metrics.ts  # Per-school aggregation
│   ├── outreach-generator.ts   # Claude-backed personalized drafts
│   ├── ambassador-scoring.ts   # 4-dimension weighted scoring
│   └── sources/arxiv.ts        # arXiv client with rate limiting
├── components/
│   ├── ui/                     # Design primitives (MetricCard, Card)
│   ├── intelligence/           # SchoolCard, WorkqueueItem
│   ├── ambassadors/            # AmbassadorTable, ScoreCard, StageBadge
│   ├── events/                 # EventCard, EventChecklist, AttendanceCapture
│   ├── resources/              # ResourceCard, ResourceContent
│   ├── discount/               # VerificationQueue, GeographyMap
│   └── outreach/               # OutreachPipeline, OutreachCard
├── supabase/
│   ├── migrations/             # 001-007: slice, ambassadors, events, resources, discount, outreach
│   └── seed.ts                 # Idempotent reference data
├── tests/
│   ├── evals/                  # 20-professor accuracy fixture + runner
│   └── *.test.ts               # Unit tests per feature
├── content/
│   └── resources/              # 5 event playbooks + 3 FAQs (markdown)
└── .cursor/
    ├── rules/                  # Architecture, conventions, stack, data contracts
    └── commands/               # /migrate, /ship, /eval, /ingest-fixture
```

## The Sasha Rush slice

Beacon was built starting from a vertical slice: one professor (Alexander "Sasha" Rush at Cornell), one pipeline, one page. The slice proved types flowed cleanly from the arXiv API through observations through projection through UI. Every subsequent feature expanded outward from this foundation rather than building in parallel against speculative contracts.

Visit `/dashboard/professors/sasha-rush` to see the original slice. Real arXiv data, real keyword matching (14 matching papers as of the last enrichment), real observation timeline.

## Eval harness

`tests/evals/professors-20.json` contains 20 real professors across MIT, Stanford, CMU, Berkeley, and Columbia, each with a hand-researched expected `recent_relevant_papers_count`. The runner at `tests/evals/runner.ts` enriches each professor via the real arXiv pipeline and compares actual vs expected.

Last run: 100% accuracy on 19 scored professors (Zhou Yu excluded due to arXiv name ambiguity).

Run with `npm run eval`. The target is 80%+ accuracy; any drop flags a regression before merge.

## What Day 30 of the role looks like

Monday, 8am. Beacon pushes the week's top 10 actions to my calendar. I review each one — three are draft outreach emails to professors whose recent arXiv papers matched the keyword list, two are pending ambassador applications needing review, one is a verification in manual review for an IIT Delhi student. I action all 10 by noon.

Wednesday. Ambassador at MIT runs a Cafe Cursor. Beacon tracks attendance, fires off the post-event activation job, logs observations against the MIT ambassador's health score.

Friday. Beacon's weekly digest lands in my inbox: WACS-50 up 8%, three new activations at Stanford traceable to Percy Liang's lab demo two weeks ago, India/Romania verification queue growing — time to escalate the SheerID coverage expansion.
