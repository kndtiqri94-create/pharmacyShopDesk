# Product Requirements Document — ShopDesk

> **Status:** Draft
> **Version:** v0.2
> **Last updated:** 2026-10-03
> **Owner:** Product Owner (agent: product-owner)

## 1. Vision
ShopDesk is "the quiet back office for a one-shop business": the back office of a one-shop pharmacy POS app. It serves a single branch with a handful of staff and must keep working offline. It covers nine modules: Dashboard, Products, GRN, Purchase orders, Suppliers, Employees, Reload & Utility, Users and Settings.

This phase delivers the **frontend only**: a working, responsive back-office web app that follows the ShopDesk design system faithfully (13 finished screens plus a sign-in screen, shared components, light and dark themes). All data is mock or in-memory behind service interfaces, so a real API can replace it later without changing screens.

## 2. Goals & Non-Goals
### 2.1 Goals
- G1 Deliver all 14 screens (sign-in plus 13) with routing, matching the design system and content rules.
- G2 Deliver the shared component library and design tokens (light and dark theme) so every screen uses tokens and shared components only.
- G3 Model the pharmacy domain rules in the UI: batches with expiry and FEFO, derived stock status, GRN-changes-stock, PO-only-records-request.
- G4 Enforce roles and per-module permissions (Full / View / No access) on navigation and routes, using a mock sign-in and session.
- G5 Be responsive from desktop down to small screens (see NFR) even though only desktop mockups exist.
- G6 Isolate all data access behind service interfaces backed by mock or in-memory data, ready to swap for a real API.

### 2.2 Non-Goals (explicit)
- NG1 Backend, real API, real authentication, or persistence beyond the session/in-memory mock (a backend is a later phase).
- NG2 The POS till/sales screen itself (only the back office is in scope).
- NG3 Real offline sync, queueing, or conflict handling. The sync pill is a UI-only state indicator for now.
- NG4 Multi-branch features. There is no branch selector anywhere.
- NG5 Real printing, CSV import/export file generation, report generation, SMS/reload gateways, or payment integrations (see Open Questions OQ4).
- NG6 Dedicated mobile mockups or a native/PWA mobile app. Responsiveness is delivered by reflowing the desktop design.
- NG7 Localization beyond English copy (see Constraints for the i18n standard).

## 3. Primary Users / Personas
- **Owner / Admin (Nimal Perera, initials NP)** — runs the shop; sees everything, receives stock, pays suppliers, manages users and settings.
- **Manager** — full on operational modules (Dashboard, Products, GRN, PO, Suppliers, Reload); view-only Employees; no Users/Settings.
- **Pharmacist** — manages Products and GRN; view-only on Dashboard, PO, Suppliers and Reload; no Employees/Users/Settings.
- **Cashier** — sells reloads and takes bill payments; view-only Products; nothing else.
- Behaviour differs by role through the permission matrix in FR-AUTH-3. Roles are Admin, Manager, Pharmacist, Cashier; the sample signed-in user is labelled "Owner" in the design (see OQ2).

## 4. Key Use Cases
- UC1 — Receive a delivery: a user creates a GRN (optionally prefilled from a PO), enters batches and expiry, sees an expiry warning where needed, and receives stock. Stock, cost prices and the linked PO update.
- UC2 — Reorder: a user sees low-stock items on the Dashboard, creates a PO using "Add all low-stock items", and marks it as sent.
- UC3 — Know what needs attention: the owner opens the Dashboard to see sales, low stock, expiring batches, overdue POs and float status.
- UC4 — Pay a supplier: the owner opens a supplier, sees the outstanding amount and records a payment that settles GRNs oldest first.
- UC5 — Control access: an admin creates a user for an employee, assigns a role, and reviews the permission matrix. Users only see and reach modules their role allows.
- UC6 — Work on any screen size and in the dark: the user opens the app on a laptop, tablet or narrow window, in light or dark theme, and everything remains usable.

## 5. Functional Requirements
> Each requirement has a stable id `FR-<area>-<N>`. Screen detail comes from `docs/design/ShopDesk-design-system.md` (hand transcription of the user's PDF; the PDF is not in the repo).

### 5.1 Design foundation (FR-FND)
- **FR-FND-1** Define all design tokens (colour, type, spacing on a 4px grid, radius, depth, states) as CSS custom properties with a light theme and a dark theme override. Components use tokens only, never raw hex. Typeface DM Sans (fallback Segoe UI), Consolas for codes, tabular numerals where numbers stack.
- **FR-FND-2** The sidebar is always dark in both themes. All text pairs meet 4.5:1 and control borders/focus ring 3:1 in both themes. No gradients, glass, or tinted left-border cards.
- **FR-FND-3** Provide the Icon component (own line-icon set, 24px grid, 1.75px stroke, round caps/joins, currentColor; sizes 16/18/22) with all names listed in the design system. Icon-only use is allowed only for row actions, and then needs an aria-label.
- **FR-FND-4** Provide shared components: Button (default/primary/soft/danger-outline/ghost; sm/md/lg; icon; block; disabled), Badge (tones, dot plus word, `plain`), Card (header, body, footer, `flush`), StatCard, DataTable, Field (prefix/suffix/hint/error/required, 12-column form grid), Tabs (max 5), Toggle, Chips (with live counts), Pagination, Breadcrumb, Avatar (initials), progress bar, Alert (info/warning/success), on-screen keyboard button.
- **FR-FND-5** Interaction states: hover on rows/outline buttons = surface-sunken; hover on primary = primary-hover; focus = 2px primary ring with 2px offset (white on the sidebar); disabled = 55% opacity, no pointer response. No motion by default.
- **FR-FND-6** Content rules apply everywhere: plain shopkeeper language ("you"), verb-led sentence-case buttons (never "Submit"/"OK"), noun page headings with a one-sentence subtitle, number/date formats (`Rs. 84,250`, `21 Sep 2026`, expiry `Mar 2027`, inputs `03/2028`), money columns headed `(Rs.)` with two decimals and right-aligned, status always a word, empty states say what to do next, errors say what to fix, no emoji or exclamation marks.
- **FR-FND-7** Touch sizing: till/reload screens and the login button use the `lg` control (46px); keypad and operator tiles are at least 52px tall.

### 5.2 App shell, sign-in and access (FR-SHELL, FR-AUTH)
- **FR-SHELL-1** AppShell: dark 232px sidebar at 1280px and wider with the nine modules in groups (OVERVIEW: Dashboard; INVENTORY: Products with count badge, GRN with badge, Purchase orders, Suppliers; PEOPLE: Employees, Users; SERVICES: Reload & Utility; SYSTEM: Settings), brand block ("S" tile, "ShopDesk", "Main Shop"), footer text "ShopDesk 1.0 · Offline ready". Top bar: short page title, search ("Search products, GRN, suppliers…" with a Ctrl K hint), sync pill, bell, avatar with name and role. No second nav row, no footer, no branch selector.
- **FR-SHELL-2** Sync pill is on every screen and always shows its state (online / syncing / offline, with the count of pending changes when offline). It is UI-only in this phase, driven by a mock service, and never blocks a screen.
- **FR-SHELL-3** One lazy-loaded route per module; the sidebar lists exactly the nine modules.
- **FR-AUTH-1** Sign-in screen: one card on the dark navy ground per the design (brand block, "Welcome back", username/email, password with show/hide, "Forgot password?" link, "Keep me signed in on this device", full-width primary lg "Log in", outline "Show on-screen keyboard", footer "Works offline · last synced today 09:12"). A wrong password shows an error under the password field.
- **FR-AUTH-2** Mock session: sign-in validates against mock users behind an auth service interface and stores a mock session; an auth guard redirects unauthenticated users to sign-in; a sign-out action ends the session. No real credentials or tokens are involved.
- **FR-AUTH-3** Role permissions per module, Full / View / No access:
  - Admin: Full everywhere.
  - Manager: Full on Dashboard, Products, GRN, Purchase orders, Suppliers, Reload & Utility; View Employees; No access Users, Settings.
  - Pharmacist: View Dashboard; Full Products; Full GRN; View Purchase orders; View Suppliers; No access Employees; View Reload & Utility; No access Users, Settings.
  - Cashier: No access Dashboard; View Products; No access GRN, Purchase orders, Suppliers, Employees; Full Reload & Utility; No access Users, Settings.
- **FR-AUTH-4** Navigation items for "No access" modules are hidden, and direct navigation to them is blocked by a route guard with a clear message. In "View" modules, create/edit/destructive actions are hidden or disabled.

### 5.3 Dashboard (FR-DASH)
- **FR-DASH-1** Heading "Good morning, <first name>" with the date and "Main Shop"; actions Daily report (outline) and New GRN (primary).
- **FR-DASH-2** Four StatCards: Today's sales, Today's profit, Low stock (count below reorder level, with out-of-stock note), Expiring soon (batches within 60 days). Low stock and expiring counts are derived from the mock product data.
- **FR-DASH-3** "Sales, last 7 days" single-series bar chart with a 7 days / 30 days chip toggle; today's bar is darker; only the peak and today carry value labels.
- **FR-DASH-4** "Needs attention" list, one action button per row (Reorder low-stock items -> Create PO; expiring batches -> Review; overdue POs -> Open; float low -> Top up), each navigating to the relevant screen.
- **FR-DASH-5** "Low stock" table with a View all button, and a "Best sellers this week" list with horizontal bars.

### 5.4 Products (FR-PROD)
- **FR-PROD-1** Product list: title/subtitle with live counts, actions Import CSV, Export, Add product (primary). Card toolbar with search (name, generic name, SKU or barcode), chips All / In stock / Low stock / Out of stock / Expiring soon with live counts, and a category filter. Table columns per design (checkbox, product two-line cell, SKU mono, batch and expiry, stock with min, cost, price, status badge, row actions). Footer "Showing a–b of N products" and pagination.
- **FR-PROD-2** Stock status is derived, never typed: Out of stock at 0; Low stock at or below reorder level; Expiring soon when the nearest batch expires within the alert window (60 days default, from Settings); otherwise In stock. A product matching more than one condition shows ONE status, by precedence: Out of stock, then Low stock, then Expiring soon, then In stock (e.g. low stock and expiring soon shows Low stock).
- **FR-PROD-3** Mock batch model: each product with batch tracking on holds batches (batch no, expiry, quantity); FEFO orders them earliest-expiring first; a product may turn batch tracking off. A new batch-tracked product with opening stock above 0 shows no batch or expiry until a GRN records one.
- **FR-PROD-4** Add/Edit product: breadcrumb, header actions (Cancel, Save product), form card with four groups (Basic details, Pricing, Stock rules) per design, footer bar (Cancel, Save & add another, Save product), and a 320px right column with a live Margin card, a Status card (toggles and note) and an info Tip. Required fields (Product name, Category, Selling price) validate with errors that say what to fix. Barcode field offers a scan icon button (mock/no hardware).
- **FR-PROD-5** A duplicate SKU is rejected on save with an error saying the SKU is already in use. An inactive product stays in the Products list (it is not hidden or removed).
- **FR-PROD-6** Cashiers can see cost and margin on the Products list (confirmed as stated). Open Question: whether cost should be hidden from Cashiers is a possible follow-up decision for the stakeholder; no change made.
- **FR-PROD-7** The design has no product details view, so both "view" and "edit" row actions open the Add/Edit form; for users with View-only access the form opens read-only (fields disabled, no Save actions).

### 5.5 Stock-in: GRN and Purchase orders (FR-GRN, FR-PO)
- **FR-GRN-1** GRN list: StatCards (Received this month, Waiting to be received, Unpaid to suppliers), toolbar (search, chips All/Draft/Received/Cancelled with counts, "This month" date button) and the table per design with payment and status badges.
- **FR-GRN-2** New GRN form: Delivery details (Supplier*, Purchase order, Received date, Supplier invoice no*, Invoice date, Received by), Payment card (Method, Paid now, Due date), Items received table (Product, Batch no, Expiry MM/YYYY, Received, Free, Cost, Price, Total, delete), Scan item and Add item, Totals block (lines/units, Discount, Total, Balance due after payment). Save draft and Receive stock (primary). Draft is saved automatically (in memory).
- **FR-GRN-3** Expiry under six months on a line shows a danger-bordered input and a warning alert naming the product and month ("... Check with the supplier before accepting."). An info alert explains that receiving adds batches and updates cost prices.
- **FR-GRN-4** Choosing a PO prefills supplier and lines from it. A GRN may also exist without a PO.
- **FR-GRN-5** Receiving a GRN (mock) creates batches and increases product stock, updates product cost prices, and closes or part-closes the linked PO (status becomes Received or Part received). Only a GRN changes stock.
- **FR-PO-1** PO list: toolbar (search, chips All/Draft/Sent/Part received/Received/Cancelled with counts, "Last 30 days" date button) and table per design. Overdue expected dates show in danger colour as "20 Sep · overdue". Row actions: soft "Receive" on Sent and Part received POs (opens a New GRN prefilled from that PO), edit on Draft, view otherwise.
- **FR-PO-2** New purchase order: Order details, supplier side card (since, phone, payment terms, usual delivery, amount you owe), Items to order table (In stock, Reorder at, Order qty, Unit cost, Total), Add item, and "Add all low-stock items" that fills lines from products below reorder level. Totals (Sub-total, Delivery, Total). Actions Save draft, Print, Mark as sent (primary). A PO only records the request and never changes stock.

### 5.6 Suppliers and people (FR-SUP, FR-EMP, FR-USR)
- **FR-SUP-1** Suppliers list card (search, chips All/Owing/Inactive; table Supplier, Owing, Last order, Status) with a right-hand detail panel for the selected supplier (summary, outstanding amount, contact, terms, recent activity, Edit and New PO buttons). Inactive suppliers stay for history and are hidden from pickers.
- **FR-SUP-2** Record payment: settles that supplier's GRNs oldest first (mock), reducing Outstanding and updating payment status (Paid / Part paid / Unpaid) on the affected GRNs.
- **FR-EMP-1** Employees: StatCards (Total staff, On shift today, On leave, Can log in), Tabs Staff / Attendance / Leave, toolbar (search, chips All/Active/On leave), staff table (avatar, role, phone, shift, system login, status), and a "Today's attendance" card with a Mark attendance button.
- **FR-USR-1** Users & roles: Users card (user, role badge, last sign-in, status, edit and lock actions), Role permissions matrix (modules x roles with Full/View/No access badges, matching FR-AUTH-3) with an Edit roles button, and an Add user panel (Employee*, Username or email*, Role*, Temporary password*, Quick PIN, "Change password at first sign-in", Cancel, Create user). A user links to at most one employee. Disabling a user keeps their history.
- **FR-USR-2** The permission matrix is the single source for FR-AUTH-3 gating in the mock session (editing roles updates what the signed-in session can access, within the mock).

### 5.7 Services and settings (FR-SVC, FR-SET)
- **FR-SVC-1** Reload & Utility: operator tiles (Dialog, Mobitel, Hutch, Airtel; selectable, 52px min), Mobile number* (+94), optional customer name, amount chips with Other, live commission preview, Clear and Send reload (primary, lg).
- **FR-SVC-2** Reload float card: available float, progress bar, warning below the float-low threshold (Rs. 10,000, a setting), reloads/bills/commission today. Send reload reduces float; Top up float increases it (mock).
- **FR-SVC-3** Bill payment card (provider, account number, amount, service fee hint, Pay bill) and a Recent transactions table with Success/Pending/Failed statuses and an Export button. Failed and Pending rows stay listed so they can be retried or refunded.
- **FR-SET-1** Settings: left group list and right card with sections Shop profile, Currency & region, Inventory alerts (expiry window, default reorder level, FEFO, block expired, sidebar low-stock count) and Backup & sync, per design.
- **FR-SET-2** Changes apply only on Save changes (with Discard to revert), except the Backup & sync toggles, which apply instantly. Back up now and Sync now are UI-only (mock) actions.
- **FR-SET-3** Settings values that drive behaviour elsewhere (expiry alert window, default reorder level, float-low threshold, sidebar low-stock count) are read from the mock settings service.

## 6. Non-Functional Requirements
| Category | Requirement |
|---|---|
| Security | Mock sign-in/session only; no real secrets, credentials or tokens. Route guards and permission gating enforced in UI. Standard frontend security rules in `docs/development-standards/FRONTEND_STANDARDS.md`. |
| Performance | One lazy-loaded route per module. Lists of the mock size (hundreds of rows) stay responsive; pagination at 10+ rows. No numeric targets set (OQ6). |
| Availability | Fully standalone with no backend. Sync pill reflects offline state without blocking any screen. |
| Accessibility | WCAG 2.1 AA: 4.5:1 text contrast and 3:1 controls/focus in both themes, visible focus, aria-label on icon-only buttons, status never conveyed by colour alone, keyboard operable. |
| Responsiveness | **Desktop-first, and the site MUST be responsive.** 232px sidebar and fluid content at 1280px and wider. On smaller screens the sidebar collapses (e.g. off-canvas or icon rail with a menu toggle), tables scroll horizontally or stack sensibly without losing the key columns, the 12-column form grids reflow to fewer columns, and the 320px summary column moves below the main form. Card grids reflow. Breakpoints and the smallest supported width are not specified by the user (OQ5). |
| Theming | Light and dark themes, switchable, with all tokens defined for both. |
| Localization | English copy; text kept in the project's i18n mechanism per the frontend standards. |
| Observability | Not required for this phase beyond visible in-UI error states. |

## 7. Constraints & Assumptions
- **Frontend only.** All data is mock or in-memory behind service interfaces (products, batches, GRNs, POs, suppliers, employees, users/roles, reload transactions, settings, auth, sync) so a real API can replace it later. No backend work in this phase. This replaces the earlier HireFlow "demo only / no auth / localStorage" constraints.
- **Sign-in, roles, permissions:** mock sign-in and session, roles with per-module Full / View / No access (FR-AUTH-3).
- **Offline-first sync pill is UI-only** for now (NG3). Never block a screen because of it.
- **Desktop-first but responsive is a hard requirement.** No mobile mockups exist, so responsive behaviour (collapsing sidebar, scrolling/stacking tables, reflowing form grids) is derived from the desktop design and the rules in this PRD and must be reviewed by the stakeholder once built.
- **Design colours are approximate.** The hex values in `docs/design/ShopDesk-design-system.md` were read from swatches (marked "~") and are used as tokens until the user supplies exact values (PDF page 5). Dark theme values were not transcribed and are to be derived to meet the contrast rules, pending exact values (OQ1).
- Design source of truth: `docs/design/ShopDesk-design-system.md`, a hand transcription of the 31-page PDF. The PDF is not in the repo. Where the transcription and PDF differ, the PDF wins once supplied. `docs/design/SHOPDESK_FRONTEND_GUIDE.md` summarises the what-to-build rules.
- Technical stack and structure are dictated by `docs/development-standards/FRONTEND_STANDARDS.md` and the frontend app template (the guide references Angular); the Product Owner does not choose implementation technology.
- Assumption: sample data follows the design's conventions (Sri Lankan rupees, pharmacy products, named staff and suppliers, signed-in user Nimal Perera).
- One branch only: no branch selector anywhere.
- **Archived scope:** the earlier HireFlow job-application PRD and backlog were replaced (see Change Log). The HireFlow design files are stale for ShopDesk work.

## 8. Dependencies
- `docs/design/ShopDesk-design-system.md` and `docs/design/SHOPDESK_FRONTEND_GUIDE.md` — design and build rules.
- `docs/design/CLAUDE.md` — project design rules (ShopDesk rules; rewritten, see OQ7).
- `docs/development-standards/FRONTEND_STANDARDS.md` and `INDEX.md` — mandatory implementation conventions.
- Exact colour values and dark theme values from the user's PDF (page 5).

## 9. Open Questions
- OQ1 — Exact hex values for all tokens (and dark theme values). Currently approximate. Owner: user. Needed before visual sign-off.
- OQ2 — The sample user is labelled "Owner" but the roles are Admin, Manager, Pharmacist, Cashier. Is "Owner" a display label for Admin, or a fifth role? Owner: user. Assumption for now: Owner is shown as the label for the Admin role.
- OQ3 — Mock sign-in credentials and which mock users exist per role (needed for testing role gating). Owner: user or Sanjeewa to propose. Assumption: one mock user per role, derived from the design's sample data.
- OQ4 — Behaviour of non-core buttons: Import CSV, Export, Print, Daily report, Statement, Forgot password, Quick PIN, Edit roles. Assumption: shown, but UI-only or no-op with a clear mock message. Owner: user.
- OQ5 — Responsive breakpoints and the smallest supported width (e.g. 360px as in HireFlow, or tablet only). Not specified. Owner: user.
- OQ6 — Any performance or data-volume targets for mock lists. Not specified.
- OQ7 — RESOLVED: `docs/design/CLAUDE.md` rewritten for ShopDesk and the stale HireFlow design files moved to `docs/design/archive/`.
- OQ8 — Global search (Ctrl K): should it search mock data and navigate, or only render as a visual control for now? Owner: user.

## 10. Change Log
| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: HireFlow Job Application screen (frontend localStorage-only + standalone backend persistence demo). |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with ShopDesk back-office frontend PRD (mock data behind service interfaces, mock auth and roles, UI-only sync pill, responsive requirement, approximate colour tokens). HireFlow archived: its E-1 frontend stories S-1.1.1 to S-1.1.6 were completed; backend S-1.2.1 was never started and is dropped. |
