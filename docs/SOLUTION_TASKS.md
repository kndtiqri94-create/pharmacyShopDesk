# Solution Tasks (Backlog) — ShopDesk

> **Status:** Draft
> **Version:** v0.3
> **Last updated:** 2026-10-17
> **Owner:** Product Owner (agent: product-owner)
> **Source PRD:** `docs/SOLUTION_PRD.md` (v0.3)

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
| E-2 | ShopDesk back office frontend | 1 | FR-FND, FR-SHELL, FR-AUTH, FR-DASH, FR-PROD, FR-GRN, FR-PO, FR-SUP, FR-EMP, FR-USR, FR-SVC, FR-SET, plus HR amendment FR-EMP-2 to 5, FR-LVE, FR-PAY, FR-AUTH-5 (F-2.6 to F-2.8) |

HR amendment sequencing: F-2.6 Employee master, then F-2.7 Leave management, then F-2.8 Payroll (payroll reads employees and leave).

Sequencing: F-2.1 first (everything depends on it); F-2.2 next (the product and batch data model is reused by stock-in); F-2.3 after F-2.2; F-2.4 and F-2.5 can follow F-2.1 and F-2.3 in either order (Suppliers payment uses GRN data from F-2.3; Reload threshold reads Settings, delivered in F-2.5, so use the mock settings default until then).

---

## E-2 — ShopDesk back office frontend (Phase 1)

**Goal:** A responsive, desktop-first back-office web app for a one-shop pharmacy, built from the ShopDesk design system, with all data mocked behind service interfaces, mock sign-in, per-module role permissions and a UI-only sync pill.

### F-2.1 Foundation (WEB)

- [x] **S-2.1.1** [WEB] Design tokens (light and dark, DM Sans/Consolas, 4px spacing, radius, depth, states), theme switching and responsive base layout rules. — _Traces: FR-FND-1, FR-FND-2, FR-FND-5_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.2** [WEB] Icon set (all required names) plus Button, Badge, Card, StatCard, Avatar and Alert components. — _Traces: FR-FND-3, FR-FND-4, FR-FND-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.3** [WEB] DataTable (horizontal scroll or stacking on small screens), Pagination, Chips, Tabs, Field with 12-column responsive form grid, Toggle, Breadcrumb and progress bar. — _Traces: FR-FND-4, FR-FND-6_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.4** [WEB] Mock data layer: domain models and service interfaces with in-memory implementations (products and batches, GRNs, POs, suppliers, employees, users/roles, reload, settings, sync) seeded with the design's sample data. — _Traces: FR-PROD-3, FR-GRN-5, FR-USR-2, FR-SET-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.5** [WEB] AppShell with grouped sidebar (collapses on small screens), top bar, UI-only sync pill, theme switch, and nine lazy-loaded module routes. — _Traces: FR-SHELL-1, FR-SHELL-2, FR-SHELL-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.6** [WEB] Sign-in screen, mock session and auth guard with sign-out. — _Traces: FR-AUTH-1, FR-AUTH-2_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.1.7** [WEB] Role/permission gating: Full / View / No access applied to sidebar items, routes and action visibility, driven by the permission matrix. — _Traces: FR-AUTH-3, FR-AUTH-4_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.2 Dashboard and Products (WEB)

- [x] **S-2.2.1** [WEB] Dashboard: heading and actions, four StatCards, 7/30-day sales bar chart, Needs attention list, Low stock table and Best sellers. — _Traces: FR-DASH-1, FR-DASH-2, FR-DASH-3, FR-DASH-4, FR-DASH-5_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.2.2** [WEB] Product list with search, status chips with live counts, category filter, derived status (Out of stock / Low stock / Expiring soon / In stock), batch and expiry column (blank for a new batch-tracked product until a GRN), single-status precedence, inactive products stay listed, cost and margin visible to Cashiers, view/edit row actions open the form (read-only for View access), pagination. — _Traces: FR-PROD-1, FR-PROD-2, FR-PROD-3, FR-PROD-6, FR-PROD-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.2.3** [WEB] Add/Edit product form with validation, live Margin card, Status card, Save & add another, breadcrumb, duplicate SKU rejected on save, and read-only mode for View access. — _Traces: FR-PROD-4, FR-PROD-5, FR-PROD-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.3 Stock-in (WEB)

- [x] **S-2.3.1** [WEB] GRN list with StatCards, search, status chips with live counts, date button and payment/status badges. — _Traces: FR-GRN-1_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.3.2** [WEB] New GRN form: delivery details, payment, items table, totals, auto-saved draft, and the under-six-months expiry warning. — _Traces: FR-GRN-2, FR-GRN-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.3.3** [WEB] GRN from PO prefill and receiving effects: Receive stock creates batches, updates stock and cost prices, and closes or part-closes the linked PO. — _Traces: FR-GRN-4, FR-GRN-5_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.3.4** [WEB] Purchase order list with status chips, overdue highlighting and row actions (Receive opens prefilled GRN). — _Traces: FR-PO-1_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.3.5** [WEB] New purchase order with supplier side card, items table, "Add all low-stock items", totals, Save draft / Print / Mark as sent. — _Traces: FR-PO-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.4 Suppliers and people (WEB)

- [x] **S-2.4.1** [WEB] Suppliers list with detail panel, plus Record payment that settles GRNs oldest first. — _Traces: FR-SUP-1, FR-SUP-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.4.2** [WEB] Employees with StatCards, Staff / Attendance / Leave tabs, toolbar, table and Today's attendance card. — _Traces: FR-EMP-1_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.4.3** [WEB] Users and roles: users table, permission matrix, Add user panel, disable user keeping history. — _Traces: FR-USR-1, FR-USR-2_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.5 Services and settings (WEB)

- [x] **S-2.5.1** [WEB] Reload & Utility: operator tiles, reload form with commission preview, float tracking with low-float warning, bill payment and Recent transactions. — _Traces: FR-SVC-1, FR-SVC-2, FR-SVC-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.5.2** [WEB] Settings with grouped sections, Save changes / Discard, and instant-apply Backup & sync toggles; values feed alert window, reorder level and float threshold. — _Traces: FR-SET-1, FR-SET-2, FR-SET-3_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.6 Employee master (WEB)

> HR amendment (PRD 5.8). Reference screenshots are layout/field references only; ShopDesk design system governs styling. The screenshot copies named below must be placed in `docs/design/hr-reference/` (originals are in the session temp folder `C:\Users\knd\AppData\Local\Temp\claude\d--Pharmacy-pharmacyShopDesk\8d1e2a27-8f64-491b-9b13-4e0ce26cccfe\images\`). Access defaults (PRD FR-AUTH-5) are an assumption awaiting user confirmation. Commission, discount, target and Consider-as-Customer are stored fields only.

- [x] **S-2.6.1** [WEB] Extend the mock employee model and service (EMP code, title, names, DOB, location, address, EPF/ETF flags, salary type, rates, target, customer flag, create-user flag, custom fields 1-4, status, image, basic salary, allowances) and seed data; unique EMP code. — _Traces: FR-EMP-3, FR-EMP-4_ — _Weight: 3_ — _Design: docs/design/hr-reference/2.png_
- [x] **S-2.6.2** [WEB] Employee list (replaces the Staff table): Keyword/Location/Created at/Status filters with Filter and Reset, table with image, code, name, address, mobile, email, DOB, location, status, edit/delete row actions, page size and "Showing a to b of N entries" pagination; delete asks to confirm and deactivates when history exists. — _Traces: FR-EMP-2, FR-EMP-1_ — _Weight: 5_ — _Design: docs/design/hr-reference/1.png_
- [x] **S-2.6.3** [WEB] Create/Edit employee form: Basic details, Address and More Information groups with validation (required names and mobile, unique EMP code), Save/Cancel, optional Create user account flag that points to Users, view-only mode for View access. — _Traces: FR-EMP-3, FR-EMP-4_ — _Weight: 5_ — _Design: docs/design/hr-reference/2.png, docs/design/hr-reference/3.png_
- [x] **S-2.6.4** [WEB] Employee Salaries and Allowances sections (basic salary, add/edit/remove allowance lines) hidden or read-only per role, and employee image upload with preview and type/size validation (in memory). — _Traces: FR-EMP-3, FR-EMP-5, FR-AUTH-5_ — _Weight: 3_ — _Design: docs/design/hr-reference/3.png, docs/design/hr-reference/4.png_
- [x] **S-2.6.5** [WEB] Export CSV and Export PDF of the filtered employee list (mock, in-browser; see OQ10). — _Traces: FR-EMP-5_ — _Weight: 3_ — _Design: docs/design/hr-reference/1.png_

### F-2.7 Leave management (WEB)

- [ ] **S-2.7.1** [WEB] Mock leave model and service: leave types and per-employee yearly entitlements, balance (entitlement - utilized - pending), leave requests with Pending/Approved/Rejected/Cancelled, seeded with the screenshot's leave types; Employees "On leave" counts read from it. — _Traces: FR-LVE-2, FR-LVE-3, FR-EMP-1_ — _Weight: 3_ — _Design: docs/design/hr-reference/9.png_
- [ ] **S-2.7.2** [WEB] Leave application page: Leave Year with period, Leave Type, From/To, Attachment (mock), Reason, Comments, Covering Employee search, Approver, Apply/Reset, validation (date order, overlap, balance, covering employee) and the Leave Balance table. — _Traces: FR-LVE-1, FR-LVE-2_ — _Weight: 5_ — _Design: docs/design/hr-reference/9.png_
- [ ] **S-2.7.3** [WEB] Leave approval: approver or Admin approves/rejects pending leave with optional comment; balances and Pending Approval update; Leave tab lists requests. — _Traces: FR-LVE-3_ — _Weight: 3_ — _Design: docs/design/hr-reference/9.png_

### F-2.8 Payroll (WEB)

> Depends on F-2.6 and F-2.7. Daily Pay content, Nopay fields, Paid transition and statutory rates are open questions in the PRD (OQ12 to OQ19); build to the stated assumptions.

- [ ] **S-2.8.1** [WEB] Payroll calculation service (mock): gross, over time, commission from stored rate, EPF/ETF flags, Payee Tax slabs, nopay, advances, net (not below zero), configurable placeholder rates in mock settings; unit-testable pure logic. — _Traces: FR-PAY-3, FR-EMP-4_ — _Weight: 8_ — _Design: docs/design/hr-reference/5.png_
- [ ] **S-2.8.2** [WEB] Employees Salaries page: Monthly Pay / Daily Pay tabs, Keyword/Location/Year/Month filters with Filter and Reset, full payroll table with money formatting and N/A cells, Payment Status badge, page size and pagination, role gating (Manager view-only). — _Traces: FR-PAY-1, FR-PAY-6, FR-AUTH-5_ — _Weight: 5_ — _Design: docs/design/hr-reference/5.png_
- [ ] **S-2.8.3** [WEB] Row action menu with Add Leave (quick one-day leave modal), Add Salary Advance (Counter, Date, Advance Amount with validation) and Add Nopay Amount modals; payroll row recalculates after each. — _Traces: FR-PAY-2, FR-PAY-4, FR-PAY-5, FR-LVE-4_ — _Weight: 5_ — _Design: docs/design/hr-reference/6.png, docs/design/hr-reference/7.png, docs/design/hr-reference/8.png_
- [ ] **S-2.8.4** [WEB] Export CSV and Export PDF of filtered payroll rows (mock, in-browser). — _Traces: FR-PAY-7_ — _Weight: 3_ — _Design: docs/design/hr-reference/5.png_
- [ ] **S-2.8.5** [WEB] Wire Employees, Leave and Payroll routes, tabs and permission matrix row so Admin is Full, Manager View, others No access (assumption, PRD FR-AUTH-5). — _Traces: FR-AUTH-5, FR-USR-2, FR-SHELL-3_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_

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
| v0.3 | 2026-10-17 | Shiham (PO) | Added F-2.6 Employee master (S-2.6.1 to 5), F-2.7 Leave management (S-2.7.1 to 3), F-2.8 Payroll (S-2.8.1 to 5) from the HR screenshots; PRD v0.3 section 5.8. |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with E-2 ShopDesk back office frontend: 5 features, 20 stories (weights 3 to 5). Added mock data layer story S-2.1.4 and separated role gating S-2.1.7. HireFlow archived above. |
