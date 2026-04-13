---
title: Technical Workshop Curriculum (90 Minutes)
category: workshop_curriculum
last_updated: 2026-04-03
---

# Technical Workshop Curriculum (90 Minutes)

A hands-on workshop should leave every attendee with **one merged-quality change** in a repo they care about (homework template or sample project).

## Prerequisites (publish one week ahead)

- Laptop with **Node 18+** or **Python 3.10+** (pick one track per session—do not mix in the same room).
- Git installed; GitHub account (SSH or HTTPS working).
- Cursor installed (stable build). Link to FAQ for nightly vs stable if advanced students ask.

## Learning objectives

By the end, attendees can:

1. Open a folder as a project and explain how Cursor indexes the repo.
2. Use **inline edit** for a localized change with clear instructions.
3. Run **Agent** on a bounded task (e.g., “add tests for `parseDate`”) and review the diff before accepting.
4. Name one **safety habit**: run tests, read diffs, never paste secrets.

## Agenda

| Segment | Duration | Content |
|---------|----------|---------|
| Intro + norms | 10 min | What Cursor is / isn’t; academic integrity one-liner; how to get help. |
| Live build 1 | 20 min | Guided: fix a small bug in the starter repo using inline edit + terminal. |
| Break | 5 min | |
| Live build 2 | 25 min | Agent: add error handling + unit tests; emphasize reviewing hunks. |
| Pair exercise | 20 min | Pairs pick one “good first issue” from a short list; ambassadors float. |
| Close | 10 min | Discount link, Discord, office hours, Q&A. |

## Exercises (choose one stack)

**JavaScript track:** Starter repo with a broken date parser and missing tests. Tasks: fix off-by-one in timezone handling; add `vitest` tests.

**Python track:** Small CLI with argparse bug; tasks: fix parsing; add `pytest` cases.

## Facilitator notes

- **Never** let students paste API keys—use `.env.example` only.
- Pause after each Agent run: “What would you reject?” builds judgment.
- If Wi‑Fi fails, switch to **offline demo** on your machine + screenshot checklist for later.
