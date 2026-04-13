# Beacon — The Campus Lead Operating System

## What it is

Beacon is the internal operating tool the Cursor Campus Lead uses to run the student discount program, the Campus Ambassador program, and all faculty/institutional outreach across 50 top CS programs. Three layers: Ambassador Operations, Community Operations, Strategic Intelligence.

## Who it's for

One user: the Cursor Campus Lead. Internal tool. No public-facing surface in the Day 1 demo (ambassador applications flow through Typeform → Supabase webhook).

## The smallest useful version (Day 1 demo scope)

Five schools: MIT, Stanford, CMU, Berkeley, Columbia.
20-25 real professors across those schools, enriched with three retrieval-based facts.
1 ambassador pipeline with manual-entry applications, scoring, health tracking.
1 Monday Morning Workqueue synthesizing the above.
1 Campus Intelligence Dashboard showing per-school state.

Explicitly out of scope for Day 1: public application form (needs auth+RLS+middleware, 2 days of work deferred to Week 2 in role), Slack/Discord integration, Event Toolkit, Quarterly Review generator, full 50-school coverage, live Cursor telemetry (mocked).

## The ten features

### Layer 1: Ambassador Operations
1. **Ambassador Pipeline Manager** — Application intake, auto-enrichment, four-dimension scoring, accept/reject, onboarding tracker, quarterly activity review with health scoring.
2. **Community Hub** *(post-demo)* — Unified Slack+Discord inbox with AI-drafted responses.
7. **Enablement Resource Hub** *(post-demo)* — Playbook library, slide templates, training.

### Layer 2: Community Operations
3. **Discount Provisioning Dashboard** *(post-demo)* — SheerID integration, verification queue, geography gaps.
6. **Event Operations Toolkit** *(post-demo)* — Event lifecycle management with attribution.

### Layer 3: Strategic Intelligence
4. **Campus Intelligence Dashboard** — 5 school profiles (expandable to 50), adoption signal, faculty, labs, orgs.
5. **Faculty & Student Org Outreach Generator** — Fact-grounded personalized outreach with CRM pipeline.
8. **Identity Resolution & Faculty Enrichment** — Five-signal institutional mapping + three retrieval-based fact types per professor (recent relevant papers, AI stance quote, public statements). NO classifier scoring of AI-friendliness.
9. **Monday Morning Workqueue** — Ranked 10-action queue synthesizing all other features.
10. **Quarterly Review Generator** *(post-demo)* — Auto-drafted defense document.

## The core architectural decision

Every fact about every entity flows through an append-only `observations` table with source, timestamp, and confidence. This is the source of truth. All current-state queries derive from the latest observation per (entity, attribute) pair. No parallel state.

## Success criteria for Day 1 demo

- `localhost:3000/dashboard/professors/sasha-rush` renders real arXiv data, recent-relevant-papers count, observation timeline.
- Eval harness passes 80%+ on 20-professor fixture.
- Monday Morning Workqueue shows ranked actions across 5 schools.
- Ambassador pipeline accepts a sample application, scores it, advances it through stages.
- Loom walkthrough under 4 minutes.