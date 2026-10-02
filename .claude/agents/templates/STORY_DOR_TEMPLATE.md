<!--
DEFINITION OF READY — USER STORY — TEMPLATE
Owner: Business Analyst (agent: business-analyst).

How to use:
1. When *create-user-story runs for workstream <TASKS_NUMBER>.<SUB_TASKS_NUMBER>_<FEATURE>:
   - Copy this template verbatim to:
     docs/checklists/<TASKS_NUMBER>.<SUB_TASKS_NUMBER>_<FEATURE>_STORY_DOR.md
   - Remove this HTML comment block from the copy.
   - Replace <WORKSTREAM_NUM>, <FEATURE>, <USER_STORY_PATH> placeholders.
2. The BA then ticks each box in the COPY (not this template).
3. A single unticked box means the story is NOT Ready; BA escalates to the Product Owner with BLOCKED: PRD clarification needed.
4. This template file itself is NEVER edited per workstream.
-->

# Definition of Ready — User Story <WORKSTREAM_NUM> <FEATURE>

- **Story:** `<USER_STORY_PATH>`
- **Owner:** Thilina (Business Analyst)
- **Status:** In Progress | Ready | Blocked
- **Created:** YYYY-MM-DD

Applied: before marking a user story as `Status: Ready` and handing off to the Team Lead.

Every box below MUST be ticked. A single unticked box means the story is NOT Ready and the BA must go back to the Product Owner for clarification.

## Traceability
- [ ] **DoR.1** Story traces to at least one PRD requirement id (`FR-<area>-<N>`) in `docs/SOLUTION_PRD.md`.
- [ ] **DoR.2** Story is linked to a workstream and subtask number from `docs/SOLUTION_TASKS.md`.
- [ ] **DoR.3** Filename matches `docs/user-stories/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_USER_STORY.md`.

## Story content (from USER_STORY_TEMPLATE.md)
- [ ] **DoR.4** "As a … I want … so that …" is populated with a specific role, capability and outcome.
- [ ] **DoR.5** In Scope / Out of Scope sections are both populated (Out of Scope MUST NOT be empty — write "None identified" only if truly none).
- [ ] **DoR.6** Each Acceptance Criterion is written as Given/When/Then and has a stable id (`AC-N`).
- [ ] **DoR.7** Each AC is independently testable (no "system works correctly" style criteria).
- [ ] **DoR.8** Security & Privacy notes identify sensitive data (in business terms) and who should/shouldn't access it — with no OWASP category, auth mechanism, entity/field, or API/UI detail named (that's the Team Lead's Plan).
- [ ] **DoR.9** Tenant-scoping / access expectation is explicit in business terms (e.g. "only visible to the applicant's own organisation") — not phrased as a technical control.
- [ ] **DoR.10** Dependencies on other stories / workstreams / external systems listed (or explicitly "None").
- [ ] **DoR.11** Dev Agent Record section is present, empty, and clearly marked developer-editable.

## Quality
- [ ] **DoR.12** No ambiguous verbs ("support", "handle", "manage" alone without describing what exactly is supported).
- [ ] **DoR.13** No implementation/technical decisions leaked into the story — no entity/table/field names, DB/migration notes, API endpoints/payload shapes, specific UI component/screen names, or tech-stack choices (those belong exclusively in the Plan).
- [ ] **DoR.14** All open questions have been resolved with the Product Owner OR escalated and blocking (story stays in Draft).

## Handoff
- [ ] **DoR.15** Change Log updated; Status set to `Ready`.
- [ ] **DoR.16** Team Lead notified (or the Team Lead is the caller triggering this check in orchestration).

## BA Sign-off
- **BA:** Thilina — YYYY-MM-DD
- **Unticked items (if any):** <list, plus escalation path>
