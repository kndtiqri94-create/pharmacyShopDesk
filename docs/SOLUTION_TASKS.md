# Solution Tasks (Backlog) — ShopDesk

> **Status:** Draft
> **Version:** v0.2
> **Last updated:** 2026-10-03
> **Owner:** Product Owner (agent: product-owner)
> **Source PRD:** `docs/SOLUTION_PRD.md` (v0.2)

## How to read this document

- **Epics** are numbered `E-{n}`. Each epic groups one cohesive area of capability and maps to one or more PRD FR sections.
- **Features** are numbered `F-{epic}.{n}` and represent a meaningful slice of an epic. Each feature is delivered as its own workstream.
- **Stories** are numbered `S-{epic}.{feature}.{n}`. Each story is independently shippable and traces back to one or more `FR-*` ids in the PRD.
- Every story is rendered as a Markdown checkbox (`- [ ]`). The Team Lead marks it complete by switching to `- [x]`.
- Each story line is formatted as: `- [ ] **S-id** [SURFACE] short title. — _Traces: FR-XXX-N_ — _Weight: N_ — _Design: docs/design/<FILE>_`
- **Surface** tags for this project:
  - `WEB` — ShopDesk back-office frontend (browser UI, mock/in-memory data behind service interfaces, responsive).
  - `DOC` — supporting documentation produced alongside a story.
- **Weight** is a mandatory Fibonacci complexity estimate (1, 2, 3, 5, 8, 13 — see `.claude/agents/core-config.yaml` `taskWeight.meaning`) assigned by the Product Owner for every story. It drives the weighted completion % on `docs/SOLUTION_PROGRESS.html`. A story sized 13 is usually a signal it should be split.
- All stories carry the design reference `docs/design/ShopDesk-design-system.md` (hand transcription of the user's PDF; the PDF itself is not in the repo). Colour hex values are approximate until the user supplies exact ones (PRD OQ1).
- **Cross-cutting acceptance for every WEB story** (not repeated per story): responsive down to small screens (PRD NFR Responsiveness), light and dark themes, tokens and shared components only, content rules (FR-FND-6), WCAG 2.1 AA, role gating where the module has View/No access rules.
- `docs/SOLUTION_PROGRESS.html` is a generated progress dashboard rebuilt by the Product Owner or Team Lead every time this file changes — never edit it by hand.

---

## Epic Overview

| Epic | Title | Phase | PRD FR groups |
|---|---|---|---|
| E-2 | ShopDesk back office frontend | 1 | FR-FND, FR-SHELL, FR-AUTH, FR-DASH, FR-PROD, FR-GRN, FR-PO, FR-SUP, FR-EMP, FR-USR, FR-SVC, FR-SET |

Sequencing: F-2.1 first (everything depends on it); F-2.2 next (the product and batch data model is reused by stock-in); F-2.3 after F-2.2; F-2.4 and F-2.5 can follow F-2.1 and F-2.3 in either order (Suppliers payment uses GRN data from F-2.3; Reload threshold reads Settings, delivered in F-2.5, so use the mock settings default until then).

---

## E-2 — ShopDesk back office frontend (Phase 1)

**Goal:** A responsive, desktop-first back-office web app for a one-shop pharmacy, built from the ShopDesk design system, with all data mocked behind service interfaces, mock sign-in, per-module role permissions and a UI-only sync pill.

### F-2.1 Foundation (WEB)

- [ ] **S-2.1.1** [WEB] Design tokens (light and dark, DM Sans/Consolas, 4px spacing, radius, depth, states), theme switching and responsive base layout rules. — _Traces: FR-FND-1, FR-FND-2, FR-FND-5_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.2** [WEB] Icon set (all required names) plus Button, Badge, Card, StatCard, Avatar and Alert components. — _Traces: FR-FND-3, FR-FND-4, FR-FND-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.3** [WEB] DataTable (horizontal scroll or stacking on small screens), Pagination, Chips, Tabs, Field with 12-column responsive form grid, Toggle, Breadcrumb and progress bar. — _Traces: FR-FND-4, FR-FND-6_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.4** [WEB] Mock data layer: domain models and service interfaces with in-memory implementations (products and batches, GRNs, POs, suppliers, employees, users/roles, reload, settings, sync) seeded with the design's sample data. — _Traces: FR-PROD-3, FR-GRN-5, FR-USR-2, FR-SET-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.5** [WEB] AppShell with grouped sidebar (collapses on small screens), top bar, UI-only sync pill, theme switch, and nine lazy-loaded module routes. — _Traces: FR-SHELL-1, FR-SHELL-2, FR-SHELL-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.6** [WEB] Sign-in screen, mock session and auth guard with sign-out. — _Traces: FR-AUTH-1, FR-AUTH-2_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.1.7** [WEB] Role/permission gating: Full / View / No access applied to sidebar items, routes and action visibility, driven by the permission matrix. — _Traces: FR-AUTH-3, FR-AUTH-4_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.2 Dashboard and Products (WEB)

- [ ] **S-2.2.1** [WEB] Dashboard: heading and actions, four StatCards, 7/30-day sales bar chart, Needs attention list, Low stock table and Best sellers. — _Traces: FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-DASH-4, FR-DASH-5_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.2.2** [WEB] Product list with search, status chips with live counts, category filter, derived status (Out of stock / Low stock / Expiring soon / In stock), batch and expiry column, pagination. — _Traces: FR-PROD-1, FR-PROD-2, FR-PROD-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.2.3** [WEB] Add/Edit product form with validation, live Margin card, Status card, Save & add another, and breadcrumb. — _Traces: FR-PROD-4_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.3 Stock-in (WEB)

- [ ] **S-2.3.1** [WEB] GRN list with StatCards, search, status chips with live counts, date button and payment/status badges. — _Traces: FR-GRN-1_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.3.2** [WEB] New GRN form: delivery details, payment, items table, totals, auto-saved draft, and the under-six-months expiry warning. — _Traces: FR-GRN-2, FR-GRN-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.3.3** [WEB] GRN from PO prefill and receiving effects: Receive stock creates batches, updates stock and cost prices, and closes or part-closes the linked PO. — _Traces: FR-GRN-4, FR-GRN-5_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.3.4** [WEB] Purchase order list with status chips, overdue highlighting and row actions (Receive opens prefilled GRN). — _Traces: FR-PO-1_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.3.5** [WEB] New purchase order with supplier side card, items table, "Add all low-stock items", totals, Save draft / Print / Mark as sent. — _Traces: FR-PO-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.4 Suppliers and people (WEB)

- [ ] **S-2.4.1** [WEB] Suppliers list with detail panel, plus Record payment that settles GRNs oldest first. — _Traces: FR-SUP-1, FR-SUP-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.4.2** [WEB] Employees with StatCards, Staff / Attendance / Leave tabs, toolbar, table and Today's attendance card. — _Traces: FR-EMP-1_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.4.3** [WEB] Users and roles: users table, permission matrix, Add user panel, disable user keeping history. — _Traces: FR-USR-1, FR-USR-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.5 Services and settings (WEB)

- [ ] **S-2.5.1** [WEB] Reload & Utility: operator tiles, reload form with commission preview, float tracking with low-float warning, bill payment and Recent transactions. — _Traces: FR-SVC-1, FR-SVC-2, FR-SVC-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.5.2** [WEB] Settings with grouped sections, Save changes / Discard, and instant-apply Backup & sync toggles; values feed alert window, reorder level and float threshold. — _Traces: FR-SET-1, FR-SET-2, FR-SET-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

---

## Archived — HireFlow (replaced 2026-10-03)

The previous HireFlow job-application scope was replaced by ShopDesk. Listed here for history only (plain text, not tracked by the progress page):

- HireFlow E-1 F-1.1 Frontend job application form: S-1.1.1 to S-1.1.6 were completed.
- HireFlow E-1 F-1.2 standalone backend demo: S-1.2.1 was never started and is dropped.

---

## Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: E-1 HireFlow Job Application Screen. |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with E-2 ShopDesk back office frontend: 5 features, 20 stories (weights 3 to 5). Added mock data layer story S-2.1.4 and separated role gating S-2.1.7. HireFlow archived above. |
