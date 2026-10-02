<!--
DEFINITION OF DONE — USER STORY — TEMPLATE
Owners: Backend Developer + Frontend Developer (agents: backend-developer, frontend-developer).

How to use:
1. When *develop-story runs for workstream <TASKS_NUMBER>.<SUB_TASKS_NUMBER>_<FEATURE>:
   - If docs/checklists/<TASKS_NUMBER>.<SUB_TASKS_NUMBER>_<FEATURE>_STORY_DOD.md does NOT exist,
     copy this template verbatim to that path, remove this HTML comment block, and fill the placeholders.
   - If it DOES exist (because the other dev agent already created it), ADD to it — do not overwrite.
2. Each developer agent ticks only the boxes for its area; shared boxes (e.g. DoD.1, DoD.29) are joint.
3. Every tick MUST include evidence in the evidence column (file:line, CI log snippet, or story Completion Notes pointer).
4. Any unticked box means the work is NOT Done — either fix it, or HALT with BLOCKED.
5. The Code Reviewer reads this per-workstream file and treats any unticked/unevidenced box as a blocking finding.
6. This template file itself is NEVER edited per workstream.
-->

# Definition of Done — User Story <WORKSTREAM_NUM> <FEATURE>

- **Story:** `<USER_STORY_PATH>`
- **Plan:** `<PLAN_PATH>`
- **API Doc:** `<API_DOC_PATH>`
- **Backend owner:** Harinda (Backend Developer)
- **Frontend owner:** Hasika (Frontend Developer)
- **Status:** In Progress | Ready for Review | Blocked
- **Created:** YYYY-MM-DD

Every box below MUST be ticked by the developer agent(s) responsible for each area. Any unticked box means the work is NOT Done and is NOT to be submitted for review. The Code Reviewer treats any unticked or unevidenced box as a blocking finding.

## Plan / Story coverage
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.1** | Every task listed in the Plan `Files to Touch` section has been addressed (added/modified/deleted). | |
| [ ] **DoD.2** | Every Acceptance Criterion (`AC-N`) from the user story is implemented. | |
| [ ] **DoD.3** | Story's `File List` section is complete and accurate (Added / Modified / Deleted). | |
| [ ] **DoD.4** | Story's Change Log has a new entry for this iteration. | |

## Standards compliance
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.5** | Backend changes comply with `docs/development-standards/BACKEND_STANDARDS.md` (loaded via `INDEX.md` for the concerns touched). | |
| [ ] **DoD.6** | Frontend changes comply with `docs/development-standards/FRONTEND_STANDARDS.md` (loaded via `INDEX.md` for the concerns touched). | |
| [ ] **DoD.7** | Code follows the exemplars cited in the Plan (User Management unless the Plan names a newer one). | |
| [ ] **DoD.8** | Audit fields (`isArchived`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `archivedAt`, `archivedBy`) are NEVER returned in API responses. | |
| [ ] **DoD.9** | DTOs and data mappings: no shape mismatches, correct casing, correct nullability; matches `API_DOC`. | |

## Security (shift-left enforcement of the Plan's threat model)
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.10** | Every mitigation listed in Plan §6 (Threat Model) has been implemented in code; file:line evidence recorded per row. | |
| [ ] **DoD.11** | All endpoints have explicit `[Authorize]` (or an explicit anonymous-by-design note). | |
| [ ] **DoD.12** | All tenant-scoped queries/commands are scoped by `OrganizationId`. | |
| [ ] **DoD.13** | Input validation present on every API model (DataAnnotations and/or FluentValidation). | |
| [ ] **DoD.14** | No secrets / API keys / connection strings committed to source. | |
| [ ] **DoD.15** | No raw SQL built via string concatenation with user input. | |
| [ ] **DoD.16** | Logs do not contain secrets, tokens, passwords, or PII. | |
| [ ] **DoD.17** | Frontend does not use `bypassSecurityTrust*` on untrusted data and does not bind `[innerHTML]` to server data without sanitisation. | |

## Automated gates (must all be PASS — paste the output / log location)
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.18** | Build passes: `dotnet build` (backend) / `ng build` (frontend). | |
| [ ] **DoD.19** | Tests pass: `dotnet test` (backend) / `ng test --watch=false` (frontend). | |
| [ ] **DoD.20** | Lint clean: `dotnet format --verify-no-changes` (backend) / `ng lint` or `eslint` (frontend). | |
| [ ] **DoD.21** | Dependency audit clean of High/Critical CVEs: `dotnet list package --vulnerable --include-transitive` and `pnpm audit --prod` (or `npm audit --production`). | |
| [ ] **DoD.22** | No new secrets detected (e.g. `gitleaks detect --no-git`); if tool unavailable, agent manually greps for common secret patterns. | |
| [ ] **DoD.23** | EF migrations: applied cleanly and rolled back cleanly against a throwaway DB; `up`/`down` scripts reviewed. | |

## Testing
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.24** | Unit tests cover the branching logic added (services, handlers, validators). | |
| [ ] **DoD.25** | Integration tests cover each new endpoint including: unauthenticated, wrong tenant, wrong role, invalid input, oversized input. | |
| [ ] **DoD.26** | Frontend tests cover component logic and at least one AC per user-visible flow. | |

## Observability
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.27** | Structured log events emitted for privileged / security-sensitive actions with correlation id. | |
| [ ] **DoD.28** | No noisy logs added at Information level for hot paths. | |

## API contract
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.29** | `docs/api-docs/<N>_<FEATURE>_API_DOC.md` updated and matches the implementation exactly (fields, casing, nullability, status codes). | |

## Handoff
| # | Item | Evidence |
|---|---|---|
| [ ] **DoD.30** | Story Status set to `Ready for Review`. | |
| [ ] **DoD.31** | Team Lead notified so it can invoke the Code Reviewer. | |

## Developer Sign-off
- **Backend:** Harinda — YYYY-MM-DD
- **Frontend:** Hasika — YYYY-MM-DD
- **Unticked items (if any):** <list, with reason and mitigation plan>
