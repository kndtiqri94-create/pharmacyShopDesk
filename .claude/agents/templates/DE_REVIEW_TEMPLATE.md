<!--
DATA ENGINEERING REVIEW REPORT TEMPLATE (owned by the Data Engineering Reviewer
agent, Ayodhya).
Target path: docs/features/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_DE_REVIEW.md
- Iteration sections are APPENDED on each re-review. Do NOT delete prior iterations.
- Verdict APPROVED only if ZERO blocking findings AND full plan/story coverage AND
  every applicable DE_STORY_DOD item is ticked with evidence AND every N/A marking
  in the DoD/DoR was actually justified by the SDD/DE Requirements.
Remove all HTML comments before finalising.
-->

# Data Engineering Review — <N.x> <FEATURE TITLE>

- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **DE Requirements:** `docs/data-engineering-requirements/<N.x>_<FEATURE>_DE_REQUIREMENTS.md`
- **SDD:** `docs/data-engineering-design/<N.x>_<FEATURE>_SDD.md`
- **DE Plan:** `docs/features/<N.x>_<FEATURE>_DE_PLAN.md`
- **Reviewer:** Ayodhya (Data Engineering Reviewer)

---

## Iteration <N>

### Verdict
**APPROVED** | **CHANGES_REQUESTED**

### Summary
<1 paragraph: scope reviewed, overall assessment, notable risks.>

### Functional Correctness
| Item | Source | Status |
|---|---|---|
| DE Plan task … | Plan §… | PASS / FAIL / NOT FOUND |
| AC-1 … | Story §4 | PASS / FAIL / NOT FOUND |

### Data Engineering Correctness
> Evaluate ONLY the rows that apply to this workload, per the SDD. Mark others N/A
> with a one-line reason — do not blank-fill rows that genuinely do not apply, and
> do not skip a row that does apply.

| Dimension | Applies? | Finding | Status |
|---|---|---|---|
| Source extraction correctness (pagination, retries, auth) | Y/N | … | PASS/FAIL/N/A |
| Sink correctness (write mode, atomicity, retry safety) | Y/N | … | PASS/FAIL/N/A |
| Transformation correctness (null handling, joins, determinism) | Y/N | … | PASS/FAIL/N/A |
| DQ correctness (thresholds, quarantine) | Y/N | … | PASS/FAIL/N/A |
| Schema / contract conformance | Y/N | … | PASS/FAIL/N/A |
| Idempotency | Y/N | … | PASS/FAIL/N/A |
| Restartability | Y/N | … | PASS/FAIL/N/A |
| Replay / backfill | Y/N | … | PASS/FAIL/N/A |
| Incremental / CDC handling | Y/N | … | PASS/FAIL/N/A |
| Checkpoint correctness | Y/N | … | PASS/FAIL/N/A |
| Late-arriving data handling | Y/N | … | PASS/FAIL/N/A |
| Partition / scaling decisions | Y/N | … | PASS/FAIL/N/A |

### Standards Compliance
> Validate against every standard the SDD/DoD identified as applicable to this
> workload's specialists. Do NOT blindly enforce a conditional rule whose trigger
> is absent — cite the trigger check, not just the rule.

1. `<path/to/file.py>:<line>` — *Standard:* `<STANDARD.md §rule>` — *Trigger check:*
   `<why this rule applies/does not apply to this workload>` — **Problem:** …
   **Required change:** …

### Proportionality Validation
> Did the Data Architect/Team Lead choose the right level of ceremony for this
> workload? Confirm neither over-engineering (enterprise controls with no
> triggering condition) nor under-engineering (a triggering condition present but
> the corresponding control missing).

- Over-engineering check: …
- Under-engineering check: …

### Blocking Findings
1. **[Source | Sink | Transform | DQ | DevOps]** `<path>:<line>` — *Rule violated:*
   `<STANDARD.md §x | SDD §y | Plan §z | Story AC-N>` — **Problem:** … — **Required
   change:** …

### Security Findings
> Secrets, credentials, PII exposure, logging, privilege, insecure configuration,
> dependency/security issues. Use OWASP Top 10 categories only where an API/web
> surface is actually exposed by this workload (rare for pure DE pipelines); for
> pure data-platform surfaces, evaluate against `SECURITY_AND_PII_STANDARDS.md`
> directly instead of forcing an inapplicable OWASP mapping.

1. **Severity:** Critical | High | Medium | Low — **Category:**
   `SECURITY_AND_PII_STANDARDS.md §x` (or `OWASP A0X` if an API/web surface applies)
   — `<path>:<line>` — **Finding:** … — **Remediation:** …

### Performance Findings
> Only where relevant — entire-dataset materialization risk, row-by-row processing
> where vectorization was warranted, missing batching/chunking for an unbounded
> source, unnecessary copies, scaling blockers.

1. `<path>:<line>` — **Finding:** … — **Remediation:** …

### Definition of Done Coverage
> Source: `docs/checklists/<N.x>_<FEATURE>_DE_STORY_DOD.md`. Any unticked,
> non-N/A box is BLOCKING. An N/A box whose justification does not hold up against
> the SDD/DE Requirements is ALSO blocking (re-tag it and require the item be
> completed).

- [ ] DoD.1 — …
- [ ] DoD.2 — …

### Non-blocking Suggestions
1. …

### Re-review Instructions
Exact items the Team Lead must have fixed before calling `*de-re-review`:
1. …

### Counts (returned to Team Lead)
- Blocking findings: <N>
- Critical/High security findings: <N>
- Findings by specialist area: Source <N>, Sink <N>, Transform <N>, DQ <N>, DevOps <N>

---
