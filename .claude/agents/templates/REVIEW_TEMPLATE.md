<!--
CODE REVIEW REPORT TEMPLATE (owned by the Code Reviewer agent).
Target path: docs/features/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_REVIEW.md
- Iteration sections are APPENDED on each re-review. Do NOT delete prior iterations.
- Verdict APPROVED only if ZERO blocking findings AND ZERO Critical/High OWASP findings AND full plan/story coverage AND Threat Model controls from the Plan are all implemented.
Remove all HTML comments before finalising.
-->

# Code Review — <N.x> <FEATURE TITLE>

- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **Plan:** `docs/features/<N.x>_<FEATURE>_PLAN.md`
- **API Doc:** `docs/api-docs/<N.x>_<FEATURE>_API_DOC.md`
- **Reviewer:** Ravindu (Code Reviewer)

---

## Iteration <N>

### Verdict
**APPROVED** | **CHANGES_REQUESTED**

### Summary
<1 paragraph: scope reviewed, overall assessment, notable risks.>

### Blocking Findings
> Every item blocks approval. Critical/High OWASP findings are also echoed here.

1. **[BE | FE]** `<path/to/file.cs>:<line>` — *Rule violated:* `<BACKEND_STANDARDS §x.y | FRONTEND_STANDARDS §x.y | Plan §… | Story AC-…>`  
   **Problem:** …  
   **Required change:** …

### Security Findings (OWASP Top 10 2021)
> Full scan for A01–A10 + insecure-code patterns. Critical/High severity = blocking.

1. **Severity:** Critical | High | Medium | Low — **OWASP:** A0X — **[BE | FE]** `<path>:<line>`  
   **Vulnerability:** … (concrete attack scenario / impact)  
   **Remediation:** …

### OWASP Top 10 Coverage Matrix
| OWASP | Status | Rationale |
|---|---|---|
| A01 Broken Access Control | PASS / FAIL / N/A | … |
| A02 Cryptographic Failures | … | … |
| A03 Injection | … | … |
| A04 Insecure Design | … | … |
| A05 Security Misconfiguration | … | … |
| A06 Vulnerable & Outdated Components | … | … |
| A07 Identification & AuthN Failures | … | … |
| A08 Software & Data Integrity Failures | … | … |
| A09 Security Logging & Monitoring Failures | … | … |
| A10 SSRF | … | … |

### Threat Model Validation
> Each row of Plan §6 must be honoured in code. FAIL here = blocking.

| STRIDE | Applies? | Control from Plan | Implemented? | Evidence (file:line) |
|---|---|---|---|---|
| Spoofing | Y/N | … | PASS/FAIL | … |
| Tampering | Y/N | … | … | … |
| Repudiation | Y/N | … | … | … |
| Information Disclosure | Y/N | … | … | … |
| Denial of Service | Y/N | … | … | … |
| Elevation of Privilege | Y/N | … | … | … |

### Non-blocking Suggestions
1. …

### Plan / Acceptance Criteria Coverage
| Item | Source | Status |
|---|---|---|
| Plan task 3.1 … | Plan §3.1 | PASS / FAIL / NOT FOUND |
| AC-1 … | Story §4 | PASS / FAIL / NOT FOUND |

### Definition of Done Coverage
> Source: the per-workstream file `docs/checklists/<WORKSTREAM_NUM>_<FEATURE>_STORY_DOD.md` (copied from `.claude/agents/templates/STORY_DOD_TEMPLATE.md`). Any unticked OR unevidenced box is a blocking finding. A missing per-workstream DoD file is itself a blocking finding.

- [ ] DoD.1 — …
- [ ] DoD.2 — …

### Re-review Instructions
Exact items the Team Lead must have fixed before calling `*re-review`:
1. …

### Counts (returned to Team Lead)
- Blocking findings: <N>
- Critical/High OWASP findings: <N>
- Backend findings: <N>
- Frontend findings: <N>

---
