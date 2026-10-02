<!--
DEFINITION OF DONE — DATA ENGINEERING USER STORY — TEMPLATE
Owners: whichever implementation specialists were dispatched (Sheron, Kevin,
Madhushika, Pradeep, Milinda), per the DE Plan's §6 Specialist Dispatch Plan.

How to use:
1. If docs/checklists/<N.x>_<FEATURE>_DE_STORY_DOD.md does NOT exist, the FIRST
   dispatched specialist copies this template verbatim to that path, removes this
   comment block, and fills placeholders.
2. If it DOES exist (another specialist already created it), specialists ADD to it
   — never overwrite another specialist's ticks.
3. Each specialist ticks ONLY the boxes for its own area. Shared boxes are joint.
4. Every tick MUST include evidence (file:line, test output, or story Completion
   Notes pointer).
5. PROPORTIONALITY: an item whose trigger condition does not apply to this workload
   (e.g. incremental/checkpoint tests when the workload has no incremental
   capability) is marked N/A with a one-line reason — not left unticked, and not
   forced.
6. The Data Engineering Reviewer (Ayodhya) treats any unticked, non-N/A box as a
   blocking finding, and validates that every N/A marking was actually justified by
   the SDD/DE Requirements (i.e. Ayodhya checks the proportionality judgment, not
   just the box).
7. This template file itself is NEVER edited per workstream.
-->

# Definition of Done — Data Engineering User Story <WORKSTREAM_NUM> <FEATURE>

- **Story:** `<USER_STORY_PATH>`
- **SDD:** `<SDD_PATH>`
- **DE Plan:** `<DE_PLAN_PATH>`
- **Status:** In Progress | Ready for Review | Blocked
- **Created:** YYYY-MM-DD

## Plan / design coverage
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.1** | Every task in the DE Plan `Files to Touch` section has been addressed. | |
| [ ] **DoD.2** | Every Acceptance Criterion in the user story is implemented. | |
| [ ] **DoD.3** | Implementation matches the SDD's architectural decisions (stage count, load strategy, contract requirement) — no undocumented deviation. | |

## Standards compliance (only the specialist's own area)
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.4** | Applicable rules from `ENGINEERING_STANDARDS.md` and `PYTHON_STANDARDS.md` followed (loaded via `INDEX.md`). | |
| [ ] **DoD.5** | Source connector: `SOURCE_CONNECTOR_STANDARDS.md` followed; declared `capabilities` match what is actually supported (no faked no-ops). — N/A if no source connector in scope. | |
| [ ] **DoD.6** | Sink connector: `SINK_CONNECTOR_STANDARDS.md` followed; write mode and retry-safety classification match the SDD. — N/A if no sink connector in scope. | |
| [ ] **DoD.7** | Transformation: `TRANSFORMATION_STANDARDS.md` followed; business rules traceable to requirements/design. — N/A if no transformation in scope. | |
| [ ] **DoD.8** | Data Quality: `DATA_QUALITY_STANDARDS.md` followed; PASS/WARN/FAIL thresholds match the SDD. — N/A if no DQ in scope. | |
| [ ] **DoD.9** | DevOps/infra: `DEPLOYMENT_STANDARDS.md` followed; no cloud provider hardcoded beyond what the SDD specifies. — N/A if no infra/deployment in scope. | |

## Security
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.10** | No secrets, credentials, or connection strings committed to source or config. | |
| [ ] **DoD.11** | Credentials resolved via a `SecretProvider`-style boundary where the connector/sink requires authentication. — N/A if no authentication is required. | |
| [ ] **DoD.12** | PII/sensitive-data handling matches `SECURITY_AND_PII_STANDARDS.md` (classification, masking, retention). — N/A if DE Requirements §9 confirms no sensitive data. | |
| [ ] **DoD.13** | No secret or restricted-data value appears in logs at any level. | |

## Idempotency, correctness, resource cleanup (unconditional wherever applicable)
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.14** | Idempotency mechanism implemented and tested wherever retries/reprocessing are possible. | |
| [ ] **DoD.15** | Resources (connections, sessions, files) are released deterministically, including on the failure path. | |
| [ ] **DoD.16** | Failure is visible (non-zero exit / clear error / propagated exception) — never silently swallowed. | |

## Testing
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.17** | Unit tests cover new/changed behavior, including null/empty/malformed/duplicate edge cases. | |
| [ ] **DoD.18** | Incremental/checkpoint/restart tests pass. — N/A if the workload has no incremental or persisted-state capability. | |
| [ ] **DoD.19** | DQ tests pass at and around configured thresholds. — N/A if no DQ in scope. | |
| [ ] **DoD.20** | `ruff check`, `ruff format --check`, `mypy`, and `pytest` all pass. | |

## Observability
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.21** | Structured logging/metrics implemented per `OBSERVABILITY_STANDARDS.md`. — N/A (SHOULD only) if the workload is not production-deployed or monitored. | |

## Deployment
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.22** | CI gates (dependency/secret scanning unconditional; lint/type/test conditional per `DEPLOYMENT_STANDARDS.md`) pass. | |
| [ ] **DoD.23** | Deployment/promotion steps completed. — N/A if this is local/exploratory work, not a scheduled/production pipeline. | |

## Handoff
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.24** | Story Status set to `Ready for Review`. | |
| [ ] **DoD.25** | Team Lead notified so it can invoke the Data Engineering Reviewer. | |

## Specialist Sign-off
- **Source Connector (Sheron):** — YYYY-MM-DD (or "Not dispatched")
- **Sink Connector (Kevin):** — YYYY-MM-DD (or "Not dispatched")
- **Transformation (Madhushika):** — YYYY-MM-DD (or "Not dispatched")
- **Data Quality (Pradeep):** — YYYY-MM-DD (or "Not dispatched")
- **DevOps (Milinda):** — YYYY-MM-DD (or "Not dispatched")
- **Unticked items (if any):** <list, with reason and mitigation plan>
