<!--
SOLUTION DESIGN DOCUMENT (SDD) TEMPLATE (owned by the Data Architect agent, Salinda).
Target path: docs/data-engineering-design/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_SDD.md

PURPOSE: The Data Engineering technical design. This is where implementation
technology, architecture, schema/contract shape, and specialist selection are
decided. The Data Architect MUST NOT write production implementation code here —
this is a design document, not code.

PROPORTIONALITY (MANDATORY): Address only the sections that apply to this workload.
Mark a section "Not applicable — <reason>" rather than deleting it. Do NOT force
enterprise architecture (multi-stage pipeline, formal contracts, checkpoint/replay
infrastructure, DQ infrastructure, lineage, multi-environment deployment) onto a
workload whose characteristics do not trigger it — see
docs/development-standards/ENGINEERING_STANDARDS.md rule 21 (Proportionality) and
docs/development-standards/DATA_ENGINEERING_STANDARDS.md throughout. Conversely, do
NOT under-design a workload whose characteristics (production deployment, external
consumption, sensitive data, incremental/CDC processing) clearly trigger those
controls — the Data Engineering Reviewer (Ayodhya) validates this judgment call was
made correctly, not just that it was made.

Remove all HTML comments before finalising.
-->

# Solution Design Document <N.x> — <FEATURE TITLE>

- **Workstream:** <N> — <Workstream name>
- **DE Requirements:** `docs/data-engineering-requirements/<N.x>_<FEATURE>_DE_REQUIREMENTS.md`
- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **Status:** Draft | Ready for Planning | Blocked
- **Author:** Salinda (Data Architect)
- **Created:** YYYY-MM-DD

## 1. Summary

<2–4 sentences: what will be built, at what level of architectural complexity, and
why that level is proportionate to the workload (cite the DE Requirements'
Proportionality Assessment).>

## 2. Pipeline Architecture

- Stage decomposition: single-stage / ingestion-staging-transformation-publishing —
  state which, and why (see `DATA_ENGINEERING_STANDARDS.md` rule 1).
- Stage boundaries and their contracts (formal `DATA_CONTRACT_STANDARDS.md` contract
  only if externally consumed/cross-pipeline — otherwise an informal typed schema is
  sufficient and MUST be stated here).
- Batch / micro-batch / streaming model: …
- Full / incremental / CDC strategy: …

## 3. Source Connector Architecture

> Not applicable if no source connector is required.

- Source category and connector capabilities required (per
  `SOURCE_CONNECTOR_STANDARDS.md`'s Connector Contract): connectivity check
  required? Y/N and why. Schema discovery required? Y/N and why. Incremental
  extraction capability required? Y/N and why.
- Extraction mode(s): full / incremental / snapshot / CDC / streaming.
- Watermark / cursor / checkpoint strategy (only if incremental capability is
  required).

## 4. Sink Connector Architecture

> Not applicable if no sink connector is required (e.g. writing is a single direct
> library call with no meaningful destination-specific logic).

- Destination and write mode: append / overwrite / merge / upsert / delete.
- Schema-compatibility check requirement (only if the destination already holds
  data the write must remain compatible with, or the dataset is externally
  consumed).
- Retry-safety classification (see `SINK_CONNECTOR_STANDARDS.md` Write Modes
  table) and dedup mechanism if retries/reprocessing are possible.
- Destination validation / reconciliation requirement (only if production-deployed
  or externally consumed).

## 5. Transformation Placement

> Not applicable if the workload performs no transformation logic beyond a direct
> type/format conversion.

- Business rules / derived fields / mappings required: …
- Null handling, dedup keys, join cardinality: …

## 6. Data Quality Placement

> Not applicable if not triggered — see `DATA_QUALITY_STANDARDS.md` rule 1
> (externally consumed or production-deployed).

- DQ checks required (category, severity policy): …
- Quarantine requirement (only if partial success is possible): …

## 7. Restart / Recovery / Replay / Backfill

> Not applicable if the workload is a single, one-shot, non-incremental run.

- Restart behavior: …
- Replay / backfill mechanism (same code path as incremental, per
  `DATA_ENGINEERING_STANDARDS.md` rule 7): …

## 8. Schemas / Contracts / Schema Evolution

> Not applicable if the boundary is single-pipeline internal — an informal typed
> schema suffices; state that here rather than skipping the section.

- Contract required? Y/N and why (per `DATA_CONTRACT_STANDARDS.md` rule 1).
- Schema drift detection required? Y/N (per `DATA_ENGINEERING_STANDARDS.md` rule 14
  — only if the source supports schema discovery or its schema can evolve).

## 9. Idempotency and Failure Boundaries

- Idempotency mechanism (mandatory whenever retries/reprocessing are possible — see
  `ENGINEERING_STANDARDS.md` rule 7): …
- Record-level vs. run-level failure handling (quarantine only if partial success
  is possible): …

## 10. Partitioning and Performance/Scale

> Not applicable if the dataset is known-small and bounded — state the size
> assumption here (see `PERFORMANCE_AND_SCALE_STANDARDS.md` rule 1).

- Partitioning strategy: …
- Streaming/chunking requirement and batch sizes: …
- Concurrency / rate-limit considerations: …

## 11. Security / PII

- PII/sensitive data present? (from DE Requirements §9) — classification and
  handling requirement per `SECURITY_AND_PII_STANDARDS.md`.
- Credential/secret handling: which connector(s) need a `SecretProvider`.

## 12. Observability

> Not applicable — SHOULD only — if the workload is not production-deployed or
> monitored (see `OBSERVABILITY_STANDARDS.md`).

- Structured logging / metrics / correlation requirement: …

## 13. Configuration

- Typed configuration model required? (scales with config surface — see
  `CONFIGURATION_STANDARDS.md` rule 1): …
- Environment separation requirement (only if more than one environment exists): …

## 14. Deployment Implications

> Not applicable if this is local/exploratory work, not a scheduled/production
> pipeline (see `DEPLOYMENT_STANDARDS.md` scope note).

- Deployment target(s): Azure / AWS / GCP / local / on-prem — chosen per project
  context, not defaulted to Azure.
- CI gates required: …

## 15. Cloud / Vendor Boundaries

- Portability requirement (if any) and how vendor-specific code is isolated behind
  connector/sink/`SecretProvider` boundaries: …

## 16. Dependencies

- Upstream/downstream workstreams, external systems: …

## 17. Risks / Trade-offs / Assumptions

- R1: … — mitigation …
- Assumption A1: …

## 18. Required Specialists

> This is the authoritative dispatch list the Team Lead uses to decide which
> implementation specialists to invoke. Only list a specialist as Required if the
> sections above actually call for that specialist's work.

```text
Required:
- <e.g. Source Connector Developer (Sheron)>
- <e.g. Transformation Developer (Madhushika)>

Not required:
- <e.g. Sink Connector Developer (Kevin) — reason>
- <e.g. Data Quality Developer (Pradeep) — reason>
- <e.g. DevOps Developer (Milinda) — reason>
```

## 19. Out of Scope

- …

## Change Log

| Date | Author | Change |
|---|---|---|
| YYYY-MM-DD | Salinda (Data Architect) | Initial draft |
