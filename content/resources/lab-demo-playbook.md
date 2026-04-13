---
title: Lab & Research Group Demo Playbook
category: event_playbook
last_updated: 2026-04-04
---

# Lab & Research Group Demo Playbook

Lab demos differ from large workshops: the audience is **PIs, grad students, and staff engineers** who care about reproducibility, citations, and not breaking clusters.

## PI and staff outreach

- **Email angle:** “We’d like 25 minutes at your group meeting to show how teams use Cursor for **refactoring experiment code** and **writing glue scripts**—not for authorship of paper prose.” Offer to **record** for absent members.
- **Scheduling:** Prefer existing slot (group meeting) over a standalone lunch unless they ask.
- **Stakeholders:** If a lab manager handles machines, CC them on install constraints (air-gapped clusters are a no-go for cloud features—set expectations).

## Technical setup

- **Projector:** 1080p minimum; increase font size in editor before you plug in.
- **Demo repo:** Clone a **sanitized** fork of their public code or a representative snippet—never private student data.
- **Network:** Confirm whether outbound AI calls are allowed; if not, pivot to **local-only** messaging or skip cloud features honestly.

## Demo arc (25 minutes)

1. **Context (3 min):** Who you are; Cursor as editor + assistant; boundaries (no replacing methodology).
2. **Refactor (10 min):** Rename across files, extract module, run tests—show diff review.
3. **Docs + scripts (7 min):** Generate docstrings for one module; tighten a bash pipeline with comments.
4. **Q&A (5 min):** Prepare for: licensing, data residency, student discount for RAs, comparison to Copilot.

## Sensitive Q&A

- **Authorship:** Cursor does not replace credit for ideas; lab policy + conference rules still apply.
- **Sensitive data:** Do not point models at unpublished results or patient data without institutional approval.

## Follow-up

Send a **one-page PDF** with links: student discount, workshop recording, and a contact for a **second session** focused on CI integration if there is interest.
