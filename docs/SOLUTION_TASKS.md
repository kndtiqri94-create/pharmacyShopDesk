# Solution Tasks (Backlog) — HireFlow

> **Status:** Draft
> **Version:** v0.1
> **Last updated:** 2026-08-13
> **Owner:** Product Owner (agent: product-owner)
> **Source PRD:** `docs/SOLUTION_PRD.md` (v0.1)

## How to read this document

- **Epics** are numbered `E-{n}`. Each epic groups one cohesive area of capability and maps to one or more PRD FR sections.
- **Features** are numbered `F-{epic}.{n}` and represent a meaningful slice of an epic.
- **Stories** are numbered `S-{epic}.{feature}.{n}`. Each story is independently shippable and traces back to one or more `FR-*` ids in the PRD.
- Every story is rendered as a Markdown checkbox (`- [ ]`). The Team Lead marks it complete by switching to `- [x]`.
- Each story line is formatted as: `- [ ] **S-id** [SURFACE] short title. — _Traces: FR-XXX-N_ — _Weight: N_`
- **Surface** tags for this project:
  - `WEB` — HireFlow frontend project (candidate-facing browser UI, `localStorage` persistence).
  - `BE` — HireFlow backend project (standalone API/persistence demo, not integrated with `WEB` in this phase).
  - `DOC` — supporting documentation (user stories, API docs, etc.) produced alongside a story.
- **Weight** is a mandatory Fibonacci complexity estimate (1, 2, 3, 5, 8, 13 — see `.claude/agents/core-config.yaml` `taskWeight.meaning`) assigned by the Product Owner for every story. It drives the weighted completion % on `docs/SOLUTION_PROGRESS.html`. A story sized 13 is usually a signal it should be split into smaller stories.
- If a story is tied to a design reference, it carries a trailing `— _Design: docs/design/<FILE_NAME>_` reference.
- `docs/SOLUTION_PROGRESS.html` is a generated progress dashboard rebuilt automatically by the Product Owner or Team Lead every time this file changes — never edit it by hand.

---

## Epic Overview

| Epic | Title | Phase | PRD FR groups |
|---|---|---|---|
| E-1 | HireFlow Job Application Screen | 1 | FR-JOBAPP, FR-JOBAPP-BE |

---

## E-1 — HireFlow Job Application Screen (Phase 1)

**Goal:** Let a candidate view the advertised role and submit an application, with full
inline validation, submit/success/error-retry states, and reload-persistence via
`localStorage`, on a frontend that works fully standalone. Build a separate, non-integrated
backend persistence demo alongside it (see PRD Constraints/OQ3).

### F-1.1 Frontend — Job Application Form (WEB, localStorage-only)

- [x] **S-1.1.1** [WEB] Build the role-advert + "Apply for this role" form UI (Full name, Email, CV file picker/drag-drop, optional Cover note with 500-char counter) matching the design's default state. — _Traces: FR-JOBAPP-1_ — _Weight: 5_ — _Design: docs/design/Job Application Page.dc.html_
- [x] **S-1.1.2** [WEB] Implement inline + summary-banner validation for required fields (name, email, CV) and email-format checking, blocking submit while invalid, matching the design's error state and hint styling. — _Traces: FR-JOBAPP-2, FR-JOBAPP-3_ — _Weight: 5_ — _Design: docs/design/Job Application Page.dc.html_
- [x] **S-1.1.3** [WEB] Implement the submitting state (busy/disabled submit control) and persist a valid application to `localStorage` (CV captured as name/size metadata only, per PRD Constraints). — _Traces: FR-JOBAPP-4_ — _Weight: 3_ — _Design: docs/design/Job Application Page.dc.html_
- [x] **S-1.1.4** [WEB] Implement the success/confirmation state ("Application sent") with a "Start again" reset action, matching the design. — _Traces: FR-JOBAPP-5_ — _Weight: 2_ — _Design: docs/design/Job Application Page.dc.html_
- [x] **S-1.1.5** [WEB] Implement a visible submit-failure error state with a retry action that re-attempts persistence of the already-entered form data. Failure trigger mechanism to be confirmed per PRD OQ1 before/at start of this story. — _Traces: FR-JOBAPP-6_ — _Weight: 3_ — _Design: docs/design/Job Application Page.dc.html_
- [x] **S-1.1.6** [WEB] On page load, check `localStorage` for a previously submitted application and restore the success/confirmation state (instead of the blank form) so a submission survives a reload. — _Traces: FR-JOBAPP-7_ — _Weight: 3_ — _Design: docs/design/Job Application Page.dc.html_

### F-1.2 Backend — Standalone Job Application Persistence Demo (BE, not integrated with WEB)

- [ ] **S-1.2.1** [BE] Build a standalone backend project/API to create and retrieve a job application (name, email, CV metadata, optional cover note), following `docs/development-standards/BACKEND_STANDARDS.md`. Explicitly not called by the frontend in this phase (PRD Non-Goal NG5 / OQ3). — _Traces: FR-JOBAPP-BE-1_ — _Weight: 5_

---

## Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: E-1 HireFlow Job Application Screen (WEB localStorage-only frontend + standalone BE persistence demo, no integration). |
