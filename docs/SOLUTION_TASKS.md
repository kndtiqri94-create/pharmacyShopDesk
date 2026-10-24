# Solution Tasks (Backlog) — ShopDesk

> **Status:** Draft
> **Version:** v0.8
> **Last updated:** 2026-10-24
> **Owner:** Product Owner (agent: product-owner)
> **Source PRD:** `docs/SOLUTION_PRD.md` (v0.8)

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

POS sequencing (PRD 5.9): F-2.9 Phase A (after F-2.2 and F-2.3, S-2.9.2 data layer first, S-2.9.1 button can ship any time), then F-2.10 Phase B only after Phase A is accepted.

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

- [x] **S-2.7.1** [WEB] Mock leave model and service: leave types and per-employee yearly entitlements, balance (entitlement - utilized - pending), leave requests with Pending/Approved/Rejected/Cancelled, seeded with the screenshot's leave types; Employees "On leave" counts read from it. — _Traces: FR-LVE-2, FR-LVE-3, FR-EMP-1_ — _Weight: 3_ — _Design: docs/design/hr-reference/9.png_
- [x] **S-2.7.2** [WEB] Leave application page: Leave Year with period, Leave Type, From/To, Attachment (mock), Reason, Comments, Covering Employee search, Approver, Apply/Reset, validation (date order, overlap, balance, covering employee) and the Leave Balance table. — _Traces: FR-LVE-1, FR-LVE-2_ — _Weight: 5_ — _Design: docs/design/hr-reference/9.png_
- [x] **S-2.7.3** [WEB] Leave approval: approver or Admin approves/rejects pending leave with optional comment; balances and Pending Approval update; Leave tab lists requests. — _Traces: FR-LVE-3_ — _Weight: 3_ — _Design: docs/design/hr-reference/9.png_

### F-2.8 Payroll (WEB)

> Depends on F-2.6 and F-2.7. Daily Pay content, Nopay fields, Paid transition and statutory rates are open questions in the PRD (OQ12 to OQ19); build to the stated assumptions.

- [x] **S-2.8.1** [WEB] Payroll calculation service (mock): gross, over time, commission from stored rate, EPF/ETF flags, Payee Tax slabs, nopay, advances, net (not below zero), configurable placeholder rates in mock settings; unit-testable pure logic. — _Traces: FR-PAY-3, FR-EMP-4_ — _Weight: 8_ — _Design: docs/design/hr-reference/5.png_
- [x] **S-2.8.2** [WEB] Employees Salaries page: Monthly Pay / Daily Pay tabs, Keyword/Location/Year/Month filters with Filter and Reset, full payroll table with money formatting and N/A cells, Payment Status badge, page size and pagination, role gating (Manager view-only). — _Traces: FR-PAY-1, FR-PAY-6, FR-AUTH-5_ — _Weight: 5_ — _Design: docs/design/hr-reference/5.png_
- [x] **S-2.8.3** [WEB] Row action menu with Add Leave (quick one-day leave modal), Add Salary Advance (Counter, Date, Advance Amount with validation) and Add Nopay Amount modals; payroll row recalculates after each. — _Traces: FR-PAY-2, FR-PAY-4, FR-PAY-5, FR-LVE-4_ — _Weight: 5_ — _Design: docs/design/hr-reference/6.png, docs/design/hr-reference/7.png, docs/design/hr-reference/8.png_
- [x] **S-2.8.4** [WEB] Export CSV and Export PDF of filtered payroll rows (mock, in-browser). — _Traces: FR-PAY-7_ — _Weight: 3_ — _Design: docs/design/hr-reference/5.png_
- [x] **S-2.8.5** [WEB] Wire Employees, Leave and Payroll routes, tabs and permission matrix row so Admin is Full, Manager View, others No access (assumption, PRD FR-AUTH-5). — _Traces: FR-AUTH-5, FR-USR-2, FR-SHELL-3_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.9 POS till, Phase A (WEB)

> PRD 5.9 (FR-POS-1 to 12 and FR-POS-16) and FR-SET-4. No POS screenshots will be supplied (PRD OQ30 closed): the written requirements are the specification and the ShopDesk design system governs styling, so stories cite the design-system file only. Single pharmacy: no wholesale pricing, no Transfer, no inline add customer. Depends on F-2.2 (products and batches), F-2.1 (shell, permissions) and F-2.5 (Settings). Confirmed: A12 (all four roles have full POS access). Closed in v0.7: OQ25 (payment methods are exactly Cash, Card, Online, Credit), OQ27 (Phase B bottom bar hidden in Phase A), OQ32 (default discount with Admin-credentials popup). Still open: OQ33 (Manager approval, Admin popup, default and cap seeds, sidebar setting: build to assumption A20).

- [x] **S-2.9.1** [WEB] Header POS button: blue "POS" pill in the AppShell top bar, before the avatar, navigating to the POS route; active state on that route; hidden when the role has no POS access. — _Traces: FR-POS-1, FR-POS-12_ — _Weight: 2_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.2** [WEB] Mock sales data layer: sale, sale line, payment, held bill, customer (default Walk-in Customer) and rep models; sales service with FEFO stock deduction on save, hold/resume/discard, invoice numbering; Dashboard Today's sales/profit read from it. — _Traces: FR-POS-7, FR-POS-8, FR-POS-10, FR-POS-4_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.3** [WEB] POS route and layout: lazy-loaded; single fullscreen toggle button in the header beside dark-mode and refresh (browser Fullscreen API; maximise icon when not fullscreen, minimise icon when fullscreen; icon follows real fullscreen state incl. Esc/F11; accessible name states the action; hidden if unsupported; never auto-enters fullscreen, only on user click); sidebar hidden on open per Settings "Hide sidebar when POS opens" (S-2.9.10), openable via the shell menu control; Back to back office; header with date/time, dark-mode toggle and refresh (with unsaved-bill confirm); responsive reflow and 52px touch targets. — _Traces: FR-POS-2, FR-POS-11, FR-FND-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.4** [WEB] Bill header: Create New Bill, Hold Bill, bill date, Invoice type (no Transfer, no Retail/Wholesale), generated invoice number, customer select from mock list (default Walk-in Customer, no inline add) and optional rep select. — _Traces: FR-POS-3, FR-POS-4_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.5** [WEB] Product search (name, generic name, SKU, barcode, Enter-to-add) and line-items table (S/N, SKU, Rep, Barcode, Sale Price, Discount %, QTY, Action, Total; no Warranty/V.code/UOM/Code), editable qty and discount % (discount pre-filled from the Settings default, never above the maximum cap, any change from the default needs Admin credentials, S-2.9.11), remove action, stock limit and out-of-stock/expired blocking messages. — _Traces: FR-POS-5, FR-POS-6, FR-POS-16_ — _Weight: 8_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.6** [WEB] Totals panel: No. of Items, Sub Total, Discount (Rs.) and (%) linked, Total, Paid, Balance, live recalculation, discount cap, and bill discount fields gated by Settings (on/off, default %, maximum %; changes from the default need Admin credentials via S-2.9.11). — _Traces: FR-POS-7, FR-SET-4, FR-POS-16_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.7** [WEB] Payment panel: exactly four methods, Cash (F3), Card (F4), Online (F7) and Credit (no "More" dropdown); Cash Received with change, split payments across methods, optional card/online reference, Credit needs a named customer from the mock list and is blocked for Walk-in with a message (A16), Paid = Cash+Card+Online, Balance shown as Change or Credit due (FR-POS-8a), plus on-screen keypad (0-9, decimal, Backspace) writing into the active method's amount field. — _Traces: FR-POS-8, FR-POS-8a, FR-POS-9_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.8** [WEB] Bill actions and shortcuts: Save & Print (F1, browser receipt view), Save (F2), Hold (F10), New (F12), held-bills list with resume/discard, validation and stock-shortfall-at-save error, F-key handling scoped to the POS screen with visible hints. — _Traces: FR-POS-10, FR-POS-11_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.9** [WEB] POS access: add POS row to the permission matrix (Admin, Manager, Cashier, Pharmacist all Full; A12 confirmed by the user), route guard and blocked message, discount approval is by Admin credentials for every role (S-2.9.11). — _Traces: FR-POS-12, FR-AUTH-4, FR-USR-2_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.10** [WEB] Settings "Point of sale" section: line discount on/off, bill discount on/off, default discount % (pre-filled on new lines and the bill; validated not above the maximum; placeholder seed 0% per OQ33), maximum discount % (cap for everyone including Admin; placeholder seed 20% per OQ33; the per-role "approval above" levels are removed), and "Hide sidebar when POS opens" on/off (default on); saved with Save changes / Discard; read by the POS screen through the mock settings service. — _Traces: FR-SET-4, FR-SET-2, FR-POS-2, FR-POS-6, FR-POS-7, FR-POS-16_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [x] **S-2.9.11** [WEB] Discount approval popup: when any user changes a line or bill discount % to a value different from the Settings default, open an accessible modal asking for an Admin username and password (checked against the mock Users data; account must be an active Admin, a Manager or other role is rejected with a message, A20); success applies the discount and stores approver name and time on the mock sale; wrong credentials, non-Admin account or Cancel reverts the discount to the default with a message; password never stored or shown; changing back to the default needs no approval; changes above the maximum cap are blocked before the popup; keyboard operable, 52px controls. — _Traces: FR-POS-16, FR-POS-6, FR-POS-7, FR-SET-4_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.10 POS extras, Phase B (WEB)

> PRD 5.9 [B] items (FR-POS-13 to 15). Start only after F-2.9 is accepted. The Phase B bottom-bar buttons stay hidden in Phase A (OQ27 closed v0.7), so Phase A needs no placeholder or disabled buttons (OQ28 closed: no Transfer; OQ29 closed: Reload & Utility sales are handled separately and excluded from the POS cash book and counter close). Not in the first release.

- [ ] **S-2.10.1** [WEB] Returns: Return bill type with invoice-number and return-bill lookup, line selection, FEFO restock, refund or credit record. — _Traces: FR-POS-3, FR-POS-14_ — _Weight: 8_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.10.2** [WEB] Quotations: Save Quotation (F11), Quotations list, convert to invoice; no stock effect until converted. — _Traces: FR-POS-14, FR-POS-13_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.10.3** [WEB] Last Invoice button (re-open/reprint the last sale). Transfer bill type and the "Normal" view button are dropped (single pharmacy). — _Traces: FR-POS-13_ — _Weight: 2_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.10.4** [WEB] Cash Book, Add OB (opening balance) and Drawer (End); covers POS sales only, Reload & Utility sales are handled separately and excluded (OQ29 closed). — _Traces: FR-POS-13, FR-POS-15_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.10.5** [WEB] Counter Close: expected vs counted cash, difference, locked counter report; expected cash counts POS sales only, Reload & Utility sales excluded (OQ29 closed). — _Traces: FR-POS-15_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.10.6** [WEB] Due Amount (customers with unpaid balances, take payment), Update Products quick edit and Bill & Reload jump link (no inline add customer, OQ24 closed). — _Traces: FR-POS-13, FR-POS-15_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_

### F-2.11 POS visual restyle (WEB)

> PRD 5.9.2 (FR-POS-17 to 19). Style and presentation only, billing screen only (`frontend-app/src/app/features/modules/pos/`); inspired by a reference POS screenshot as a style guide, not a pixel or feature copy. Indigo primary and primary buttons are unchanged. No other behaviour or data changes. Depends on F-2.9 (done). Narrow exception to the "status colours are never decoration" rule in `docs/design/CLAUDE.md` for billing-screen secondary buttons only (PRD A21; the note in `docs/design/CLAUDE.md` is pending, see OQ34). Contrast must still pass in both themes (text 4.5:1, borders 3:1, `frontend-app/scripts/check-contrast.mjs`). Open: OQ34 (design-rule note, row size), OQ35 (cost price visibility in the details popup).

- [ ] **S-2.11.1** [WEB] Billing screen surfaces and soft colour-coded secondary buttons, light and dark: muted grey page background and a slightly darker panel around the line items (token based, both themes); secondary buttons on this screen only (e.g. Hold amber, Save green) become soft tinted, colour-coded buttons with tokenised light and dark tints; primary buttons and the indigo palette unchanged; labels and icons still carry meaning (never colour alone); contrast checks extended and passing. — _Traces: FR-POS-17, FR-FND-7_ — _Weight: 5_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.11.2** [WEB] Line-item details popup: selecting a line item opens an accessible dialog (focus trapped, Esc and Close, keyboard operable) showing only the item details the app already holds for that product (no new fields, no data changes); cost price shown only where existing role rules already allow it (OQ35); selecting does not change the line, qty or discount. — _Traces: FR-POS-18, FR-AUTH-4_ — _Weight: 3_ — _Design: docs/design/ShopDesk-design-system.md_
- [ ] **S-2.11.3** [WEB] Taller line-item rows with a bigger box: row height raised to the closest design-system size to the reference (proposed lg 46px or 52px, confirmed at the plan gate) while keeping the compact table feel, 52px touch targets, horizontal scroll on small screens and all existing columns and behaviour. — _Traces: FR-POS-19, FR-FND-7_ — _Weight: 2_ — _Design: docs/design/ShopDesk-design-system.md_

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
| v0.8 | 2026-10-24 | Shiham (PO) | Added F-2.11 POS visual restyle (S-2.11.1 to 3, weights 5, 3, 2): soft colour-coded secondary buttons plus grey surfaces in both themes, line-item details popup, taller line-item rows. PRD v0.8 (FR-POS-17 to 19, A21, OQ34, OQ35). |
| v0.7 | 2026-10-22 | Shiham (PO) | S-2.9.11 rewritten as a default-discount Admin-credentials popup (weight stays 5); S-2.9.10 swaps per-role approval levels for a default discount % plus the maximum cap; S-2.9.5, S-2.9.6, S-2.9.9 wording aligned; S-2.9.7 now exactly Cash, Card, Online, Credit (no More; traces add FR-POS-8a); F-2.9 and F-2.10 notes close OQ25, OQ27, OQ32 and open OQ33. PRD v0.7. |
| v0.6 | 2026-10-22 | Shiham (PO) | S-2.9.3 now a single browser-fullscreen toggle (maximise/minimise icon, no auto-fullscreen); S-2.9.10 adds per-role "approval above" levels and renames the setting to "Hide sidebar when POS opens"; new S-2.9.11 Discount approval (weight 5); S-2.9.5, S-2.9.6 trace FR-POS-16; S-2.9.9 A12 confirmed; S-2.10.4 and S-2.10.5 exclude Reload & Utility (OQ29 closed). PRD v0.6. |
| v0.5 | 2026-10-22 | Shiham (PO) | POS answers: removed Retail/Wholesale, Transfer, inline add customer, extra table columns and all pos-reference design references (stories now cite the design system); S-2.9.3 now a single maximise/minimise toggle; added S-2.9.10 Settings "Point of sale" (discounts, open maximised); S-2.10.3 reduced to Last Invoice (weight 3 to 2). PRD v0.5. |
| v0.4 | 2026-10-21 | Shiham (PO) | Added F-2.9 POS till Phase A (S-2.9.1 to 9) and F-2.10 POS extras Phase B (S-2.10.1 to 6) from the POS request; PRD v0.4 section 5.9. |
| v0.3 | 2026-10-17 | Shiham (PO) | Added F-2.6 Employee master (S-2.6.1 to 5), F-2.7 Leave management (S-2.7.1 to 3), F-2.8 Payroll (S-2.8.1 to 5) from the HR screenshots; PRD v0.3 section 5.8. |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with E-2 ShopDesk back office frontend: 5 features, 20 stories (weights 3 to 5). Added mock data layer story S-2.1.4 and separated role gating S-2.1.7. HireFlow archived above. |
