# Beacon Technical Brief — for the DHVC Curation engineer

> Audit of `/Users/rachaelchew/beacon` (commit-state as of 2026‑05‑01).
> Where the question can't be answered from code, the section says "unknown" or "doesn't exist yet."

## 1. Repository structure

### File tree (excluding `node_modules/`, `.next/`, `dist/`, `build/`, `.git/`, `.cursor/`, `.claude/`, `package-lock.json`, `tsbuildinfo`)

```
beacon/
├── .env.local
├── .eslintrc.json
├── .gitignore
├── PIPELINE.md
├── README.md
├── SCHEMA.md
├── SPEC.md
├── next-env.d.ts
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── route-today.sh
├── run-daily.sh
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
├── vitest.config.ts
├── app/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                                # client-side redirect → /dashboard
│   ├── login/page.tsx
│   ├── fonts/{GeistMonoVF.woff, GeistVF.woff}
│   ├── api/
│   │   ├── ambassadors/
│   │   │   ├── route.ts                        # POST create
│   │   │   ├── schemas.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts                    # GET/PATCH
│   │   │       ├── advance/route.ts            # POST stage transition
│   │   │       ├── health/route.ts             # POST recompute
│   │   │       └── score/route.ts              # POST rescore
│   │   ├── audiences/route.ts                  # legacy Pulse, see §11/§12
│   │   ├── brief/{[date],latest,stats}/route.ts        # legacy Pulse
│   │   ├── briefs/audience/{[slug],deliver}/route.ts   # legacy Pulse
│   │   ├── classify/route.ts                   # legacy Pulse
│   │   ├── cron/route.ts                       # legacy Pulse + Beacon hooks (excluded from tsc)
│   │   ├── events/
│   │   │   ├── route.ts
│   │   │   ├── schemas.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── schemas.ts
│   │   │       └── attendees/{route.ts, schemas.ts}
│   │   ├── ingest/{backfill,discord,hackernews,reddit,rss,twitter,youtube}/route.ts  # legacy Pulse, excluded
│   │   ├── ingest/route.ts                     # legacy Pulse, excluded
│   │   ├── keywords/route.ts                   # legacy Pulse
│   │   ├── llm-monitor/{_transform.ts, probes, responses, run, snapshots}/...   # legacy Pulse
│   │   ├── mentions/{[id],route}.ts            # legacy Pulse
│   │   ├── outreach/
│   │   │   ├── route.ts
│   │   │   ├── schemas.ts
│   │   │   └── [id]/{route.ts, draft/route.ts}
│   │   ├── prep/{[id],route}.ts                # legacy Pulse, excluded
│   │   ├── professors/[id]/enrich/{route.ts, schemas.ts}
│   │   ├── pullthrough/{by-outlet,messages,score}/route.ts   # legacy Pulse, excluded
│   │   ├── resources/[slug]/view/{route.ts, schemas.ts}
│   │   ├── settings/route.ts                   # legacy Pulse
│   │   ├── sources/{discord,propagation,tiers,twitter}/...   # legacy Pulse
│   │   ├── stats/{regions,tensions}/route.ts   # legacy Pulse
│   │   ├── templates/{[id],route}.ts           # legacy Pulse
│   │   ├── velocity/route.ts                   # legacy Pulse
│   │   ├── verification/
│   │   │   ├── route.ts
│   │   │   ├── schemas.ts
│   │   │   └── [id]/{approve,reject}/route.ts
│   │   └── workqueue/complete/route.ts
│   ├── dashboard/
│   │   ├── layout.tsx
│   │   ├── page.tsx                            # 5-school + Cornell SchoolCards
│   │   ├── workqueue/page.tsx
│   │   ├── settings/page.tsx                   # excluded from tsc
│   │   ├── ambassadors/{page.tsx, new/{page.tsx, AmbassadorApplicationForm.tsx},
│   │   │                 [id]/{page.tsx, AdvanceStageButton.tsx, HealthRefreshButton.tsx, RescoreButton.tsx}}
│   │   ├── discount/{page.tsx, geography/page.tsx, queue/page.tsx}
│   │   ├── events/{page.tsx, new/{page.tsx, NewEventForm.tsx},
│   │   │           [id]/{page.tsx, CopyRsvpLink.tsx}}
│   │   ├── institutions/[id]/page.tsx
│   │   ├── outreach/{page.tsx, new/{page.tsx, NewOutreachForm.tsx},
│   │   │              [id]/{page.tsx, OutreachDetailClient.tsx}}
│   │   ├── professors/{page.tsx, [id]/{page.tsx, ReenrichButton.tsx}}
│   │   └── resources/{page.tsx, ResourcesHubClient.tsx, analytics/page.tsx, [slug]/page.tsx}
│   └── r/[trackingCode]/{page.tsx, RsvpForm.tsx}
├── components/
│   ├── _forge-reference/prospects/...                # excluded — see §11/§12
│   ├── ambassadors/{AmbassadorScoreCard.tsx, AmbassadorTable.tsx, StageBadge.tsx}
│   ├── discount/{GeographyMap.tsx, VerificationQueue.tsx}
│   ├── events/{AttendanceCapture.tsx, EventCard.tsx, EventChecklist.tsx}
│   ├── intelligence/{SchoolCard.tsx, WorkqueueItem.tsx}
│   ├── outreach/{OutreachCard.tsx, OutreachPipeline.tsx}
│   ├── resources/{MermaidDiagram.tsx, ResourceCard.tsx, ResourceContent.tsx, ResourceToc.tsx, ResourceViewLogger.tsx}
│   ├── ui/{Badge.tsx, Button.tsx, Card.tsx, Input.tsx, MetricCard.tsx, MetricCard.forge.tsx,
│   │       Modal.tsx, Select.tsx, Table.tsx, Tabs.tsx}
│   ├── AudienceBriefView.tsx, AudienceSelector.tsx, CopyBriefButton.tsx, DraftComments.tsx,
│   │   FilterSidebar.tsx, FiresTable.tsx, IncidentCard.tsx, IncidentTimeline.tsx,
│   │   JournalistCard.tsx, LLMFactCheckPanel.tsx, LLMNarrativeMatrix.tsx, LLMPlatformCard.tsx,
│   │   LLMResponseViewer.tsx, LLMTrendChart.tsx, LoadingSkeleton.tsx, MentionCard.tsx,
│   │   NarrativeGapPanel.tsx, NarrativeScorecard.tsx, NarrativeSettings.tsx,
│   │   NarrativeTrendChart.tsx, PostIncidentReview.tsx, PropagationBadge.tsx,
│   │   PropagationTimeline.tsx, ResponseDraftEditor.tsx, SkeletonCard.tsx,
│   │   StakeholderChecklist.tsx, TemplateSelector.tsx                             # all legacy Pulse
│   └── ...
├── content/resources/
│   ├── cafe-cursor-playbook.md
│   ├── faq-academic-integrity.md
│   ├── faq-international-access.md
│   ├── faq-nightly-builds.md
│   ├── hackathon-sponsorship-playbook.md
│   ├── lab-demo-playbook.md
│   ├── professor-talk-playbook.md
│   └── workshop-playbook.md
├── docs/screenshots/{brief.png, feed.png, prep.png, tensions.png}
├── lib/
│   ├── alerts.ts                  # Pulse stub (no-op)
│   ├── ambassador-health.ts       # Beacon
│   ├── ambassador-pipeline.ts     # Beacon — stage FSM + projection
│   ├── ambassador-scoring.ts      # Beacon — four-dimension scoring
│   ├── audience-routing.ts        # Pulse stub (no-op)
│   ├── brief.ts                   # Pulse stub (no-op)
│   ├── classify.ts                # Pulse — Anthropic JSON-prefill classifier
│   ├── constants.ts
│   ├── discount-country.ts
│   ├── event-attribution.ts       # Beacon (placeholder activation hook)
│   ├── event-mutations.ts         # Beacon
│   ├── event-playbooks.ts         # Beacon — 5 playbooks
│   ├── incident-manager.ts        # Pulse stub
│   ├── ingest-discord.ts          # Pulse stub
│   ├── ingest-twitter.ts          # Pulse stub
│   ├── institution-metrics.ts     # Beacon — campus rollup
│   ├── journalist-profiler.ts     # Pulse stub
│   ├── keyword-paper-match.ts     # Beacon — keyword retrieval
│   ├── llm-classifier.ts, llm-fetcher.ts, llm-monitor-ui.ts, llm-snapshot-generator.ts  # Pulse stubs
│   ├── narrative-gap-detector.ts, narrative-report-generator.ts  # Pulse stubs
│   ├── observations.ts            # Beacon — append-only writer + reader
│   ├── outreach-generator.ts      # Beacon — Faculty Outreach Generator
│   ├── outreach-prompts.ts        # Beacon — 5 persona prompts
│   ├── post-incident-analyzer.ts  # Pulse (still has body, dead-coded)
│   ├── prep.ts                    # Pulse stub
│   ├── prioritization-scoring.ts  # excluded from tsc
│   ├── professor-enrichment.ts    # Beacon
│   ├── propagation-detector.ts    # Pulse stub
│   ├── pull-through.ts, pullthrough.ts  # Pulse stubs
│   ├── resource-content-core.ts, resource-content.ts, resource-display.ts, resource-markdown.tsx
│   ├── sheerid-mock.ts            # Beacon — mocked SheerID
│   ├── sources/{arxiv.ts, hn.ts, index.ts, reddit.ts, rss.ts, youtube.ts}  # arxiv real, others stubs
│   ├── supabase-admin.ts, supabase-browser.ts, supabase-server.ts
│   ├── types.ts                   # barrel re-export
│   ├── types/{ambassador.ts, beacon-core.ts, discount.ts, event.ts, intelligence.ts, outreach.ts,
│   │          pulse-legacy.ts, resource.ts}
│   ├── velocity.ts                # Pulse stub
│   ├── warroom-ui.ts              # Pulse leftover
│   └── workqueue.ts               # Beacon — Monday Morning Workqueue
├── scripts/enrich-all.ts
├── supabase/
│   ├── seed.ts
│   ├── migrations/
│   │   ├── 001_initial_beacon_slice.sql
│   │   ├── 002_ambassadors.sql
│   │   ├── 003_events.sql
│   │   ├── 004_resources.sql
│   │   ├── 005_discount.sql
│   │   └── 007_outreach.sql
│   ├── migrations-archive/       # 001-009: pre-Beacon Pulse migrations, NOT applied to current DB
│   └── .temp/{cli-latest, gotrue-version, pooler-url, postgres-version, project-ref, rest-version,
│              storage-migration, storage-version}
└── tests/
    ├── ambassador-scoring.test.ts
    ├── event-playbooks.test.ts
    ├── keyword-paper-match.test.ts
    ├── outreach-generator.test.ts
    ├── resources.test.ts
    ├── sheerid-mock.test.ts
    ├── workqueue.test.ts
    └── evals/{README.md, github-institutional-50.json, professors-20.json,
                results/{.gitignore, 2026-04-13T10-11-31.326Z.json},
                runner.ts, scripts/compute-expected-counts.ts}
```

> Note: large parts of `app/api/`, `lib/`, and `components/` are explicitly excluded from `tsc` and contain `// Pulse port stub` no-ops. See §12 "Known gaps and TODOs" for the full list.

### Tech stack

- **Framework:** Next.js 16 App Router (`"next": "^16.2.0"` in `package.json`), TypeScript strict mode (`tsconfig.json` `"strict": true`).
- **Language:** TypeScript ≥5, target `ES2017`, module `esnext`, `moduleResolution: "bundler"`, alias `@/*` → project root.
- **ORM / DB client:** No ORM. Direct Supabase JS client (`@supabase/supabase-js@^2.99.3`) with raw `.from(...).select/insert/update/upsert` calls. Server-side cookie-aware client via `@supabase/ssr@^0.9.0`.
- **Database:** Supabase Postgres (project ref `gtggbwcncdpzyfndohvg`, see `supabase/.temp/project-ref` and `.env.local`). RLS enabled with `anon SELECT` + `service_role` write policies.
- **Deployment target:** Vercel (`vercel.json` with `crons` schedule). Plan/limits: unknown (no `.vercelconfig`/`project.json` in the repo).

### `package.json` dependencies grouped

**UI / Markdown / Charts**
- `lucide-react@^0.468.0`
- `react@^18`, `react-dom@^18`
- `react-markdown@^10.1.0`, `remark-directive@^4.0.0`, `remark-gfm@^4.0.1`, `remark-sectionize@^2.1.0`, `rehype-autolink-headings@^7.1.0`, `rehype-slug@^6.0.0`, `unist-util-visit@^5.1.0`
- `shiki@^4.0.2` (code highlighting)
- `recharts@^3.8.0`, `react-simple-maps@^3.0.0` (maps for `components/discount/GeographyMap.tsx`)
- `date-fns@^4.1.0`
- Dev: `tailwindcss@^3.4.1`, `postcss@^8`, `@tailwindcss/typography@^0.5.19`, `mermaid@^11.14.0` (for `components/resources/MermaidDiagram.tsx`)

**Data / Validation**
- `@supabase/ssr@^0.9.0`, `@supabase/supabase-js@^2.99.3`
- `zod@^3.24.2`
- `rss-parser@^3.13.0` (used by `lib/sources/arxiv.ts`)

**AI**
- No SDK. Anthropic is called via plain `fetch` to `https://api.anthropic.com/v1/messages` (see `lib/outreach-generator.ts:274`).

**Infra / Build / Test**
- `next@^16.2.0`, `eslint-config-next@^16.2.0`, `eslint@^9.39.4`
- `vitest@^3.0.8`, `tsx@^4.19.3`
- `typescript@^5`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/react-simple-maps`

### Environment variables

There is no `.env.example` in the repo. The actual `.env.local` defines:

```
NEXT_PUBLIC_SUPABASE_URL=https://gtggbwcncdpzyfndohvg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
ANTHROPIC_API_KEY=sk-ant-api03-…
```

`.cursor/rules/stack.md` lists the full required + optional set:

> Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
> Optional (post-demo): `GITHUB_TOKEN`, `SERPAPI_KEY`, `SHEERID_API_KEY`.

Other env names referenced in the legacy/excluded code (search hits in `app/api/cron/route.ts`): `CRON_SECRET`, `OPENAI_API_KEY`, `GOOGLE_AI_API_KEY`, `PERPLEXITY_API_KEY` — none of these are set or used by the Beacon code paths.

---

## 2. Database schema

The active migrations live in `supabase/migrations/` and are sequential `001 → 005, 007` (`006` is intentionally absent — unknown why; the tree shows none). `supabase/migrations-archive/` is the pre-Beacon Pulse history and is not applied.

### Migration history (chronological)

| File | Purpose |
|---|---|
| `001_initial_beacon_slice.sql` | `institutions`, `professors`, `observations` + RLS + indexes |
| `002_ambassadors.sql` | `ambassadors`, `ambassador_activity` + indexes + RLS |
| `003_events.sql` | `events`, `event_attendees` + `bump_event_attendee_count` trigger + RLS (incl. anon RSVP insert) |
| `004_resources.sql` | `resource_views` + RLS |
| `005_discount.sql` | `verification_attempts` (with status CHECK) + RLS |
| `007_outreach.sql` | `outreach_target_type` + `outreach_stage` enums; `outreach_touchpoints` + RLS |

The archived `supabase/migrations-archive/` history (`001_initial`, `002_prep_documents`, `003_bookmarks`, `004_narrative_topic`, `005_pulse_settings` / `005_pullthrough`, `006_audiences`, `007_narratives`, `008_llm_monitoring`, `009_twitter_discord_propagation`) is from the Pulse predecessor. The Beacon code references some of those tables (`mentions`, `incidents`, `llm_probes`, `audiences`, etc.) inside the legacy/excluded routes — they are **not** part of the active Beacon schema.

### Active tables (full DDL, copy-paste from migration files)

#### `institutions` — entity (reference)

```3:10:supabase/migrations/001_initial_beacon_slice.sql
CREATE TABLE institutions (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  cs_program_tier int,
  sheerid_supported boolean,
  created_at timestamptz DEFAULT now()
);
```

RLS: enabled. Policies: `institutions_anon_select` (`SELECT TO anon USING true`), `institutions_service_role_insert/update`. Grants: `SELECT TO anon`, `ALL TO service_role`.

#### `professors` — entity (projection from observations)

```12:25:supabase/migrations/001_initial_beacon_slice.sql
CREATE TABLE professors (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  name text NOT NULL,
  title text,
  lab_name text,
  arxiv_author_id text,
  homepage_url text,
  recent_relevant_papers_count int NOT NULL DEFAULT 0,
  ai_stance_quote text,
  ai_stance_source_url text,
  public_statements jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_enriched_at timestamptz
);
```

FK: `institution_id → institutions(id) ON DELETE RESTRICT`. No additional indexes. RLS as above.

#### `observations` — append-only log (source of truth)

```27:46:supabase/migrations/001_initial_beacon_slice.sql
CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  observation_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  source_url text,
  confidence real NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX observations_entity_observed_at_idx ON observations (
  entity_type,
  entity_id,
  observed_at DESC
);

CREATE INDEX observations_type_observed_at_idx ON observations (observation_type, observed_at DESC);
```

No FKs (deliberate — `entity_id` is polymorphic). RLS: `anon SELECT`, `service_role INSERT`. **No UPDATE or DELETE policy on `observations`** — the table is truly append-only at the policy layer.

#### `ambassadors` — entity (projection)

```3:21:supabase/migrations/002_ambassadors.sql
CREATE TABLE ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  email text NOT NULL,
  name text NOT NULL,
  github_username text,
  application_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  score jsonb,
  stage text NOT NULL,
  health_score int NOT NULL DEFAULT 0,
  accepted_at timestamptz,
  last_active_at timestamptz
);

CREATE INDEX ambassadors_institution_id_idx ON ambassadors (institution_id);

CREATE INDEX ambassadors_stage_idx ON ambassadors (stage);

CREATE INDEX ambassadors_last_active_at_idx ON ambassadors (last_active_at DESC NULLS LAST);
```

FK: `institution_id → institutions(id) ON DELETE RESTRICT`. The `stage` column is plain `text` (no DB enum); allowed values come from the TS union `AmbassadorStage` and a Zod schema.

#### `ambassador_activity` — projection / activity log (per-ambassador)

```23:31:supabase/migrations/002_ambassadors.sql
CREATE TABLE ambassador_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  ambassador_id uuid NOT NULL REFERENCES ambassadors (id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ambassador_activity_ambassador_created_idx ON ambassador_activity (ambassador_id, created_at DESC);
```

#### `events` — entity (operational)

```4:22:supabase/migrations/003_events.sql
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  institution_id text NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  ambassador_id uuid,
  event_type text NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  tracking_code text NOT NULL UNIQUE,
  attendee_count int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_institution_id_idx ON events (institution_id);

CREATE INDEX events_scheduled_at_idx ON events (scheduled_at DESC);

CREATE INDEX events_status_idx ON events (status);
```

FK: `institution_id → institutions(id)`. **No FK on `ambassador_id`** (the migration comment says: `-- ambassador_id: no FK until ambassadors table exists; add REFERENCES later.` — the FK was never added). `tracking_code` has a `UNIQUE` constraint. `event_type` is plain text; allowed values come from `EVENT_TYPES` in `lib/types/event.ts`.

#### `event_attendees` — projection

```24:33:supabase/migrations/003_events.sql
CREATE TABLE event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  event_id uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  attended_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE INDEX event_attendees_event_id_idx ON event_attendees (event_id);
```

Trigger `event_attendees_bump_count` (AFTER INSERT) calls `bump_event_attendee_count()`, which does `UPDATE events SET attendee_count = attendee_count + 1 WHERE id = NEW.event_id`. RLS allows anon INSERT only (used by `/r/[trackingCode]` public RSVP), gated by `length(trim(email)) > 0 AND EXISTS (... events e WHERE e.id = event_id)`.

#### `resource_views` — observation/log (audit)

```3:16:supabase/migrations/004_resources.sql
CREATE TABLE resource_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  resource_slug text NOT NULL,
  viewer_id text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  time_on_page_seconds int
);

CREATE INDEX resource_views_slug_viewed_at_idx ON resource_views (
  resource_slug,
  viewed_at DESC
);

CREATE INDEX resource_views_viewed_at_idx ON resource_views (viewed_at DESC);
```

#### `verification_attempts` — observation/log (operational + audit)

```3:27:supabase/migrations/005_discount.sql
CREATE TABLE verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  email text NOT NULL,
  country text,
  claimed_institution text,
  sheerid_response_code text NOT NULL,
  status text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_attempts_status_check CHECK (
    status IN (
      'pending',
      'approved',
      'rejected',
      'manual_review'
    )
  )
);

CREATE INDEX verification_attempts_status_created_at_idx ON verification_attempts (status, created_at DESC);

CREATE INDEX verification_attempts_country_idx ON verification_attempts (country);
```

#### `outreach_touchpoints` — entity (operational)

Defines two Postgres enums first:

```3:18:supabase/migrations/007_outreach.sql
CREATE TYPE outreach_target_type AS ENUM (
  'professor',
  'student_org',
  'ta',
  'department_chair',
  'hackathon_organizer'
);

CREATE TYPE outreach_stage AS ENUM (
  'cold',
  'contacted',
  'meeting_booked',
  'demo_held',
  'partnership_active',
  'dead'
);
```

```20:41:supabase/migrations/007_outreach.sql
CREATE TABLE outreach_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  target_type outreach_target_type NOT NULL,
  target_id text NOT NULL,
  target_name text NOT NULL,
  stage outreach_stage NOT NULL DEFAULT 'cold',
  channel text NOT NULL,
  subject_line text NOT NULL DEFAULT '',
  draft_content text NOT NULL DEFAULT '',
  sent_at timestamptz,
  reply_detected_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_touchpoints_channel_chk CHECK (
    channel IN ('email', 'meeting', 'event')
  )
);

CREATE INDEX outreach_touchpoints_stage_idx ON outreach_touchpoints (stage);

CREATE INDEX outreach_touchpoints_target_idx ON outreach_touchpoints (target_type, target_id);
```

`target_id` has no DB FK (polymorphic — could reference a professor slug, a student org, etc.).

### Tables documented in `SCHEMA.md` but not present in `supabase/migrations/`

These are described in `SCHEMA.md` but **doesn't exist yet** in any active migration:
- `student_orgs`
- `ingestion_logs` (referenced in legacy `app/api/cron/route.ts` — would have come from Pulse archive)
- `classifications`
- `institution_user_mappings`
- `entity_snapshots`
- `actions_log`

### Entity vs projection vs log/observation classification

| Table | Type |
|---|---|
| `institutions` | Reference / entity |
| `professors` | Entity (projection from `observations`) |
| `ambassadors` | Entity (projection) |
| `events` | Entity (mostly authored, with observation events tracking changes) |
| `outreach_touchpoints` | Entity (CRM record) |
| `ambassador_activity` | Projection / per-ambassador denormalized log (cascade on ambassador delete) |
| `event_attendees` | Projection (bumps `events.attendee_count` via trigger) |
| `verification_attempts` | Operational + observation/log hybrid (each row is itself a verification event; observations are also written separately) |
| `resource_views` | Observation/log (audit only) |
| `observations` | **THE** append-only log; source of truth |

### Exact shape of `observations`

Already shown above (`001_initial_beacon_slice.sql:27-46`). Indexes:
- `observations_entity_observed_at_idx` on `(entity_type, entity_id, observed_at DESC)`
- `observations_type_observed_at_idx` on `(observation_type, observed_at DESC)`

TypeScript shape (from `lib/types/beacon-core.ts:60-79`):

```60:79:lib/types/beacon-core.ts
export interface Observation {
  id: string;
  entity_type:
    | "institution"
    | "professor"
    | "ambassador"
    | "student_org"
    | "outreach"
    | "event"
    | "resource"
    | "verification";
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number;
  observed_at: string;
  created_at: string;
}
```

---

## 3. Observation log mechanics

### Schema (see §2 above)

### Single writer: `lib/observations.ts`

```27:52:lib/observations.ts
export async function logObservation(params: {
  entity_type: Observation["entity_type"];
  entity_id: string;
  observation_type: ObservationType;
  payload: Record<string, unknown>;
  source: ObservationSource;
  source_url?: string;
  confidence: number;
}): Promise<Observation> {
  const { data, error } = await supabaseAdmin
    .from("observations")
    .insert({
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      observation_type: params.observation_type,
      payload: params.payload,
      source: params.source,
      source_url: params.source_url ?? null,
      confidence: params.confidence,
    })
    .select()
    .single();

  if (error) throw error;
  return mapObservationRow(data as Record<string, unknown>);
}
```

A reader helper for professor timelines is co-located: `listObservationsForProfessor(client, id, {limit, ascending})`.

### Call sites that write observations

(Found via grep on `logObservation(`. Each row gives file → function → `entity_type` / `observation_type`.)

| File | Function (or context) | entity_type | observation_type | source | confidence |
|---|---|---|---|---|---|
| `lib/professor-enrichment.ts:74` | `enrichProfessor` (per paper) | `professor` | `paper_detected` | `arxiv` | `0.9` |
| `lib/professor-enrichment.ts:91` | `enrichProfessor` (per matched paper) | `professor` | `paper_matches_keywords` | `keyword_match` | `0.9` |
| `lib/professor-enrichment.ts:117` | `enrichProfessor` (aggregate) | `professor` | `professor_enriched` | `arxiv` | `0.9` |
| `lib/ambassador-pipeline.ts:166` | `advanceAmbassadorStage` | `ambassador` | `ambassador_accepted` / `ambassador_rejected` / `ambassador_activity_logged` (chosen by `observationTypeForAdvance`) | `manual` | `1.0` |
| `lib/ambassador-scoring.ts:112` | `scoreAmbassador` | `ambassador` | `ambassador_scored` | `manual` | `0.7` (`SCORING_CONFIDENCE`) |
| `lib/ambassador-health.ts:131` | `computeHealthScore` | `ambassador` | `ambassador_health_computed` | `manual` | `0.7` |
| `lib/event-mutations.ts:72` | `createEventWithObservation` | `event` | `event_created` | `manual` | `1` |
| `lib/event-mutations.ts:115` | `updateEventWithObservation` | `event` | `event_updated` | `manual` | `1` |
| `lib/event-mutations.ts:159` | `insertAttendeeAndBumpCount` | `event` | `event_attendee_recorded` | `manual` | `1` |
| `lib/sheerid-mock.ts:110` | `logVerificationAttemptedObservation` | `institution` | `verification_attempted` | `sheerid` | `0.9` (`MOCK_CONFIDENCE`) |
| `lib/outreach-generator.ts:386` | `generateOutreachDraft` (professor not found path) | `outreach` | `outreach_drafted` | `manual` | `1` |
| `lib/outreach-generator.ts:471` | `generateOutreachDraft` (professor path success) | `outreach` | `outreach_drafted` | `manual` (template) or `classification` (Claude) | `1` template / `0.75` Claude |
| `lib/outreach-generator.ts:523` | `generateOutreachDraft` (non-professor target path) | `outreach` | `outreach_drafted` | `manual` / `classification` | same as above |
| `app/api/ambassadors/route.ts:49` | `POST /api/ambassadors` | `ambassador` | `ambassador_applied` | `manual` | `1.0` |
| `app/api/ambassadors/[id]/route.ts:106` | `PATCH /api/ambassadors/[id]` | `ambassador` | `ambassador_enriched` | `manual` | `1.0` |
| `app/api/verification/[id]/approve/route.ts:87` | `POST .../approve` | `institution` | `cursor_user_institution_mapped` | `manual` | `1.0` |
| `app/api/verification/[id]/approve/route.ts:101` | `POST .../approve` | `institution` | `action_completed` (`kind: "verification_approved"`) | `manual` | `1.0` |
| `app/api/verification/[id]/reject/route.ts:73` | `POST .../reject` | `institution` | `action_completed` (`kind: "verification_rejected"`) | `manual` | `1.0` |
| `app/api/outreach/[id]/route.ts:185` | `PATCH /api/outreach/[id]` (when first `sent_at`) | `outreach` | `outreach_sent` | `manual` | `1` |
| `app/api/outreach/[id]/route.ts:203` | `PATCH /api/outreach/[id]` (when reply detected) | `outreach` | `outreach_reply_detected` | `manual` | `1` |
| `app/api/workqueue/complete/route.ts:35` | `POST /api/workqueue/complete` | `professor` / `ambassador` / `institution` | `action_completed` (`completed_via: "dashboard_workqueue"`) | `manual` | `1.0` |

### Conventions in actual use

- **`source` values used in code:** `"arxiv"`, `"keyword_match"`, `"manual"`, `"sheerid"`, `"classification"`. Declared but unused: `"github"`, `"typeform"`, `"syllabus_scrape"`, `"serpapi"`, `"telemetry_mock"`, `"mlh"` (see `lib/types/beacon-core.ts:47-58`).
- **Confidence:** the documented ladder is in `.cursor/rules/data-contracts.md` ("1.0 verified, 0.9 strong automated signal, 0.7 multiple corroborating, 0.5 single moderate, 0.3 weak, 0.0 placeholder"). Actual usage: `1.0` (manual user actions), `0.9` (arXiv ingestion + SheerID mock), `0.75` (Claude-generated drafts), `0.7` (heuristic scoring + health).
- **Timestamps:** `observed_at` and `created_at` both default to `now()` at the DB. Never set by callers; treated as wall-clock.
- **`entity_type` values seen in writes:** `"professor"`, `"ambassador"`, `"institution"`, `"event"`, `"outreach"`. Declared but never written: `"student_org"`, `"resource"`, `"verification"` (the actual verification observations are written under `entity_type: "institution"` with `entity_id` derived from the email — see `inferInstitutionEntityId`).
- **`entity_id` linkage:**
  - `professors`, `institutions`: slug strings (`"sasha-rush"`, `"mit"`).
  - `ambassadors`, `events`, `outreach_touchpoints`: UUIDs.
  - For verification, the `entity_id` is **not** the verification UUID — it is `inferInstitutionEntityId(email)`:

```44:62:lib/sheerid-mock.ts
export function inferInstitutionEntityId(email: string): string {
  const host = emailDomain(email);
  if (!host) return "discount-unscoped";
  if (hostEndsWith(host, "edu")) {
    const base = host.endsWith(".edu") ? host.slice(0, -4) : host;
    const segments = base.split(".").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1]! : "discount-unscoped";
  }
  if (hostEndsWith(host, "ac.uk")) {
    const segs = host.split(".");
    return segs[0] || "discount-unscoped";
  }
  if (hostEndsWith(host, "ac.jp")) {
    const segs = host.split(".");
    return segs[0] || "discount-unscoped";
  }
  return "discount-unscoped";
}
```

### Projection logic

The "projection" is implemented inline next to each writer (no central reducer). Examples:

- **Professor projection** (`lib/professor-enrichment.ts:127-141`):

```127:141:lib/professor-enrichment.ts
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
```

After the loop logs N `paper_detected` and M `paper_matches_keywords` rows, the projection is `recent_relevant_papers_count = (count of matching papers in last 24 months)` plus `last_enriched_at = now`. Re-derivable by replaying observations.

- **Ambassador projection** (`lib/ambassador-pipeline.ts:185-201`): updates `stage` and conditionally `accepted_at` after writing the observation. Score is persisted in the `score` jsonb column by `app/api/ambassadors/[id]/score/route.ts:59-66`.

- **Event projection**: `events.attendee_count` is bumped by the `event_attendees_bump_count` SQL trigger (`003_events.sql:36-53`); other event mutations write the observation then update the row in the same `event-mutations.ts` function.

- **No central "rebuild from observations" function exists yet.** The system is convention-only: every writer writes the obs, then writes the projection.

### Helpers

- `logObservation(...)` — writer (admin, service role).
- `listObservationsForProfessor(client, professorId, {limit, ascending})` — reader (any client). Returns mapped `Observation[]`.
- `listObservationsForAmbassador(client, ambassadorId, {limit, ascending})` (`lib/ambassador-pipeline.ts:91-121`) — same shape for ambassador.
- `mapObservationRow` is duplicated inline in `lib/observations.ts:9-22` and in dashboard pages (e.g. `app/dashboard/institutions/[id]/page.tsx:13-26`).

---

## 4. Existing entity types

### Professors

**Schema:** see §2 (`professors`). Slug PK, FK to `institutions`, projection columns `recent_relevant_papers_count`, `ai_stance_quote`, `ai_stance_source_url`, `public_statements jsonb`, `last_enriched_at`.

**API routes:**
- `POST /api/professors/[id]/enrich` (`app/api/professors/[id]/enrich/route.ts`) — kicks off `enrichProfessor` (write).
- Reads happen via direct Supabase calls in pages (no `GET /api/professors`). The `tests/evals/runner.ts` harness uses the same `enrichProfessor` function directly.

**UI:**
- `/dashboard/professors` (list — page exists at `app/dashboard/professors/page.tsx`)
- `/dashboard/professors/[id]` — profile + observation timeline + top matching papers + Re‑enrich button.
- `/dashboard/institutions/[id]` shows the professor table for that campus.

**Scoring/ranking:** No professor score per se. The proxy metric is `recent_relevant_papers_count` from arXiv keyword retrieval (see §11 "retrieval over classification"). Faculty outreach prioritization in the workqueue uses `68 + min(count, 12) * 0.35` as the priority score (see §7).

**State machine:** None. There is `last_enriched_at` (timestamp) and the observation timeline; no enum/state.

**External integrations:** arXiv (live, via `lib/sources/arxiv.ts`). Keyword matching is local (`lib/keyword-paper-match.ts`). The other slots (homepage scrape, syllabus extraction, public statement search) exist as data shapes only — `syllabus_found` and `ai_stance_extracted` observation types are declared but no producer code exists yet.

### Ambassadors

**Schema:** see §2 (`ambassadors`, `ambassador_activity`).

**API routes:**
- `POST /api/ambassadors` — create (`app/api/ambassadors/route.ts`). Validates with `createAmbassadorBodySchema`, looks up the institution, logs `ambassador_applied`, calls `scoreAmbassador`, inserts the row, inserts an `ambassador_activity` row (`activity_type: "application_submitted"`).
- `GET /api/ambassadors/[id]` — fetch single.
- `PATCH /api/ambassadors/[id]` — update name / github_username / last_active_at; logs `ambassador_enriched`.
- `POST /api/ambassadors/[id]/advance` — stage transition; legality check + observation + activity row + projection update.
- `POST /api/ambassadors/[id]/score` — recompute score from stored `application_data` and persist.
- `POST /api/ambassadors/[id]/health` — recompute health.

**UI:**
- `/dashboard/ambassadors` — filtered/sorted table.
- `/dashboard/ambassadors/new` — manual-entry application form (`AmbassadorApplicationForm`).
- `/dashboard/ambassadors/[id]` — score breakdown, health card, advance-stage card, raw application_data, observation timeline.

**Scoring:** Four-dimension weighted, see §5.

**Stage state machine:** declared in `lib/types/ambassador.ts:22-30` and enforced in `lib/ambassador-pipeline.ts:14-24`:

```14:24:lib/ambassador-pipeline.ts
const LEGAL_TRANSITIONS: Record<AmbassadorStage, readonly AmbassadorStage[]> = {
  applied: ["under_review", "rejected"],
  under_review: ["accepted", "rejected"],
  accepted: ["onboarding"],
  onboarding: ["active"],
  active: ["slowing", "inactive"],
  slowing: ["active", "inactive"],
  rejected: [],
  inactive: [],
};
```

`advanceAmbassadorStage` chooses the observation type via `observationTypeForAdvance` (`accepted` → `ambassador_accepted`, `rejected` → `ambassador_rejected`, otherwise `ambassador_activity_logged`).

**External integrations:** None. The `application_data` shape is "Typeform-shaped" (per the ambassador types comment) but the ingestion path is manual-only — there is **no Typeform webhook endpoint**. README confirms: "ambassador applications flow through Typeform → Supabase webhook" — but the Supabase webhook does not exist in the code.

### Events

**Schema:** see §2 (`events`, `event_attendees`).

**Enums (TS-only — DB columns are plain text):**

```6:23:lib/types/event.ts
export const EVENT_TYPES = [
  "cafe_cursor",
  "hackathon_sponsorship",
  "workshop",
  "lab_demo",
  "professor_talk",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_STATUSES = [
  "draft",
  "scheduled",
  "completed",
  "cancelled",
] as const;
```

**API routes:**
- `GET /api/events` — list (filter by `institution_id`, `status`).
- `POST /api/events` — create. Generates `tracking_code` via `randomUUID()` (server-only, `crypto`). Calls `createEventWithObservation`.
- `GET/PATCH /api/events/[id]` — fetch / update; `PATCH` calls `updateEventWithObservation`.
- `GET/POST /api/events/[id]/attendees` — list / insert (uses `insertAttendeeAndBumpCount`).

**UI:**
- `/dashboard/events`, `/dashboard/events/new`, `/dashboard/events/[id]`.
- `/r/[trackingCode]` (public RSVP page; uses `tracking_code` UNIQUE column to look up the event).

**Status state machine:** Not enforced — `EVENT_STATUSES` is only an enum on the type side, no transition table. `lib/event-attribution.ts:23-33` is a placeholder for marking `activated_at`:

```19:33:lib/event-attribution.ts
/**
 * Placeholder: returns shouldMarkActivated when activatedAt is provided.
 * Future: match email against verified student / telemetry events.
 */
export function evaluateActivationAttribution(
  input: AttributionInput
): AttributionResult {
  if (!input.activatedAt?.trim()) {
    return { shouldMarkActivated: false, activatedAt: null };
  }
  return {
    shouldMarkActivated: true,
    activatedAt: input.activatedAt.trim(),
  };
}
```

**Playbooks:** `lib/event-playbooks.ts` — five hard-coded `PlaybookStep[]` arrays (cafe_cursor, hackathon_sponsorship, workshop, lab_demo, professor_talk).

**External integrations:** None. Luma and Eventbrite are mentioned in your prompt but **doesn't exist yet** — no client code, no webhook, no env var.

### Verifications (Discount Provisioning)

**Schema:** see §2 (`verification_attempts`).

**Status enum (DB CHECK):** `pending | approved | rejected | manual_review`.

**API routes:**
- `POST /api/verification` (`app/api/verification/route.ts`) — body validated by `createVerificationBodySchema`, calls `simulateVerification(email, country)`, inserts the row, then `logVerificationAttemptedObservation`.
- `POST /api/verification/[id]/approve` — flips status to `approved`, logs two observations (`cursor_user_institution_mapped` + `action_completed`).
- `POST /api/verification/[id]/reject` — flips to `rejected`, logs `action_completed` (kind `verification_rejected`).

**UI:**
- `/dashboard/discount` — overview metrics + 15-row recent activity feed sourced from observations.
- `/dashboard/discount/queue` — `VerificationQueue` client component.
- `/dashboard/discount/geography` — `GeographyMap` (uses `react-simple-maps`, `lib/discount-country.ts`).

**State machine:** Status check constraint enforces the four values; no in-code transition graph (any service-role write satisfies the CHECK). `simulateVerification` chooses the initial `(sheerid_response_code, status)` pair:

```64:99:lib/sheerid-mock.ts
export function simulateVerification(
  email: string,
  country: string | null | undefined
): SimulatedVerificationResult {
  const trimmedEmail = email.trim();
  const domain = emailDomain(trimmedEmail);

  if (domain === FIXTURE_HOST) {
    const local = trimmedEmail.split("@")[0]?.toLowerCase() ?? "";
    if (local === "expired") {
      return { sheerid_response_code: "expired_credentials", status: "pending" };
    }
    if (local === "unknown") {
      return { sheerid_response_code: "institution_not_found", status: "pending" };
    }
  }

  const c = country?.trim().toLowerCase() ?? "";
  if (c && COUNTRY_UNSUPPORTED.has(c)) {
    return { sheerid_response_code: "country_unsupported", status: "pending" };
  }

  if (hostEndsWith(domain, "ac.uk") || hostEndsWith(domain, "ac.jp")) {
    return { sheerid_response_code: "success", status: "manual_review" };
  }

  if (hostEndsWith(domain, "edu")) {
    return { sheerid_response_code: "success", status: "approved" };
  }

  if (isGenericConsumerDomain(domain)) {
    return { sheerid_response_code: "email_domain_mismatch", status: "pending" };
  }

  return { sheerid_response_code: "institution_not_found", status: "pending" };
}
```

**External integrations:** SheerID is **mocked** (`lib/sheerid-mock.ts`). Production swap-in is anticipated but not implemented (file header: "Production replaces this module with the live SheerID client.").

### Applications

There is no separate `applications` table. "Application" in Beacon means "ambassador application", stored in `ambassadors.application_data jsonb` (per `lib/types/ambassador.ts:7-12`):

```7:12:lib/types/ambassador.ts
export interface AmbassadorApplicationData {
  why_cursor: string;
  past_community_work: string;
  proposed_events: string;
  expected_reach: string;
}
```

Validated server-side in `app/api/ambassadors/schemas.ts`.

### Outreach (5th major entity worth listing)

**Schema:** see §2 (`outreach_touchpoints`). Two Postgres enums (`outreach_target_type`, `outreach_stage`).

**API routes:**
- `GET /api/outreach` (filters by `target_type`, `institution_id`, `channel`).
- `POST /api/outreach` — creates touchpoint, then immediately calls `generateOutreachDraft` and persists the draft to `subject_line` / `draft_content`.
- `GET/PATCH /api/outreach/[id]` — read (with attached professor + observations); update with stage-transition legality enforcement.
- `GET /api/outreach/[id]/draft` — read current draft fields.
- `POST /api/outreach/[id]/draft` — regenerate draft.

**UI:** `/dashboard/outreach` (kanban-by-stage), `/dashboard/outreach/new`, `/dashboard/outreach/[id]`.

**Stage machine:** `STAGE_ORDER = [cold, contacted, meeting_booked, demo_held, partnership_active]`. `dead` is reachable from any non-`dead` stage. From `dead` no transitions are legal. See §6.

**External integrations:** Claude (live; falls back to a template if no `ANTHROPIC_API_KEY`).

---

## 5. Scoring and ranking patterns

There is exactly one scoring function in active use: ambassador application scoring. (Workqueue ranking is similar in spirit but different in scope; it's covered in §7.)

### Full scoring code

```1:99:lib/ambassador-scoring.ts
import { logObservation } from "@/lib/observations";
import type { AmbassadorApplicationData, AmbassadorScore } from "@/lib/types";

const W_RESEARCH = 0.3;
const W_STUDENT_REACH = 0.25;
const W_ADOPTION = 0.25;
const W_NETWORK = 0.2;

const RESEARCH_KEYWORDS =
  /\b(cursor|llm|language model|research|paper|arxiv|ai coding|code generation|machine learning|nlp|software engineering|productivity)\b/gi;

const ADOPTION_KEYWORDS =
  /\b(workshop|hackathon|event|meetup|talk|demo|session|series|bootcamp|cafe)\b/gi;

const NETWORK_KEYWORDS =
  /\b(lead|organiz|president|chair|volunteer|chapter|community|mentor|founder|team)\b/gi;

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreByLength(text: string, minGood = 80, maxGood = 400): number {
  const t = text.trim();
  if (t.length === 0) return 15;
  if (t.length < 40) return clamp100(20 + t.length * 0.5);
  if (t.length < minGood) return clamp100(35 + (t.length / minGood) * 35);
  if (t.length <= maxGood) return clamp100(70 + (t.length / maxGood) * 25);
  return 95;
}

function scoreResearchAlignment(why_cursor: string): number {
  const base = scoreByLength(why_cursor, 100, 500);
  const matches = why_cursor.match(RESEARCH_KEYWORDS);
  const bonus = Math.min(25, (matches?.length ?? 0) * 5);
  return clamp100(base * 0.65 + bonus);
}

/** Parse a rough numeric reach from free text (e.g. "500+", "~200 students") */
function parseReachNumber(text: string): number | null {
  const m = text.match(/[\d,]+/);
  if (!m) return null;
  const n = Number.parseInt(m[0].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function scoreStudentReach(expected_reach: string): number {
  const t = expected_reach.trim();
  if (!t) return 10;
  const n = parseReachNumber(t);
  if (n !== null) {
    if (n >= 500) return 95;
    if (n >= 200) return 80;
    if (n >= 80) return 65;
    if (n >= 30) return 50;
    return clamp100(25 + n * 0.5);
  }
  return scoreByLength(t, 40, 200) * 0.85;
}

function scoreAdoptionSignal(proposed_events: string): number {
  const base = scoreByLength(proposed_events, 60, 350);
  const matches = proposed_events.match(ADOPTION_KEYWORDS);
  const bonus = Math.min(30, (matches?.length ?? 0) * 8);
  return clamp100(base * 0.6 + bonus);
}

function scoreNetworkInfluence(past_community_work: string): number {
  const base = scoreByLength(past_community_work, 80, 400);
  const matches = past_community_work.match(NETWORK_KEYWORDS);
  const bonus = Math.min(25, (matches?.length ?? 0) * 6);
  return clamp100(base * 0.65 + bonus);
}

/**
 * Pure scoring for tests and reuse (no I/O).
 */
export function computeAmbassadorScoreFromApplicationData(
  data: AmbassadorApplicationData
): AmbassadorScore {
  const research_alignment = scoreResearchAlignment(data.why_cursor);
  const student_reach = scoreStudentReach(data.expected_reach);
  const adoption_signal = scoreAdoptionSignal(data.proposed_events);
  const network_influence = scoreNetworkInfluence(data.past_community_work);

  const total = clamp100(
    W_RESEARCH * research_alignment +
      W_STUDENT_REACH * student_reach +
      W_ADOPTION * adoption_signal +
      W_NETWORK * network_influence
  );

  return {
    research_alignment,
    student_reach,
    adoption_signal,
    network_influence,
    total,
  };
}
```

### Inputs / weights / output / edge cases

- **Inputs:** `AmbassadorApplicationData = { why_cursor, past_community_work, proposed_events, expected_reach }` (all strings).
- **Weights:** research 30 %, student reach 25 %, adoption signal 25 %, network influence 20 %.
- **Output:** `AmbassadorScore = { research_alignment, student_reach, adoption_signal, network_influence, total }` — each component is `0..100`, integers (`clamp100` rounds and clamps); `total` is the weighted sum, also clamped.
- **Edge cases:**
  - Empty text: research/network/adoption return `15`, student reach returns `10`.
  - `< 40` chars: very small linear curve (`20 + len * 0.5`).
  - "Big numbers" in `expected_reach`: short-circuit ladder (≥500 → 95, ≥200 → 80, ≥80 → 65, ≥30 → 50, else linear). Non-numeric falls through to `scoreByLength * 0.85`.
  - Keyword bonus is **capped** (research 25, adoption 30, network 25) so a keyword-stuffed answer can't dominate.

### Where the score is stored

- **Persisted** (computed at write-time): `ambassadors.score jsonb` column. Written once on `POST /api/ambassadors` and recomputed by `POST /api/ambassadors/[id]/score`.
- The score is also written to the observation log with `observation_type: "ambassador_scored"` (`lib/ambassador-scoring.ts:112-126`).

### How the score is decomposed in UI

`components/ambassadors/AmbassadorScoreCard.tsx` renders five `MetricCard`s — total + each weighted dimension with the weight printed in the label:

```16:39:components/ambassadors/AmbassadorScoreCard.tsx
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard value={score.total} label="Total score" mono />
      <MetricCard
        value={score.research_alignment}
        label="Research alignment (30%)"
        mono
      />
      <MetricCard
        value={score.student_reach}
        label="Student reach (25%)"
        mono
      />
      <MetricCard
        value={score.adoption_signal}
        label="Adoption signal (25%)"
        mono
      />
      <MetricCard
        value={score.network_influence}
        label="Network influence (20%)"
        mono
      />
    </div>
  );
```

### Health scoring (separate function)

Companion: `computeHealthScoreFromSignals` in `lib/ambassador-health.ts:22-43`. Pure function; takes `{observationsLast90Days, eventsLast90Days, daysSinceLastActive}`; returns `0..100`. Not the four-dimension score.

```22:43:lib/ambassador-health.ts
export function computeHealthScoreFromSignals(
  s: AmbassadorHealthSignals
): number {
  let score = 42;

  score += Math.min(28, s.observationsLast90Days * 3);
  score += Math.min(18, s.eventsLast90Days * 6);

  if (s.daysSinceLastActive === null) {
    score -= 8;
  } else if (s.daysSinceLastActive > 90) {
    score -= 38;
  } else if (s.daysSinceLastActive > 45) {
    score -= 22;
  } else if (s.daysSinceLastActive > 14) {
    score -= Math.min(18, (s.daysSinceLastActive - 14) * 0.7);
  } else if (s.daysSinceLastActive <= 3) {
    score += 12;
  }

  return clamp100(score);
}
```

---

## 6. Outreach drafting engine

### Faculty Outreach Generator (full code)

The whole module is `lib/outreach-generator.ts` (561 lines). Quoting the load-bearing pieces.

**Model + constants:**

```23:31:lib/outreach-generator.ts
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const STAGE_ORDER: OutreachStage[] = [
  "cold",
  "contacted",
  "meeting_booked",
  "demo_held",
  "partnership_active",
];
```

**Anthropic call (prefill-`{` JSON pattern):**

```265:327:lib/outreach-generator.ts
async function callClaudeJsonDraft(params: {
  systemPrompt: string;
  userMessage: string;
}): Promise<{ subject_line: string; body: string; tone: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1200,
      system: `${params.systemPrompt}

Return ONLY a JSON object with keys: subject_line (string), body (string), tone (string). No markdown fences.`,
      messages: [
        { role: "user", content: params.userMessage },
        { role: "assistant", content: "{" },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ text?: string }>;
  };

  if (data.error) {
    throw new Error(data.error.message ?? JSON.stringify(data.error));
  }

  const piece = data.content?.[0]?.text;
  if (!piece) throw new Error("Empty Claude response");

  let cleaned = "{" + piece;
  cleaned = cleaned.replace(/^```json\s*\n?/gm, "");
  cleaned = cleaned.replace(/\n?```\s*$/gm, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid JSON from Claude");
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  }

  const subject_line =
    typeof parsed.subject_line === "string" ? parsed.subject_line : "";
  const body = typeof parsed.body === "string" ? parsed.body : "";
  const tone = typeof parsed.tone === "string" ? parsed.tone : "professional";
  if (!subject_line || !body) throw new Error("Claude JSON missing fields");
  return { subject_line, body, tone };
}
```

Parameters: `model: claude-sonnet-4-20250514`, `max_tokens: 1200`, no temperature override (default), no streaming. The prefill is `assistant: "{"` and the response is concatenated as `"{" + piece` before being parsed. There is no retry, no timeout config, no `anthropic-beta` header.

### Prompt templates

`lib/outreach-prompts.ts` exports five system prompts: `pi_prompt`, `ta_prompt`, `department_chair_prompt`, `student_org_president_prompt`, `hackathon_organizer_prompt`. They share a common `CURSOR_HOOK` line and instruct the model to use only the verbatim facts in the user message:

```6:13:lib/outreach-prompts.ts
const CURSOR_HOOK =
  "Mention Cursor's student program or how the Cursor Campus Lead can support their course or org with education pricing and ambassador resources — only where it fits the facts supplied.";

export const pi_prompt = `You draft short, respectful cold outreach for a Cursor Campus Lead to a professor (PI). ${CURSOR_HOOK}

Use ONLY facts listed in the user message under the verbatim facts section. Quote paper titles exactly as given. Do not infer research interests beyond those titles and snippets. Do not invent talks, collaborations, or opinions.

Output: the assistant message continues valid JSON (the opening "{" is already supplied by the client).`;
```

The selector function:

```66:81:lib/outreach-generator.ts
function promptForTargetType(targetType: OutreachTargetType): string {
  switch (targetType) {
    case "professor":
      return pi_prompt;
    case "ta":
      return ta_prompt;
    case "department_chair":
      return department_chair_prompt;
    case "student_org":
      return student_org_president_prompt;
    case "hackathon_organizer":
      return hackathon_organizer_prompt;
    default:
      return pi_prompt;
  }
}
```

### Retrieval mechanics (paper context for Claude)

For "professor-linked" target types (`professor | ta | department_chair`), the generator pulls the professor's verbatim facts from observations:

```88:121:lib/outreach-generator.ts
export async function fetchPaperMatchLines(
  client: SupabaseClient,
  professorId: string,
  limit: number
): Promise<PaperMatchFactLine[]> {
  const { data, error } = await client
    .from("observations")
    .select("payload, observed_at, source_url")
    .eq("entity_type", "professor")
    .eq("entity_id", professorId)
    .eq("observation_type", "paper_matches_keywords")
    .order("observed_at", { ascending: false })
    .limit(limit * 3);

  if (error) throw error;

  const lines: PaperMatchFactLine[] = [];
  const seenTitles = new Set<string>();
  for (const row of data ?? []) {
    const payload = row.payload as Record<string, unknown>;
    const title = typeof payload.title === "string" ? payload.title : "";
    if (!title || seenTitles.has(title)) continue;
    seenTitles.add(title);
    lines.push({
      title,
      abstract_snippet: abstractSnippet(payload.abstract),
      observed_at: row.observed_at as string,
      source_url:
        typeof row.source_url === "string" ? row.source_url : undefined,
    });
    if (lines.length >= limit) break;
  }
  return lines;
}
```

Only the **top 3** keyword-matching papers are passed (caller invokes `fetchPaperMatchLines(client, targetId, 3)` — `lib/outreach-generator.ts:418`). Abstract is truncated to 400 chars (`abstractSnippet`). Syllabus lines and `public_statements` are also pulled and appended verbatim. The bundle is built by `buildProfessorArxivFactsBundle` (lines 203–238) which composes a literal "Reference only the following facts…" prompt section.

### Output shape

```65:70:lib/types/outreach.ts
export interface OutreachDraftResult {
  subject_line: string;
  body: string;
  tone: string;
  referenced_facts: ReferencedFact[];
}
```

`referenced_facts` is built from the observation rows + professor row before Claude is even called (`buildReferencedFactsFromProfessorContext`, `lib/outreach-generator.ts:160-200`) and is the audit trail of what facts were available to the draft.

### Where drafts are stored

The route `POST /api/outreach` (`app/api/outreach/route.ts:111-165`) persists `subject_line` and `draft_content` directly onto the `outreach_touchpoints` row. The `referenced_facts` and `tone` are not persisted as columns; they are written into the `outreach_drafted` observation payload.

### Fallback path (no Claude)

If `ANTHROPIC_API_KEY` is missing or the call throws, the generator falls back to `buildTemplateDraft` (`lib/outreach-generator.ts:240-263`), which composes a deterministic email referencing the first paper title:

```251:262:lib/outreach-generator.ts
  return {
    subject_line: `Cursor for students — ${params.institutionName} (${titleRef.slice(0, 60)})`,
    tone: "concise",
    body: `Hi ${params.professorName},

I'm the Cursor Campus Lead reaching out about our student/education program and faculty-friendly resources for AI-assisted programming courses.

I noticed this line of work in our pipeline: ${titleRef}. If you are open to a short note on how other CS departments partner with Cursor, I would welcome a reply.

Best,
Cursor Campus Lead`,
  };
```

The observation payload then has `template: true` and `source: "manual"` instead of `"classification"`.

### Campus Lead edit/send flow

`app/dashboard/outreach/[id]/OutreachDetailClient.tsx` is the client side:
- `saveDraft()` → `PATCH /api/outreach/[id]` with `{subject_line, draft_content}`.
- `regenerate()` → `POST /api/outreach/[id]/draft` (calls `generateOutreachDraft` again).
- Setting `sent_at` (a timestamp string) via the same PATCH triggers `outreach_sent` observation.
- Setting `reply_detected_at` triggers `outreach_reply_detected` observation.

There is no actual email-sending integration. Setting `sent_at` is a **manual log entry** — the Campus Lead pastes the email into Gmail/Front separately and toggles the timestamp. No SMTP, no IMAP, no Gmail API.

### Stage state machine implementation

`STAGE_ORDER` plus `dead`. Two helpers:

```329:349:lib/outreach-generator.ts
export function allowedNextOutreachStages(
  from: OutreachStage
): OutreachStage[] {
  if (from === "dead") return [];
  const idx = STAGE_ORDER.indexOf(from);
  const next: OutreachStage[] = ["dead"];
  if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
    next.unshift(STAGE_ORDER[idx + 1]!);
  }
  return next;
}

export function isLegalOutreachTransition(
  from: OutreachStage,
  to: OutreachStage
): boolean {
  if (from === to) return true;
  if (to === "dead") return from !== "dead";
  if (from === "dead") return false;
  return allowedNextOutreachStages(from).includes(to);
}
```

So legal transitions are: forward exactly one step in `STAGE_ORDER`, OR jump to `dead` from anywhere except `dead`. The `PATCH /api/outreach/[id]` route enforces this and returns `400 ILLEGAL_TRANSITION` otherwise (`app/api/outreach/[id]/route.ts:131-145`).

---

## 7. Workqueue synthesis

### Generator function (full code)

```68:272:lib/workqueue.ts
export async function generateWorkqueue(): Promise<WorkqueueItem[]> {
  const candidates: WorkqueueCandidate[] = [];
  const horizon = addDays(new Date(), 14).toISOString();
  const nowIso = new Date().toISOString();

  // Fix 1: parallelize all independent base queries
  const [verResult, ambResult, tpResult, profResult, evResult, staleProfResult] =
    await Promise.all([
      supabaseAdmin
        .from("verification_attempts")
        .select("id,email,claimed_institution,status,country")
        .in("status", ["pending", "manual_review"])
        .order("created_at", { ascending: false })
        .limit(12),
      supabaseAdmin
        .from("ambassadors")
        .select("id,name,email,institution_id,stage,score")
        .in("stage", ["applied", "under_review"])
        .order("id", { ascending: true })
        .limit(12),
      supabaseAdmin
        .from("outreach_touchpoints")
        .select("target_id")
        .eq("target_type", "professor"),
      supabaseAdmin
        .from("professors")
        .select("id,name,institution_id,recent_relevant_papers_count")
        .gte("recent_relevant_papers_count", 4)
        .order("recent_relevant_papers_count", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("events")
        .select("id,title,institution_id,scheduled_at,status")
        .in("status", ["draft", "scheduled"])
        .gte("scheduled_at", nowIso)
        .lte("scheduled_at", horizon)
        .order("scheduled_at", { ascending: true })
        .limit(10),
      supabaseAdmin
        .from("professors")
        .select("id,name,last_enriched_at,recent_relevant_papers_count")
        .is("last_enriched_at", null)
        .order("recent_relevant_papers_count", { ascending: false })
        .limit(8),
    ]);
  // ... candidate construction (snipped for brevity, full code already inlined above) ...
  return rankWorkqueueCandidates(candidates, 10);
}
```

### Inputs from each layer

| Layer | Source query | Cap |
|---|---|---|
| Discount (verification) | `verification_attempts` where status ∈ {pending, manual_review} | 12 |
| Ambassador pipeline | `ambassadors` where stage ∈ {applied, under_review} | 12 |
| Outreach (cold faculty) | `professors` with `recent_relevant_papers_count >= 4` minus those already in `outreach_touchpoints` (target_type='professor') | 20 |
| Events (urgent / upcoming) | `events` with status ∈ {draft, scheduled}, `scheduled_at` within next 14 days | 10 |
| Coverage (per-institution gaps) | `getInstitutionMetrics(instId)` for `[mit, stanford, cmu, berkeley, columbia]`, then `describeCoverageGaps` | 5 hard list |
| Intelligence (stale enrichment) | `professors` with `last_enriched_at IS NULL`, ordered by paper count | 8 |

### Weighting / prioritization

Each candidate carries a `priority_score`. The actual numbers (constants, all in `lib/workqueue.ts`):

| Source feature | Score |
|---|---|
| Discount manual review | `96` |
| Discount pending | `84` |
| Ambassador `under_review` | `81` |
| Ambassador `applied` | `78` |
| Events scheduled within 3 days | `74` |
| Events 4–14 days out | `61` |
| Outreach (faculty without touchpoint) | `68 + min(papers, 12) * 0.35` (range `68 – 72.2`) |
| Coverage gap | `54 - gaps.length * 0.5` |
| Intelligence (stale enrichment backlog) | `50` |

**Tie-breakers** are deterministic (`SOURCE_TIE_ORDER` in `lib/workqueue.ts:14-21`):

```13:21:lib/workqueue.ts
/** Lower sorts earlier when priority_score ties (first wins in ranked list). */
const SOURCE_TIE_ORDER: Record<WorkqueueSourceFeature, number> = {
  discount: 0,
  ambassador: 1,
  outreach: 2,
  events: 3,
  coverage: 4,
  intelligence: 5,
};
```

`rankWorkqueueCandidates` sorts by `priority_score DESC`, then `SOURCE_TIE_ORDER ASC`, then `id ASC`, and slices to `maxItems = 10`. Tested in `tests/workqueue.test.ts`.

The workqueue also has a special **email→institution mapper** to turn verification rows into mark-complete payloads:

```44:58:lib/workqueue.ts
function mapVerificationInstitutionId(row: {
  claimed_institution: string | null;
  email: string | null;
}): string | null {
  const c = row.claimed_institution?.toLowerCase() ?? "";
  if (c.includes("stanford")) return "stanford";
  if (c.includes("oxford")) return "oxford";
  if (c.includes("bucharest")) return null;
  if (c.includes("iit")) return null;

  const e = row.email?.toLowerCase() ?? "";
  if (e.endsWith(".stanford.edu") || e.includes("stanford")) return "stanford";
  if (e.endsWith(".ox.ac.uk")) return "oxford";
  return null;
}
```

(The hard-coded mapping is a known lacuna; it works for seed data only.)

### Output schema

```15:29:lib/types/intelligence.ts
export interface WorkqueueItem {
  /** Stable id for UI keys and mark-complete payload */
  id: string;
  priority_score: number;
  title: string;
  description: string;
  action_url: string;
  action_label: string;
  source_feature: WorkqueueSourceFeature;
  /** Target entity for action_completed observation */
  mark_complete: {
    entity_type: "professor" | "ambassador" | "institution";
    entity_id: string;
  };
}
```

The page is `/dashboard/workqueue` (`app/dashboard/workqueue/page.tsx`). "Mark complete" hits `POST /api/workqueue/complete` which writes an `action_completed` observation onto the chosen entity.

---

## 8. External integrations

### arXiv — **live**

`lib/sources/arxiv.ts:94-146`. Calls `http://export.arxiv.org/api/query` (NB: HTTP, not HTTPS). Atom feed parsed by `rss-parser` and validated by Zod (`paperSchema`). Rate limit: in-process `lastArxivRequestTime` global with `ARXIV_MIN_INTERVAL_MS = 3000` (one request per 3 s, matching arXiv's published policy).

```9:20:lib/sources/arxiv.ts
let lastArxivRequestTime = 0;

async function throttleArxiv(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastArxivRequestTime;
  if (elapsed < ARXIV_MIN_INTERVAL_MS) {
    await new Promise((r) =>
      setTimeout(r, ARXIV_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastArxivRequestTime = Date.now();
}
```

Bulk enrichment script (`scripts/enrich-all.ts:44-76`) adds 5 s spacing between professors and an exponential backoff `[30s, 60s, 120s]` on HTTP 429.

### Anthropic (Claude Sonnet) — **live**

`lib/outreach-generator.ts:265-327`. Direct REST. Model `claude-sonnet-4-20250514`, prefill-`{` JSON pattern. Used **only** by the outreach drafter. The legacy classifier `lib/classify.ts` (Pulse) also calls Claude but is not invoked by any active Beacon route.

No retry, no timeout config, no rate limit handling. If the call fails, the outreach generator falls back to the deterministic template.

### SheerID — **mocked**

`lib/sheerid-mock.ts`. The file header explicitly states: "Demo mock of SheerID verification — no real API calls. Production replaces this module with the live SheerID client." Driven by email-domain rules (`.edu` → approved; `.ac.uk`/`.ac.jp` → manual review; consumer domains → reject; certain countries → "country_unsupported"). Mock confidence is `0.9`.

There is **no SheerID webhook endpoint**. The data flow is synchronous: client POSTs to `/api/verification`, server runs `simulateVerification`, inserts the row, returns the result.

### Luma / Eventbrite — **doesn't exist yet**

No code references either service. Events are entirely Beacon-internal (the Campus Lead creates them in the dashboard; attendees come in via the public RSVP page or manual capture).

### Typeform — **doesn't exist yet**

README mentions "ambassador applications flow through Typeform → Supabase webhook" but no webhook route or Typeform client exists. Applications come in through the dashboard form (`AmbassadorApplicationForm`) or `POST /api/ambassadors`.

### Cursor billing / telemetry — **doesn't exist yet**

`ObservationSource` includes `"telemetry_mock"` (`lib/types/beacon-core.ts:57`) but no producer ever uses it. `lib/event-attribution.ts` is a placeholder for matching event-attendee emails against telemetry, but the matcher has no implementation. Cursor billing is not referenced anywhere.

### GitHub — **doesn't exist yet** (despite types)

`ObservationSource` declares `"github"` and there are observation types `github_org_membership_detected`, `course_repo_contribution_detected`, `collaborator_graph_inferred` declared in `lib/types/beacon-core.ts:24-28`. No producer code exists. `tests/evals/github-institutional-50.json` is just a fixture file.

### Other "Pulse legacy" integrations referenced but not active

- HackerNews / Reddit / RSS / YouTube / Twitter / Discord — all in `lib/sources/` and `lib/ingest-*.ts` are **stubs that return empty arrays**:

```1:6:lib/sources/hn.ts
import type { MentionRaw } from "@/lib/types";

export async function ingestHackerNews(): Promise<MentionRaw[]> {
  return [];
}
```

```1:8:lib/ingest-twitter.ts
export interface TwitterIngestResult {
  ingested: number;
  skipped: number;
}

export async function ingestTwitter(): Promise<TwitterIngestResult> {
  return { ingested: 0, skipped: 0 };
}
```

These are called from `app/api/cron/route.ts`, but the `cron` directory is excluded from `tsc` and would break at build time if it weren't excluded. The cron schedule in `vercel.json` does still point at `/api/cron`.

### Webhook endpoints

There are **no incoming webhook endpoints in active Beacon code** (no `/api/webhooks/...`). The only public-anonymous mutating endpoint is `POST /api/events/[id]/attendees` via the `/r/[trackingCode]` page (RSVP). Even that is not really a webhook — it's a form action.

### Rate-limit handling

- arXiv: hand-rolled (3 s gap, 30/60/120 s backoff in the bulk script).
- Anthropic: none in the active path. (Legacy `lib/classify.ts` has its own batching for Pulse but is not called.)
- Supabase: no explicit rate limiting. `lib/supabase-admin.ts` lazily constructs a single service-role client and reuses it through a `Proxy`.

---

## 9. UI architecture

### Routing structure

App Router (`app/...`). Three top-level groups:

| URL | Source file |
|---|---|
| `/` | `app/page.tsx` — client-side `useEffect → router.replace("/dashboard")` |
| `/login` | `app/login/page.tsx` — Supabase email+password sign-in |
| `/r/[trackingCode]` | `app/r/[trackingCode]/page.tsx` — public RSVP |
| `/dashboard/...` | `app/dashboard/layout.tsx` (sidebar nav) wraps everything |
| `/api/...` | route handlers (see §1 tree) |

The dashboard sidebar enumerates four sections (`app/dashboard/layout.tsx:8-41`):

```8:41:app/dashboard/layout.tsx
const NAV_SECTIONS = [
  {
    title: "Strategic",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/workqueue", label: "Workqueue" },
      { href: "/dashboard/professors", label: "Professors" },
      { href: "/dashboard/outreach", label: "Outreach" },
    ],
  },
  {
    title: "Ambassador Ops",
    items: [
      { href: "/dashboard/ambassadors", label: "Ambassadors" },
      { href: "/dashboard/resources", label: "Resources" },
      { href: "/dashboard/resources/analytics", label: "Resource analytics" },
    ],
  },
  {
    title: "Community Ops",
    items: [
      { href: "/dashboard/events", label: "Events" },
      { href: "/dashboard/discount", label: "Discount" },
      { href: "/dashboard/discount/queue", label: "Discount Queue" },
      { href: "/dashboard/discount/geography", label: "Discount Geography" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
] as const;
```

### Shared component patterns

- Design primitives: `components/ui/{Button, Card, Badge, Input, Select, Modal, Table, Tabs, MetricCard, MetricCard.forge}.tsx`.
- Two `MetricCard`s exist: a stripped-down `MetricCard.tsx` and the richer `MetricCard.forge.tsx` (with trend indicators and `lucide-react` icons, ported from the "Forge" reference design). Pages mix both.
- Feature components grouped by feature: `components/{ambassadors, events, intelligence, outreach, discount, resources}/`.
- `components/_forge-reference/prospects/*` is reference code preserved for visual reference only — `tsconfig.json` excludes it from the build, and `.cursor/rules/conventions.md` says "should be deleted before the demo."
- Tailwind 3 with a custom token system (see `tailwind.config.ts`); colors used inline include `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `bg-surface`, `border-border-subtle`, `accent-terracotta` (warm cream/terracotta palette).

### Data fetching pattern

- **Default**: React Server Components fetching directly with `createServerComponentClient()` (cookie-aware anon Supabase, in `lib/supabase-server.ts`). Examples: `app/dashboard/page.tsx`, `app/dashboard/professors/[id]/page.tsx`, `app/dashboard/institutions/[id]/page.tsx`, `app/dashboard/outreach/page.tsx`.
- **Client components** are `"use client"`-marked, manage local state with `useState` / `useRouter`, and `fetch(...)` against the API routes. Example: `components/intelligence/WorkqueueItem.tsx` (POSTs to `/api/workqueue/complete`).
- **No SWR, no React Query, no TanStack Query.** No global store (Redux/Zustand/Jotai). Server-side rendering + `router.refresh()` is the refresh pattern.
- Service-role calls (`supabaseAdmin`) happen on the server side both inside API routes and inside some Server Component pages (e.g. `app/dashboard/discount/page.tsx`, `app/dashboard/discount/queue/page.tsx`, `app/r/[trackingCode]/page.tsx`). This is a deliberate convention — server components also read from `supabaseAdmin` when they want to bypass RLS for admin-only views.
- Reads in pages use raw `.from(...).select(...)` — there is no `getXxx()` repository layer. Mappers like `mapAmbassadorRow`, `mapOutreachTouchpointRow`, `mapEventRow` are duplicated across files with the same logic.

### Authentication state

- Single-user demo. The dashboard layout has `const [authed] = useState(true);` (`app/dashboard/layout.tsx:55`) — i.e. always considers the user signed in client-side.
- A `/login` page exists and uses `supabase.auth.signInWithPassword` to issue cookies, but **no middleware enforces authentication** (no `middleware.ts` in the repo). Anyone hitting `/dashboard` directly sees the dashboard.
- Multi-user readiness: RLS policies grant `anon SELECT` on every read-relevant table; mutations require service role. There is no per-user authorization. The schema has no `users` or per-row owner concept.

---

## 10. Deployment and infrastructure

### Hosting

- **Vercel** (per `.cursor/rules/stack.md`: "Vercel for Next.js + cron"). The plan/limits are unknown — there is no `vercel project` config in the repo, just `vercel.json`. Domain: not in the repo (rules say "TBD (.vercel.app default for demo)").
- **Supabase Cloud.** Project ref `gtggbwcncdpzyfndohvg` (visible in `supabase/.temp/project-ref` and the Supabase URL in `.env.local`). Region: unknown.

### Cron jobs

`vercel.json`:

```1:9:vercel.json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 9 * * *"
    }
  ]
}
```

A single daily 09:00 UTC cron pointing at `/api/cron`. **However:** `/api/cron` is excluded from `tsc` and is the legacy Pulse cron (Hacker News ingestion, mention classification, fire alerts, narrative reports, LLM monitoring). All the lib functions it calls (`ingestHackerNews`, `classifyBatch`, `sendFireAlert`, `generateDailyBrief`, etc.) are stubs that no-op. So the cron technically runs but does nothing useful for Beacon. The Beacon-relevant Monday Morning Workqueue is **not** materialized; it's recomputed on-demand on every page load of `/dashboard/workqueue`.

`PIPELINE.md` (lines 42–52) describes a per-source cron that does not exist (`/api/ingest/arxiv`, `/api/ingest/github`, `/api/enrichment/run`, `/api/workqueue/generate` — none of these routes exist in the active code).

### Background jobs

- None. No queue (BullMQ, Inngest, Trigger.dev, Vercel Queues, etc.). No `setTimeout`/`setInterval` daemons.
- The `/api/professors/[id]/enrich` route runs synchronously (single arXiv fetch, ~3 s minimum due to throttle).

### Edge vs serverless functions

- All API routes are unmarked → default Node.js serverless functions on Vercel. No `export const runtime = "edge"` anywhere in `app/api/`.
- `lib/resource-content.ts` uses `"server-only"` and `react`'s `cache()`.

### Helper scripts

- `route-today.sh`, `run-daily.sh` — shell scripts in the repo root. Purpose unknown without reading them; they pre-date the Beacon rewrite (file timestamps from April 13).

---

## 11. Patterns to preserve

### The three principles (from docs)

1. **Retrieval over classification.** README:
   > "Beacon explicitly rejects classification for fuzzy latents. AI-friendliness scores were removed from the design early — they produced confident-looking numbers from unverifiable inference. Retrieval-based facts (keyword matching, syllabus extraction, quote retrieval) replaced them throughout."

   Implementation: `lib/keyword-paper-match.ts:36-109` (`matchPaperKeywords`) — a list of literal phrase + word-boundary regex checks, no LLM. The professor's `recent_relevant_papers_count` is the count of papers whose title+abstract matches at least one rule.

   `.cursor/rules/data-contracts.md:144-157`:
   > "When matching paper abstracts, count papers whose title OR abstract contain ANY of: \"large language model\" / \"LLM\" / \"language model\" / \"code generation\" / \"code completion\" / \"AI-assisted programming\" / \"AI coding\" / \"developer productivity\" / \"Copilot\" / \"Cursor\" / \"software engineering\" (only if combined with \"AI\" or \"ML\" in the same paper) / \"program synthesis\" / \"repository-level\" + \"model\" / \"chain of thought\" + \"code\". This is an exact keyword match, case-insensitive. NO semantic classification. NO inference."

   The outreach generator preserves this pattern: it gives Claude only verbatim paper titles + abstract snippets and the persona prompt says "Quote paper titles exactly as given. Do not infer research interests beyond those titles and snippets."

2. **Observation-first.** Implementation:
   - Single writer `logObservation` (`lib/observations.ts:27-52`).
   - All entity-mutating code paths log first, then update the projection (see §3 call-site table).
   - Observations table has no UPDATE/DELETE policy — append-only at the DB layer.
   - Conventions enforce it (`.cursor/rules/conventions.md:42-45`):
     > "Every entity mutation logs an observation via logObservation() from lib/observations.ts. Never update entity tables directly from API routes. Always go through the observation → projection flow."

3. **Leverage hierarchy.** Documented in `SPEC.md` and the README — three layers: Ambassador Operations, Community Operations, Strategic Intelligence — surfaced as the dashboard sidebar (`Strategic / Ambassador Ops / Community Ops / Admin`). The Workqueue is the single synthesizer across all three (see §7).

### Other conventions visible in the code

- **File naming:** `kebab-case.ts` for non-component files, `PascalCase.tsx` for components. Strictly followed.
- **Type ownership:** `.cursor/rules/data-contracts.md:131-142` says each parallel agent owns one file in `lib/types/`, all re-exported from `lib/types.ts`. Visible in the `@ownership` comment headers (e.g. `lib/types/ambassador.ts`, `lib/types/event.ts`, etc.). New modules must add their own `lib/types/<feature>.ts` and re-export from `lib/types.ts:1-13`.
- **Error contract for API routes:** `{ error: string, code: string }`. Codes seen in code: `VALIDATION`, `NOT_FOUND`, `DB_ERROR`, `CREATE_FAILED`, `UPDATE_FAILED`, `FETCH_FAILED`, `LIST_FAILED`, `ADVANCE_FAILED`, `SCORE_FAILED`, `HEALTH_FAILED`, `ENRICH_FAILED`, `APPROVE_FAILED`, `REJECT_FAILED`, `VERIFICATION_FAILED`, `DRAFT_FAILED`, `INTERNAL`, `ILLEGAL_TRANSITION`. New module should follow the same shape.
- **Validation:** Zod schemas live in a sibling `schemas.ts` next to the API route (e.g. `app/api/ambassadors/schemas.ts`, `app/api/outreach/schemas.ts`, `app/api/events/schemas.ts`, `app/api/verification/schemas.ts`). All API request bodies are validated with `safeParse`. UUIDs validated by `z.string().uuid()`.
- **Mappers:** Every entity has a `mapXxxRow(row: Record<string, unknown>): Xxx` function colocated with that entity's main lib file. New module should follow this pattern (single mapper per entity row → typed object) so reads from `supabaseAdmin` and `createServerComponentClient` produce identical typed objects.
- **Server/client split:** Default to Server Components; only mark `"use client"` for state/effect/event handlers. Client components hit `/api/...` rather than calling Supabase directly.
- **Confidence:** New observation writers should pick a confidence value from the documented ladder, not invent new values mid-range.
- **Supabase client choice:**
  - `supabaseAdmin` (service role, bypasses RLS): API routes that need to write, server components that present admin views (the discount overview page reads via admin to see all rows regardless of RLS).
  - `createServerComponentClient()` (cookie anon): Server Components for read-only views.
  - `createBrowserClient` (anon, in client components): only used in `login/page.tsx` for `signInWithPassword` and in `dashboard/layout.tsx` for sign-out.
- **`.cursor/rules/conventions.md:18-19`**: "Default to Server Components. Only use \"use client\" when interactivity is needed. Ports from Pulse are mostly \"use client\" — refactor to Server where possible."

---

## 12. Known gaps and TODOs

### Explicit `TODO` comments in active code

Only one:

```69:71:lib/institution-metrics.ts
  // POST-DEMO TODO: observation rollup uses O(entities per institution) filter breadth
  // (.in lists grow with faculty/ambassador counts). Revisit query shape or materialized
  // rollups when institution count > 10 or per-institution professor count > 50.
```

### Stubs / no-ops still wired into the cron path

(Found via grep + reading.)

| File | Status |
|---|---|
| `lib/sources/hn.ts` | Returns `[]` |
| `lib/sources/reddit.ts` | Returns `[]` |
| `lib/sources/rss.ts` | Returns `[]` |
| `lib/sources/youtube.ts` | Returns `[]` |
| `lib/sources/index.ts` | Comment: "Pulse port stub" |
| `lib/ingest-twitter.ts` | Returns `{ingested:0, skipped:0}` |
| `lib/ingest-discord.ts` | Returns `{ingested:0, skipped:0}` |
| `lib/alerts.ts` | `sendFireAlert`, `sendSingleFireAlert` — `void` no-ops |
| `lib/brief.ts` | `generateDailyBrief` — `void` no-op |
| `lib/journalist-profiler.ts` | Stub |
| `lib/llm-classifier.ts` | Stub |
| `lib/llm-fetcher.ts` | Returns `[]` |
| `lib/llm-snapshot-generator.ts` | Stub |
| `lib/narrative-gap-detector.ts` | Stub |
| `lib/narrative-report-generator.ts` | Stub |
| `lib/propagation-detector.ts` | Stub |
| `lib/pull-through.ts`, `lib/pullthrough.ts` | Stubs |
| `lib/velocity.ts` | Stub |
| `lib/incident-manager.ts` | Returns `{is_new:false, incident_id:"stub"}` |
| `lib/audience-routing.ts` | All three exports are `void` no-ops |
| `lib/prep.ts` | Returns `{id:"prep_stub", document:"", mention_count:0}` |
| `lib/sheerid-mock.ts` | **Mock by design** — production replacement expected |
| `lib/event-attribution.ts` | "Telemetry and SheerID-style matching are not wired in this slice — hooks only." |

### tsc-excluded files (`tsconfig.json:38-60`)

These compile-only-when-excluded — they have type errors against the current types layer:

```38:60:tsconfig.json
  "exclude": [
    "node_modules",
    "components/_forge-reference",
    "app/api/cron",
    "app/api/ingest",
    "app/api/llm-monitor/run",
    "app/api/prep",
    "app/api/pullthrough",
    "app/dashboard/settings/page.tsx",
    "components/DraftComments.tsx",
    "components/IncidentCard.tsx",
    "components/IncidentTimeline.tsx",
    "components/LLMFactCheckPanel.tsx",
    "components/LLMNarrativeMatrix.tsx",
    "components/LLMPlatformCard.tsx",
    "components/LLMResponseViewer.tsx",
    "components/LLMTrendChart.tsx",
    "components/PostIncidentReview.tsx",
    "components/ResponseDraftEditor.tsx",
    "components/StakeholderChecklist.tsx",
    "components/TemplateSelector.tsx",
    "lib/prioritization-scoring.ts"
  ]
```

These are Pulse legacy. The new module **must not import** from these files or they'll break the build the moment the next person re-includes them.

### Documented-but-missing tables

Listed in `SCHEMA.md` but not in any active migration: `student_orgs`, `ingestion_logs`, `classifications`, `institution_user_mappings`, `entity_snapshots`, `actions_log`. (See §2.)

### Documented-but-missing routes

`PIPELINE.md` shows crons at `/api/ingest/arxiv`, `/api/ingest/github`, `/api/ingest/mlh`, `/api/enrichment/run`, `/api/workqueue/generate`. None of these routes exist (the only cron is `/api/cron`).

### "Production state" claimed in docs but actually demo state

- **README "10 features" table:** lists Discount, Faculty Outreach, Events, Resources, Workqueue, Faculty Enrichment as "Shipped." All actually work end-to-end against the Supabase project. Caveats:
  - Discount: SheerID is mocked.
  - Outreach: Claude is live, but `sent_at` is a manually-toggled timestamp (no email integration).
  - Events: tracking_code-based attribution is present, but `activated_at` projection has no telemetry source (`event-attribution.ts:23-33` is a placeholder).
  - Workqueue: regenerated on-demand each page load — no Monday-morning materialization or change-tracking.
  - Faculty enrichment: real arXiv pipeline; the eval harness reports 100 % accuracy on 19 of 20 fixture professors.
- **README post-hire features**: Community Hub (Slack/Discord), Identity Resolution, Quarterly Review Generator are explicitly post-hire. None exist.
- **Authentication:** README/SPEC describe Beacon as a single-user internal tool; the dashboard layout hardcodes `authed=true` (see §9). Login page exists but is not enforced.
- **Cron:** documented as multi-source per-feature; actually a single dead daily cron (see §10).

### Potentially-misleading legacy code paths still in repo

The `app/api/` tree contains a large number of routes (`/api/cron`, `/api/ingest/*`, `/api/mentions/*`, `/api/brief/*`, `/api/briefs/audience/*`, `/api/llm-monitor/*`, `/api/pullthrough/*`, `/api/prep/*`, `/api/audiences`, `/api/keywords`, `/api/templates/*`, `/api/sources/*`, `/api/stats/*`, `/api/velocity`, `/api/classify`, `/api/settings`) that belong to the Pulse media-monitoring predecessor. Most are excluded from `tsc` and call no-op libs. **These should not be considered part of the Beacon contract for the new module.** New module should add new routes under `app/api/<new-feature>/...` and avoid importing from any of the Pulse names.

### Other observations a new module owner needs to know

- **No middleware.** If the DHVC Curation module needs auth, it has to bring its own auth gate.
- **No central error logger.** API routes use `console.error("[route-name]", e)`. No Sentry or equivalent.
- **No request-scoped tracing.** No `request-id` header or correlation id wired in.
- **No background queue / no idempotency keys.** Long-running ops (e.g. arXiv enrichment) hold the request open. The only retry/backoff lives in `scripts/enrich-all.ts` for offline batch runs.
- **One Anthropic call site.** Adding a second call site means duplicating the prefill/JSON cleanup logic from `outreach-generator.ts:265-327` until someone factors it into a shared `lib/anthropic.ts` (which doesn't exist yet).
- **Dual `MetricCard`s** (`MetricCard.tsx` vs `MetricCard.forge.tsx`) — pick one consciously per page.
- **Tests are happy-path only.** No integration tests against Supabase. The eval harness (`tests/evals/runner.ts`) hits the live arXiv API (with rate limiting) and is the only end-to-end coverage.
- **`tests/evals/professors-20.json`** is a hand-curated fixture of 20 professors across MIT, Stanford, CMU, Berkeley, Columbia with expected `recent_relevant_papers_count`. New entity scoring should consider building a similar fixture-based eval if it claims any retrieval accuracy number.

---

This brief is grounded entirely in code paths that exist in the current repo. Anywhere the question called for a feature that doesn't exist (Luma, Eventbrite, Typeform, Cursor billing, GitHub enrichment, identity resolution, quarterly review, scheduled workqueue materialization, telemetry-based event activation, multi-user auth), it has been explicitly called out above.
