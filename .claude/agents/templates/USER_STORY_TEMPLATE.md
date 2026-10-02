<!--
USER STORY TEMPLATE (owned by the Business Analyst agent).
Target path: docs/user-stories/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_USER_STORY.md
Before marking Status=Ready, BA MUST copy .claude/agents/templates/STORY_DOR_TEMPLATE.md to docs/checklists/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_STORY_DOR.md and tick every box in that per-workstream copy.
Only the Dev Agent Record section below is editable by developer agents.
Remove all HTML comments before finalising.

CRITICAL — SPEC, NOT DESIGN: This story is the spec. It describes WHAT the user needs and
WHY, in business/functional language only. It MUST NOT contain technical implementation
detail — no entity/field names, DB/migration notes, API endpoints/routes/payload shapes,
specific UI components/screens/widgets, or tech-stack choices. Any "how we'll build it"
content belongs exclusively in the Team Lead's Plan (docs/features/<N.x>_<FEATURE>_PLAN.md),
never here. If you catch yourself naming a table, endpoint, or component, stop and rephrase
as a business capability or observable outcome instead.
-->

# User Story <N.x> — <FEATURE TITLE>

- **Workstream:** <N> — <Workstream name from SOLUTION_TASKS.md>
- **Traces to PRD:** FR-<area>-<N>, FR-…
- **Status:** Draft | Ready | In Progress | Ready for Review | Done
- **Author:** Thilina (BA)
- **Created:** YYYY-MM-DD

## 1. Story
As a **<role>**, I want **<capability>** so that **<business outcome>**.

## 2. Business Context
<2–4 lines. Why does this matter, what PRD goal does it serve.>

## 3. Scope
### 3.1 In Scope
- …
### 3.2 Out of Scope (explicit)
- …

## 4. Acceptance Criteria (Given/When/Then)
> Every AC MUST be independently testable, phrased as observable business behaviour
> (never as implementation steps — no table/field/endpoint/component names). Use stable
> ids so the reviewer can map PASS/FAIL per AC.

- **AC-1** — Given <state>, when <action>, then <observable outcome>.
- **AC-2** — …

## 5. Security & Privacy Notes (business-level only)
- Sensitive data involved (described in business terms, e.g. "applicant contact details"): …
- Who should/shouldn't be able to see or change this: …
> Do NOT name specific OWASP categories, auth mechanisms, or controls here — that
> threat-modeling and mitigation design belongs in the Plan §6 (Threat Model), owned by
> the Team Lead.

## 6. Dependencies
- Upstream stories / workstreams: …
- External systems (named only as business dependencies, not integration detail): …

## 7. Definition of Ready
Per-workstream checklist: `docs/checklists/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_STORY_DOR.md` (copied from `.claude/agents/templates/STORY_DOR_TEMPLATE.md`). BA must tick all boxes there before marking Status=Ready. Do NOT edit the template.

## 8. Definition of Done
Per-workstream checklist: `docs/checklists/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_STORY_DOD.md` (copied from `.claude/agents/templates/STORY_DOD_TEMPLATE.md`). Developer agents must tick all boxes there (with evidence) before handing off to the Code Reviewer. Do NOT edit the template.

---

## 9. Dev Agent Record
> This section is the ONLY part developers are allowed to edit. BA/TL MUST NOT edit it.

### 9.1 Agent Model Used
- Backend: <name> / <model>
- Frontend: <name> / <model>

### 9.2 Tasks / Subtasks (from the Plan)
- [ ] Task 1 …
    - [ ] Subtask …

### 9.3 Debug Log References
- …

### 9.4 Completion Notes
- …

### 9.5 File List
- Added: …
- Modified: …
- Deleted: …

### 9.6 Change Log
| Date | Author | Change |
|---|---|---|
| YYYY-MM-DD | Harinda (Backend) | … |
