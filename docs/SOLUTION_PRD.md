# Product Requirements Document — HireFlow

> **Status:** Draft
> **Version:** v0.1
> **Last updated:** 2026-08-13
> **Owner:** Product Owner (agent: product-owner)

## 1. Vision
HireFlow is a recruitment platform. This first slice covers the candidate-facing Job
Application screen for an advertised role: a candidate reads a role advert and submits an
application (name, email, CV, optional cover note). This is a demo project: the goal is to
demonstrate the end-to-end screen behaviour (validation, submit, success, error/retry,
reload-persistence) rather than a production-integrated hiring pipeline.

## 2. Goals & Non-Goals
### 2.1 Goals
- G1 Let a candidate view an advertised role and submit a complete application in under 2 minutes.
- G2 Validate required fields and email format client-side before allowing submit, with inline errors.
- G3 Persist a submitted application so it survives a page reload.
- G4 Handle every state shown in the design: default, validating, submitting, success, error (with retry).
- G5 Deliver both a backend project and a frontend project for this feature as separate demo artifacts (see Constraints — they are intentionally not integrated for this phase).

### 2.2 Non-Goals (explicit)
- NG1 Authentication / candidate accounts.
- NG2 Multi-step application wizard (this is a single-page/single-step form).
- NG3 Server-side email notifications to the candidate or hiring manager.
- NG4 Job search / role listing / browse experience (the "All open roles" link and other-roles browsing are out of scope; only the single advertised-role application screen is in scope).
- NG5 Frontend↔backend integration — for this demo phase the frontend does not call the backend API (see Constraints).

## 3. Primary Users / Personas
- **Candidate** — an external job applicant viewing the advertised role page and submitting their application. No account/login; single anonymous session per browser.

## 4. Key Use Cases
- UC1 — Happy path: candidate opens the role page, fills name/email/CV (+ optional cover note), submits, sees a success/confirmation state, and the application persists (survives reload).
- UC2 — Validation: candidate tries to submit with a missing required field or a malformed email; inline errors appear per field plus a summary banner, and submit stays blocked until fixed.
- UC3 — Submit failure & retry: the persist step fails; the candidate sees a visible error state (not silent) and can retry the same submission without re-entering data.

## 5. Functional Requirements
> Grouped by domain area. Each requirement gets a stable id `FR-<area>-<N>`.

### 5.1 Job Application Form (frontend, FR-JOBAPP)
- **FR-JOBAPP-1** Render the "Apply for this role" form for the single advertised role, matching the fields on the design: Full name (required, text), Email (required, must match a valid email pattern), CV (required, file picker + drag-and-drop, accepts .pdf/.doc/.docx up to 10MB — store file name/size only, not binary content, per the localStorage constraint), Cover note (optional, up to 500 characters, with a live character counter).
- **FR-JOBAPP-2** Validate required fields (name, email, CV) and email format. Do not run validation error display before the candidate has attempted a submit ("tried" state), then re-validate live per the design's behaviour. Block the submit action while any required field is invalid or missing.
- **FR-JOBAPP-3** On invalid submit attempt: show an inline error under each invalid field, show an error summary banner at the top of the form, and set focus/visual highlighting per the design's error styling. Submit must remain blocked until all errors are resolved.
- **FR-JOBAPP-4** On a valid submit: transition the form into a "submitting" state (disable the submit control / show a busy indicator) while the application is persisted, matching the design's default/validating/submitting/success/error state set.
- **FR-JOBAPP-5** On successful persistence: show the "Application sent" success/confirmation state (per design), including a "Start again" action that resets the form to a fresh, empty application.
- **FR-JOBAPP-6** On a persistence failure: show a visible, non-blocking error state (not just a console error) explaining the submit failed, and offer a retry action that re-attempts persistence of the same in-memory form data without forcing the candidate to re-enter it.
- **FR-JOBAPP-7** A successfully submitted application must persist across a full page reload — i.e. after reload, the candidate should see the same submitted/success state for that application rather than a blank form (persisted via `localStorage`, see Constraints).

### 5.2 Job Application Persistence — Backend (demo, standalone) (FR-JOBAPP-BE)
- **FR-JOBAPP-BE-1** Build a standalone backend project that exposes an API to create/persist a job application (name, email, CV metadata, optional cover note) and to retrieve a persisted application, following the repo's backend development standards. This backend is a demo artifact for this phase — see Constraints; it is not called by the frontend.

## 6. Non-Functional Requirements
| Category | Requirement |
|---|---|
| Security | Demo-only: no auth required for this screen (see Non-Goals). No sensitive data handling requirements beyond basic input sanitization of free-text fields. |
| Performance | A candidate can complete and submit the form in under 2 minutes (UX/flow requirement, not a server latency target — no backend is called from the frontend in this phase). |
| Availability | Frontend must work fully standalone (no backend dependency) since it persists to `localStorage`. |
| Accessibility | WCAG 2.1 AA, per `docs/design/CLAUDE.md` project design rules (contrast, mobile-first down to 360px). |
| Compliance | None specified for this demo. |
| Observability | Not required for this demo phase beyond visible in-UI error states. |

## 7. Constraints & Assumptions
- **Demo project only.** Both a backend project and a frontend project must be built for this feature, but they are explicitly **not integrated** in this phase — the frontend does not call the backend API.
- The frontend persists application data using browser **`localStorage`** only, and must work fully independently of any backend/API.
- CV "upload" in the frontend is demo-only: since data is stored in `localStorage`, only the file's name and size are captured/persisted (matching the design's own mock behaviour), not the file's binary contents.
- Design reference: the user referenced `.docs/design/Job Application Page.dc`. The project's actual design docs live under `docs/design/`, and the closest matching file found there is `docs/design/Job Application Page.dc.html`. This PRD treats that file as the intended design reference — **flagging the path/extension mismatch** in case a different or newer file was intended.
- Design source also implies two related design files present in `docs/design/` that are explicitly out of scope for this feature: `Job Application Mobile.dc.html` (mobile variant — not requested, not built under this task) and `Open Roles*.dc.html` (role browse/search — excluded per Non-Goals NG4). Not building against these now; flagged so they aren't accidentally assumed in scope.
- Assumption: "Success/failure" for the frontend persistence step is simulated/demo logic (e.g., a deliberate or injectable failure path) since a `localStorage` write essentially always succeeds outside of quota/availability edge cases (private browsing storage limits, quota exceeded, storage disabled). The exact mechanism for triggering the "submit failure" state is not yet specified by the stakeholder — see Open Questions OQ1.

## 8. Dependencies
- `docs/design/Job Application Page.dc.html` — visual design reference (see path/extension flag above).
- `docs/design/CLAUDE.md` — HireFlow brand/design rules (contrast, mobile-first, component reuse, no gradients/heavy shadows).
- `docs/development-standards/BACKEND_STANDARDS.md`, `docs/development-standards/FRONTEND_STANDARDS.md` — mandatory implementation conventions for both projects.

## 9. Open Questions
- OQ1 — What should trigger the frontend's "submit failure" state in a `localStorage`-only demo (e.g., a simulated random/toggleable failure, an actual `localStorage` quota-exceeded/unavailable condition, or a deliberate "fail once then succeed on retry" demo affordance)? Needs stakeholder confirmation before the Frontend Developer builds the error/retry path. Owner: stakeholder, target resolution: before implementation of FR-JOBAPP-6.
- OQ2 — Confirm the intended design file: is `docs/design/Job Application Page.dc.html` the correct reference for `.docs/design/Job Application Page.dc`, or was a different/newer file meant? Owner: stakeholder.
- OQ3 — Backend persistence (FR-JOBAPP-BE-1) is being built as a standalone, non-integrated demo artifact per explicit instruction. No further backend-specific behavioural requirements (e.g., auth, listing/search for hiring managers) were given — confirm if any are expected in this phase or deferred entirely.

## 10. Change Log
| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: HireFlow Job Application screen (frontend localStorage-only + standalone backend persistence demo). |
