<!--
DATA ENGINEERING IMPLEMENTATION PLAN TEMPLATE (owned by the Team Lead agent, Sanjeewa).
Target path: docs/features/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_DE_PLAN.md

This is the DE counterpart to PLAN_TEMPLATE.md (which remains for TIQRIDemo
backend/frontend/DevOps workstreams). Use THIS template whenever the workstream's
SDD (docs/data-engineering-design/) exists. Sanjeewa authors this plan himself — no
delegation — synthesizing the SDD's decisions into a concrete dispatch plan.
Remove all HTML comments before finalising.
-->

# Data Engineering Implementation Plan <N.x> — <FEATURE TITLE>

- **Workstream:** <N> — <Workstream name>
- **DE Requirements:** `docs/data-engineering-requirements/<N.x>_<FEATURE>_DE_REQUIREMENTS.md`
- **SDD:** `docs/data-engineering-design/<N.x>_<FEATURE>_SDD.md`
- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **Status:** Draft | Ready for Dev | In Progress | Delivered
- **Author:** Sanjeewa (Team Lead)
- **Created:** YYYY-MM-DD

## 1. Summary

<2–4 sentences: what will be built. Include verbatim details from the user's
prompt/SDD where they affect dispatch.>

## 2. Architecture Recap

One paragraph summarizing the SDD's architectural decisions (stage count,
full/incremental/CDC, contract requirement, DQ requirement) — full detail lives in
the SDD; this plan does not re-derive architecture, it operationalizes it.

## 3. Required Specialists (from SDD §18)

```text
Required:
- …

Not required:
- … — reason
```

Only specialists listed as Required are dispatched in §6.

## 4. Files / Components to Touch

> Paths under the intended roots declared in `core-config.yaml`
> `dataEngineering.implementationRoots`. Do not invent new roots if one already
> fits.

### 4.1 Source connector — add/modify
- `…`
### 4.2 Sink connector — add/modify
- `…`
### 4.3 Transformation — add/modify
- `…`
### 4.4 Data quality — add/modify
- `…`
### 4.5 Infra / deployment — add/modify
- `…`
### 4.6 Docs / config
- `…`

## 5. Data Movement & State Strategy

- Extraction mode(s): …
- Write mode(s): …
- Watermark/checkpoint persistence: … (only if incremental — see SDD §3, §7)
- Idempotency mechanism: … (mandatory whenever retries/reprocessing are possible)

## 6. Specialist Dispatch Plan

| Specialist | Dispatch? | Depends on | Parallelisable with |
|---|---|---|---|
| Sheron (Source Connector) | Y/N | — | Kevin, Pradeep (if interfaces agreed first) |
| Kevin (Sink Connector) | Y/N | Record model from Sheron/Madhushika if applicable | Sheron |
| Madhushika (Transformation) | Y/N | Source record model from Sheron | Pradeep |
| Pradeep (Data Quality) | Y/N | Transformation output contract from Madhushika | Kevin |
| Milinda (DevOps) | Y/N | — | All of the above |

> Note any interface/record-model coordination needed BEFORE parallel dispatch (see
> team-lead.md DE orchestration — coordinate shared interfaces first if two
> specialists' work would otherwise make incompatible assumptions).

## 7. Threat Model / Security Notes

> Lighter-weight than the STRIDE-lite table used for web/API workstreams — DE
> workloads are evaluated primarily through `SECURITY_AND_PII_STANDARDS.md`. Include
> a STRIDE-lite table only if the workload exposes an API/web surface in addition
> to its pipeline (rare — most DE workstreams do not).

- Secrets/credentials handling: …
- PII/sensitive data handling (only if DE Requirements §9 identifies sensitive
  data): …
- Environment separation (only if more than one environment exists): …

## 8. Test Strategy

- Unit tests: which connector/sink/transformation/DQ functions, which branches.
- Integration tests: which real/emulated dependency (only if a remote/networked
  connector or sink is involved).
- Restart/recovery/idempotency tests: … (only if incremental/persisted state
  exists).
- DQ tests: … (only if DQ is in scope).

## 9. Observability

> Not applicable — SHOULD only — if not production-deployed/monitored.

- Structured log events / metrics to emit: …

## 10. Risks & Trade-offs

- R1: … — mitigation …

## 11. Out of Scope

- …

## 12. Handoff Split

- Derived from §6 Specialist Dispatch Plan. Parallelisable: Yes/No (note any order
  dependencies from shared interfaces).
