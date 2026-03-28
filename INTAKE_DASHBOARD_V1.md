# INTAKE DASHBOARD V1

## Decision
We will build a lean internal intake dashboard now, but only as a staging inspector.

This is NOT the full intake workflow.
This is NOT the primary milestone.
The primary milestone remains: import one staged item into a live table like `documents`.

---

## Why build this now
A thin dashboard is justified because it:
- makes staging data visible
- helps validate AI output faster than terminal/sql alone
- creates a better demo surface
- keeps momentum high

But it must stay small.

---

## What this dashboard is
A protected internal operator page in `clawbot-dashboard` that reads staging data from Supabase.

Primary route:
- `/admin/intake`

Purpose:
- view recent `intake_runs`
- view linked `intake_items`
- inspect proposed fields
- visually validate what OpenClaw staged

---

## What this dashboard is NOT
Do NOT build yet:
- full approval workflow
- bulk actions
- email listener UI
- automatic import buttons
- project auto-match UI
- customer-facing intake portal
- polished production-grade admin suite

---

## V1 scope

### Screen 1: Intake Runs List
Show recent `intake_runs` with:
- source_label
- builder_name
- project_id
- status
- created_at
- updated_at

### Screen 2: Intake Run Detail
Show linked `intake_items` with:
- source_file_name
- item_kind
- proposed_document_type
- proposed_category
- proposed_room_id
- room_match_confidence
- title
- brand
- model_number
- serial_number
- review_status
- original_file_hash

Optional:
- expandable JSON viewer for `raw_ai_output`

---

## Hard rule
This dashboard is read-only in V1.

No write actions yet.
No import button yet.
No approve/reject actions yet.

Why:
- import logic is still the real next backend milestone
- read-only dashboard gives visibility without creating workflow debt

---

## Relationship to next milestone
The next backend milestone remains:

staging row -> import script -> live `documents` row -> visible in app

Once that works, the dashboard can gain:
- import action
- review status edits
- later queue tooling

---

## V1 success criteria
This dashboard is successful if:
- I can see recent intake runs
- I can open one run
- I can inspect its staged items
- I can demo the pipeline visually
- I have not overbuilt admin workflow

---

## Practical conclusion
Build the dashboard as a window into staging, not as the whole intake system.

The actual product proof still comes from import-first.