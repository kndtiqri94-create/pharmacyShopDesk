<!--
DATA ENGINEERING REQUIREMENTS TEMPLATE (owned by the Data Engineering PM agent, Chinthaka).
Target path: docs/data-engineering-requirements/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_DE_REQUIREMENTS.md

PURPOSE: Translate business requirements (PRD + task) into clear Data Engineering
delivery requirements BEFORE technical architecture begins. This is a requirements
artifact, not a design artifact — it captures WHAT the workload needs, not HOW it
will be built. Implementation technology, class design, schema/contract detail,
partition strategy, and watermark algorithms belong exclusively to the Data
Architect's SDD (docs/data-engineering-design/<N.x>_<FEATURE>_SDD.md), never here.

PROPORTIONALITY: Not every section applies to every workload. Mark a section
"Not applicable — <one-line reason>" rather than deleting it, so a reviewer can see
the question was considered, not skipped. Do NOT invent enterprise answers for a
simple workload just to make this document look complete — see
docs/development-standards/ENGINEERING_STANDARDS.md rule 21 (Proportionality).

NO GUESSING: Any topic below that is missing, vague, or unknown MUST be raised as a
numbered clarifying question and logged in §11 Open Questions. Do NOT invent an
answer. If a critical question blocks architecture, set Status=Blocked and return
BLOCKED: DE clarification needed to the Team Lead.

Remove all HTML comments before finalising.
-->

# Data Engineering Requirements <N.x> — <FEATURE TITLE>

- **Workstream:** <N> — <Workstream name from SOLUTION_TASKS.md>
- **Traces to PRD:** FR-<area>-<N>, FR-…
- **Traces to Task(s):** S-<epic>.<feature>.<n>
- **Status:** Draft | Ready | Blocked
- **Author:** Chinthaka (Data Engineering PM)
- **Created:** YYYY-MM-DD

## 1. Source

| Topic | Answer |
|---|---|
| Source system(s) | … |
| Source type (REST API / GraphQL / relational DB / NoSQL / file / object storage / SaaS / queue / event / streaming) | … |
| Source owner (team/system-of-record) | … |
| Source access method | … |
| Authentication constraints | … |
| Schema availability (known upfront? discoverable at runtime?) | … |
| Schema stability (fixed / can evolve — how often, who controls it) | … |
| Source-specific limitations (rate limits, export windows, read replicas only, etc.) | … |

## 2. Volume and Scale

| Topic | Answer |
|---|---|
| Current data volume | … |
| Expected growth | … |
| Record counts | … |
| File sizes (if file-based) | … |
| Throughput | … |
| Frequency | … |
| Concurrency (if relevant) | … |

## 3. Processing Model

- Batch / micro-batch / streaming / one-off / scheduled / event-driven: …
- Rationale: …

## 4. Loading Strategy

| Topic | Answer |
|---|---|
| Full load / incremental / CDC / snapshot | … |
| Watermark / cursor / sequence-offset basis (business terms only — e.g. "an updated-at timestamp exists"; the Data Architect designs the mechanism) | … |
| Historical load required? | … |

## 5. Time

| Topic | Answer |
|---|---|
| Frequency | … |
| Freshness requirement | … |
| SLA / SLO (only if the workload is production-deployed or externally consumed — see `DATA_ENGINEERING_STANDARDS.md` rules 16–17) | … |
| Latency | … |
| Timezone | … |
| Late-arriving data expectations | … |

## 6. Recovery

| Topic | Answer |
|---|---|
| Restart expectations | … |
| Replay expectations | … |
| Backfill requirements | … |
| Failure tolerance | … |
| Recovery point expectations | … |

## 7. Destination

| Topic | Answer |
|---|---|
| Expected output / destination | … |
| Downstream consumers | … |
| Consumption pattern | … |
| Overwrite / append / upsert expectation (business/requirement level only — not implementation) | … |

## 8. Data Quality

| Topic | Answer |
|---|---|
| Critical fields | … |
| Completeness expectations | … |
| Uniqueness expectations | … |
| Reconciliation needs | … |
| Business validation expectations | … |

## 9. Security

| Topic | Answer |
|---|---|
| PII / sensitive data present? | Yes / No / Unsure — if Unsure, this is an Open Question, not an assumption. |
| Restricted data categories | … |
| Environment constraints | … |
| Access requirements | … |
| Retention / deletion expectations | … |

## 10. Governance

| Topic | Answer |
|---|---|
| Ownership (who owns this data going forward) | … |
| Downstream dependencies | … |
| Lineage expectations | … |
| Contract expectations (only where a formal data contract is warranted — see `DATA_CONTRACT_STANDARDS.md` rule 1) | … |

## 11. Open Questions

> Anything unresolved goes here — never silently assumed. If any item here is
> critical to starting architecture, set Status=Blocked.

- OQ1 — <question> — blocking? Y/N — routed to: <Shiham (business) / user (DE-specific)>

## 12. Proportionality Assessment

State, in one or two lines, why this workload is simple or complex, and which
enterprise controls (multi-stage architecture, formal contracts, DQ infrastructure,
lineage, multi-environment deployment) appear warranted vs. not, based on the
answers above. The Data Architect makes the final architectural call, but Chinthaka
flags the obvious triggers (or their absence) here.

## 13. Handoff

- **Business Analyst (Thilina):** consumes this document as context for the user
  story. The story itself remains business-readable — DE detail from this document
  MUST NOT leak into Acceptance Criteria wording.
- **Data Architect (Salinda):** consumes this document as the primary input to the
  SDD, alongside the PRD, task, and user story.

## Change Log

| Date | Author | Change |
|---|---|---|
| YYYY-MM-DD | Chinthaka (DE PM) | Initial draft |
