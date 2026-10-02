<!--
SOLUTION TASKS TEMPLATE (owned by the Product Owner agent).
Target path: docs/SOLUTION_TASKS.md
Remove all HTML comments (and the worked example Epic) before finalising.
-->

# Solution Tasks (Backlog) — <PRODUCT NAME>

> **Status:** Draft | Approved
> **Version:** vX.Y
> **Last updated:** YYYY-MM-DD
> **Owner:** Product Owner (agent: product-owner)
> **Source PRD:** `docs/SOLUTION_PRD.md` (vX.Y)

## How to read this document

- **Epics** are numbered `E-{n}`. Each epic groups one cohesive area of capability and maps to one or more PRD FR sections.
- **Features** are numbered `F-{epic}.{n}` and represent a meaningful slice of an epic.
- **Stories** are numbered `S-{epic}.{feature}.{n}`. Each story is independently shippable and traces back to one or more `FR-*` ids in the PRD.
- Every story is rendered as a Markdown checkbox (`- [ ]`). The Team Lead marks it complete by switching to `- [x]`.
- Each story line is formatted as: `- [ ] **S-id** [SURFACE] short title. — _Traces: FR-XXX-N_ — _Weight: N_`
- **Surface** tags identify which part of the system a story touches. Define the tag set for this project here, e.g.: `BE` (backend/API), `WEB` (web frontend), `MOBILE` (mobile app), `DATA` (schema/migrations), `INFRA` (cloud infra/DevOps), `DOC` (architecture/runbooks). Adjust to match the actual project architecture.
- **Weight** is a mandatory Fibonacci complexity estimate (1, 2, 3, 5, 8, 13 — see `.claude/agents/core-config.yaml` `taskWeight.meaning`) assigned by the Product Owner for every story. It drives the weighted completion % on `docs/SOLUTION_PROGRESS.html`. A story sized 13 is usually a signal it should be split into smaller stories.
- If the project has design references (mockups/Figma/style guides), tie a task to one with a trailing `— _Design: docs/design/<FILE_NAME>_` reference.
- `docs/SOLUTION_PROGRESS.html` is a generated progress dashboard rebuilt automatically by the Product Owner or Team Lead every time this file changes — never edit it by hand.

---

## Epic Overview

| Epic | Title | Phase | PRD FR groups |
|---|---|---|---|
| E-1 | <Epic title> | 1 | <FR groups> |

---

<!--
Worked example of one epic/feature/story — delete this block once real epics are written.

## E-1 — <Epic title> (Phase 1)

**Goal:** <one-line goal for this epic>

### F-1.1 <Feature title>

- [ ] **S-1.1.1** [BE] <Short, verb-first story title>. — _Traces: FR-XXX-1_ — _Weight: 3_
- [ ] **S-1.1.2** [WEB] <Short, verb-first story title>. — _Traces: FR-XXX-2_ — _Weight: 5_

---
-->

## Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | YYYY-MM-DD | Shiham (PO) | Initial draft |
