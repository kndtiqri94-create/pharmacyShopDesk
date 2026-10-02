<!--
PRD TEMPLATE (owned by the Product Owner agent).
Target path: docs/SOLUTION_PRD.md
Remove all HTML comments before finalising.
-->

# Product Requirements Document — <PRODUCT NAME>

> **Status:** Draft | Approved  
> **Version:** vX.Y  
> **Last updated:** YYYY-MM-DD  
> **Owner:** Product Owner (agent: product-owner)

## 1. Vision
<One or two paragraphs. Who is this for, what problem does it solve, why now.>

## 2. Goals & Non-Goals
### 2.1 Goals
- G1 …
- G2 …
### 2.2 Non-Goals (explicit)
- NG1 …

## 3. Primary Users / Personas
- **<Persona name>** — role, key jobs-to-be-done, pain points.

## 4. Key Use Cases
- UC1 — <title>: <1-line narrative>
- UC2 — …

## 5. Functional Requirements
> Group by domain area. Each requirement gets a stable id `FR-<area>-<N>` so stories and plans can trace back.

### 5.1 <Area, e.g. Role Management>
- **FR-ROLE-1** …
- **FR-ROLE-2** …

## 6. Non-Functional Requirements
| Category | Requirement |
|---|---|
| Security | Multi-tenant isolation; OWASP Top 10 enforced; … |
| Performance | List endpoints ≤ 300 ms p95 under N RPS; … |
| Availability | …|
| Accessibility | WCAG 2.1 AA on all user-facing surfaces |
| Compliance | …|
| Observability | Structured logs with correlation id; …|

## 7. Constraints & Assumptions
- Tech / platform constraints …
- Regulatory / contractual constraints …
- Assumptions we are making …

## 8. Dependencies
- Internal teams, external systems, third-party vendors.

## 9. Open Questions
- OQ1 — <question> — owner, target resolution date.

## 10. Change Log
| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | YYYY-MM-DD | Shiham (PO) | Initial draft |
