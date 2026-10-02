<!--
TECHNICAL PLAN TEMPLATE (owned by the Team Lead agent).
Target path: docs/features/<WORKSTREAM_NUM>.<SUBTASK>_<FEATURE>_PLAN.md
Plans describe HOW the team will implement a story. No success criteria / timelines / migration strategy prose.
The Threat Model section is MANDATORY — shift-left security.
Remove all HTML comments before finalising.
-->

# Implementation Plan <N.x> — <FEATURE TITLE>

- **Workstream:** <N> — <Workstream name>
- **User Story:** `docs/user-stories/<N.x>_<FEATURE>_USER_STORY.md`
- **Status:** Draft | Ready for Dev | In Progress | Delivered
- **Author:** Sanjeewa (Team Lead)
- **Created:** YYYY-MM-DD

## 1. Summary
<2–4 sentences describing exactly what will be built. Include verbatim details from the user's prompt where they affect the design.>

## 2. Exemplars / Reference Pattern
> Agents MUST follow these exemplars. If no exemplar is suitable, state why and propose a new one.

- Backend exemplar: `backend/…/Users/UsersController.cs` (+ service, DTOs, handler)
- Frontend exemplar: `frontend/src/app/user-management/…` (list + create + edit)

## 3. Files to Touch
### 3.1 Backend — add
- `…`
### 3.2 Backend — modify
- `…`
### 3.3 Frontend — add
- `…`
### 3.4 Frontend — modify
- `…`
### 3.5 Docs / config
- `…`

## 4. Data Model & Migrations
- Entity changes: …
- EF migrations: <name> — add columns, indexes, FKs …
- Backfill / data-preservation: …
- Rollback strategy: …

## 5. API Contract (draft — finalised in API_DOC)
| Method | Route | Purpose | AuthZ |
|---|---|---|---|
| GET | /api/roles | List roles (tenant-scoped) | role:read |
| … | … | … | … |

Contract is fully detailed in `docs/api-docs/<N.x>_<FEATURE>_API_DOC.md`.

## 6. Threat Model (STRIDE-lite — MANDATORY)
> Address every letter below. Keep each row 1–2 lines. Reviewer validates these are implemented.

| STRIDE | Applies? | Risk in this feature | Mitigation / control |
|---|---|---|---|
| **S**poofing (identity) | Y/N | … | Authentication required; JWT validated; … |
| **T**ampering (integrity) | Y/N | … | Request validation; anti-forgery; optimistic concurrency; … |
| **R**epudiation | Y/N | … | Audit log entries for privileged actions with correlation id; … |
| **I**nformation Disclosure | Y/N | … | Tenant scoping on every query; no PII in logs; audit fields never returned; … |
| **D**enial of Service | Y/N | … | Rate limit on endpoint; pagination hard cap; input size limits; … |
| **E**levation of Privilege | Y/N | … | Role/permission check at controller + service; no admin-only action bypasses … |

### 6.1 Assets & Trust Boundaries
- Sensitive data in this feature: …
- Trust boundary crossings: …

### 6.2 Pre-emptive OWASP mapping
- Likely-in-play: A01, A03, A07 …  (reviewer will still do a full A01–A10 pass)

## 7. Test Strategy
- Unit tests: which services / handlers, which branches.
- Integration tests: which endpoints, which auth/tenant paths.
- Frontend tests: which components / services, which AC covered.
- Negative tests MUST cover: unauthenticated, wrong tenant, wrong role, invalid input, oversized input.

## 8. Observability
- Structured log events to emit (name + fields).
- Metrics / counters (if any).
- Correlation id propagation points.

## 9. Risks & Trade-offs
- R1: … — mitigation …
- R2: …

## 10. Out of Scope
- …

## 11. Handoff Split
- **Backend tasks:** numbered list derived from Files-to-Touch §3.1–3.2.
- **Frontend tasks:** numbered list derived from Files-to-Touch §3.3–3.4.
- Parallelisable: Yes / No (note any order dependencies).
