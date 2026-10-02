<!--
DEFINITION OF READY — DATA ENGINEERING USER STORY — TEMPLATE
Owner: Business Analyst (agent: business-analyst, Thilina), informed by the Data
Engineering PM (Chinthaka).

How to use:
1. Use THIS template (instead of STORY_DOR_TEMPLATE.md) whenever the workstream has
   an associated docs/data-engineering-requirements/<N.x>_<FEATURE>_DE_REQUIREMENTS.md.
2. Copy verbatim to docs/checklists/<N.x>_<FEATURE>_DE_STORY_DOR.md, remove this
   comment block, fill placeholders.
3. A single unticked box means the story is NOT Ready. Escalate to the Product
   Owner (business ambiguity) or the Data Engineering PM (DE ambiguity).
4. PROPORTIONALITY: an item that is genuinely not relevant to this workload (e.g.
   sensitive-data classification for a workload with no sensitive data) may be
   marked N/A with a one-line reason instead of blocking — do not force an
   irrelevant enterprise question onto a simple workload.
5. This template file itself is NEVER edited per workstream.
-->

# Definition of Ready — Data Engineering User Story <WORKSTREAM_NUM> <FEATURE>

- **Story:** `<USER_STORY_PATH>`
- **DE Requirements:** `<DE_REQUIREMENTS_PATH>`
- **Owner:** Thilina (Business Analyst)
- **Status:** In Progress | Ready | Blocked
- **Created:** YYYY-MM-DD

## Business readiness (from STORY_DOR_TEMPLATE.md — unchanged)

- [ ] **DoR.1** Story traces to at least one PRD requirement id (`FR-<area>-<N>`).
- [ ] **DoR.2** Story is linked to a workstream/subtask in `docs/SOLUTION_TASKS.md`.
- [ ] **DoR.3** "As a … I want … so that …" is populated with a specific role,
      capability, and outcome.
- [ ] **DoR.4** In Scope / Out of Scope sections are both populated.
- [ ] **DoR.5** Each Acceptance Criterion is Given/When/Then, independently
      testable, and business-readable (no DE implementation detail leaked in).

## Data Engineering readiness

- [ ] **DoR.6** Business objective for this data movement is clear (why this data,
      for whom, what decision/process it enables).
- [ ] **DoR.7** Source system is known (per DE Requirements §1) — or explicitly
      marked N/A with reason.
- [ ] **DoR.8** Source access is known to exist (owner/team has confirmed access is
      obtainable) — or N/A.
- [ ] **DoR.9** Expected data shape/volume is known at least approximately (per DE
      Requirements §1–2) — or N/A for a genuinely exploratory spike.
- [ ] **DoR.10** Destination/consumer is known where the workload has a downstream
      consumer (per DE Requirements §7) — N/A if this is a terminal, standalone
      output.
- [ ] **DoR.11** Volume/cadence is understood well enough to judge batch vs.
      streaming (per DE Requirements §2–3).
- [ ] **DoR.12** Load strategy (full/incremental/CDC) is clarified, not assumed (per
      DE Requirements §4).
- [ ] **DoR.13** Sensitive-data classification is known (Yes/No/Unsure resolved to
      Yes/No) — per DE Requirements §9. An unresolved "Unsure" blocks readiness.
- [ ] **DoR.14** No unresolved critical DE Requirements Open Question (§11) remains
      that would block the Data Architect from starting the SDD.

## Quality

- [ ] **DoR.15** No implementation/technical decisions leaked into the story (no
      class names, connector internals, watermark algorithm, partition scheme,
      Pydantic models, cloud SDKs — those belong in the SDD).
- [ ] **DoR.16** All open questions resolved with the Product Owner and/or Data
      Engineering PM, or explicitly escalated and blocking (story stays Draft).

## Handoff

- [ ] **DoR.17** Change Log updated; Status set to `Ready`.
- [ ] **DoR.18** Team Lead notified (or is the caller triggering this check).

## BA Sign-off

- **BA:** Thilina — YYYY-MM-DD
- **N/A items (if any), with one-line reason:** …
- **Unticked items (if any), with escalation path:** …
