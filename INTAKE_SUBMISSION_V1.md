# INTAKE SUBMISSION V1

## Decision
We will build a small dashboard-based intake submission flow.

This is the first real operator entry point for evidence.
It is NOT the full intake workflow.
It is NOT an approval/import UI.

The key rule:
project must be selected first, before any file is uploaded.

---

## Why this exists
Right now, intake evidence can be staged and inspected, but there is no clean operator-facing way to submit new evidence into the system.

Manually copying files into clawbot is not the intended workflow.

This submission flow should solve two problems:
- get evidence into the system through the dashboard
- guarantee the evidence is attached to the correct project without AI guessing

---

## V1 goal
Create a protected internal dashboard flow that lets me:

1. choose a real project
2. upload one evidence file
3. create a new intake run locked to that project
4. store the uploaded file reference
5. create one or more initial staged intake items in a pending state
6. send me to the existing read-only intake inspector

---

## Hard requirement
Project selection is mandatory before upload.

Do NOT allow:
- upload first, project later
- AI project guessing
- fuzzy address matching
- builder-name-based auto assignment

V1 should use controlled project assignment only.

---

## What counts as evidence
Examples:
- spreadsheet / csv
- pdf
- photo
- scanned document
- notes export
- other structured or semi-structured handoff artifact

This system is for operator-submitted evidence, not customer-facing upload yet.

---

## What this flow is
A dashboard intake submission form.

Suggested route:
- `/admin/intake/new`

Purpose:
- select project
- describe evidence source
- upload file
- create intake run
- stage evidence for later processing/review

---

## What this flow is NOT
Do NOT build yet:
- customer-facing upload portal
- builder login/upload flow
- email listener UI
- AI project auto-match
- approval buttons
- import buttons
- bulk upload workflow
- drag-and-drop multi-step organizer
- spreadsheet row editing UI

---

## V1 fields

### Required
- `project_id`
- `source_label`
- uploaded file

### Optional
- `builder_name`
- `source_identifier`
- notes

---

## V1 behavior
When operator submits the form:

1. validate project exists
2. upload/store the evidence file
3. create `intake_runs` row with:
   - selected `project_id`
   - `source_label`
   - optional builder/source fields
   - status like `pending` or `needs_review`
4. create initial `intake_items` row or rows representing the uploaded evidence
5. redirect to:
   - `/admin/intake/[runId]`

Important:
V1 does not need to fully parse the evidence immediately in the dashboard request cycle.
It is acceptable if V1 simply stages the uploaded evidence and leaves deeper parsing for the next processing step.

---

## Preferred V1 shape
The submission form should be thin.

Best first shape:
- one project selector
- one source label field
- one file upload
- optional notes
- submit

That is enough.

---

## Relationship to existing inspector
The read-only inspector remains the verification surface.

Submission flow:
- creates the run
- stores the evidence
- sends operator into inspector

Inspector flow:
- shows what was staged
- shows what imported
- shows what remains unresolved

---

## V1 success criteria
This feature is successful if:
- I can submit evidence through the dashboard
- the project is explicitly locked before upload
- a real `intake_run` is created
- the evidence is attached to that run
- I land in the intake inspector afterward
- no AI guessing is required for project assignment

---

## Practical conclusion
Build the smallest possible dashboard intake submission flow.

The first purpose is not automation.
The first purpose is controlled entry of evidence into the intake pipeline.