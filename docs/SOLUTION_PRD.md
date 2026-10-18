# Product Requirements Document — ShopDesk

> **Status:** Draft
> **Version:** v0.3
> **Last updated:** 2026-10-17
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

### 5.8 HR amendment: Employee master, Leave and Payroll (FR-EMP-2.., FR-LVE, FR-PAY)
> Added in v0.3 from nine reference screenshots of another system (intended copies: `docs/design/hr-reference/1.png` to `9.png`; originals at `C:\Users\knd\AppData\Local\Temp\claude\d--Pharmacy-pharmacyShopDesk\8d1e2a27-8f64-491b-9b13-4e0ce26cccfe\images\1.png` to `9.png`, which are temporary and must be copied into the repo). The screenshots show **layout and fields only**; they are not ShopDesk styling. All screens use ShopDesk tokens, shared components, content rules and the responsive rules in this PRD. All data is mock or in-memory behind service interfaces (frontend only). This amendment extends FR-EMP-1; it does not remove it. The Staff tab of FR-EMP-1 becomes the Employee list of FR-EMP-2.

**Placement (assumption A1).** No new top-level sidebar modules are added (FR-SHELL-3 still lists exactly nine). Employee list, Leave and Payroll are reached from the Employees module (Tabs: Staff, Attendance, Leave, plus a Payroll tab/link and sub-routes), and all are gated by the Employees permission unless FR-AUTH-5 says otherwise.

**Employee master (screenshots 1 to 4)**
- **FR-EMP-2** Employee list (1.png): filters Keyword, Location, Created at, Status with Filter and Reset buttons; Export CSV and Export PDF; Add employee (primary); table columns Image, EMP Code, Name, Address, Mobile, Email, DOB, Location, Status, row actions edit and delete; page-size selector and pagination with "Showing a to b of N entries". Filters combine; Reset clears them. Delete asks for confirmation and, if the employee has a linked user or payroll history, deactivates instead of removing (history is kept).
- **FR-EMP-3** Create/Edit employee (2.png to 4.png), opened as a modal or panel (ShopDesk form-grid pattern) with groups:
  - Basic details: Title, EMP Code, Location, First name*, Middle name, Last name*, Email, Date of birth, Mobile*, Calculate EPF (toggle), Calculate ETF (toggle), Commission Rate (%), Salary Type (Monthly / Daily), Product Discount (%), Invoice Discount (%), Over Time Rate, Monthly Target, Consider as Customer (toggle), Create user account (toggle).
  - Address: Address line 1, Address line 2, City, Country, Suburb, State, Zip.
  - Employee Salaries: Basic Salary. Allowances: add, edit and remove named allowance lines with amount.
  - More Information: Custom Fields 1 to 4, Status (Active / Inactive).
  - Employee image upload (FR-EMP-5). Actions Save and Cancel. Validation errors say what to fix. EMP Code is unique (duplicate rejected, as for SKU in FR-PROD-5).
- **FR-EMP-4** Commission Rate, Product Discount, Invoice Discount, Monthly Target and Consider as Customer are **stored fields only**: they are saved and shown on the employee but are NOT wired into Reload commission, products, GRN, sales or any other module (stakeholder decision). Create user account is an optional flag: when on, saving reminds the user to complete the user in Users (FR-USR-1) and pre-selects this employee there; it creates no real account and a user still links to at most one employee. Calculate EPF and Calculate ETF DO drive payroll (FR-PAY-3).
- **FR-EMP-5** Employee image upload and Export CSV/PDF are mock and frontend-only: image is chosen from the device, previewed and held in memory (type and size limits stated in the error, e.g. JPG/PNG up to 2 MB); Export CSV/PDF generate a file from the currently filtered mock rows in the browser, or show a clear mock message if generation is not feasible (see OQ4 and OQ10). No server upload.

**Leave management (screenshots 7 and 9; also entered from Payroll)**
- **FR-LVE-1** Leave application page (9.png): Leave Year (shows its period, e.g. 01/01/2026 to 31/12/2026), Leave Type, From Date, To Date, Attachment (Browse, mock), Reason for Leave (list), Comments, Covering Employee (with Search employees), Approver, Apply and Reset. Required: Leave Type, From, To, Reason, Approver. Errors: To before From, overlap with an existing leave, days requested above balance (message says how many are left), covering employee equal to the applicant.
- **FR-LVE-2** Leave Balance table (9.png): Leave Type, Entitlement, Balance, Utilized, Pending Approval for the selected employee and year. Leave types seeded with the screenshot data: Annual Leave, Carry Forward - Annual Leave, Casual Leave, Christmas Day, Medical Leave. Balance = Entitlement minus Utilized minus Pending Approval (assumption A4; the sample figures do not follow this exactly, they are sample data only). Applying adds to Pending Approval; approval moves it to Utilized; rejection or cancellation releases it.
- **FR-LVE-3** Leave approval (assumption A5, implied by the Approver and Pending Approval fields): the chosen approver (or an Admin) can approve or reject a pending leave with an optional comment. Status values Pending, Approved, Rejected, Cancelled, always shown as a word. Approved leave marks the employee "On leave" on those dates in FR-EMP-1 counts.
- **FR-LVE-4** Quick "Create Leave" (7.png), opened from a payroll row action: a modal with Date (single day), creating an approved one-day leave of a default type for that employee, reflected in the payroll Leaves column (FR-PAY-2) and Leave Balance. Default leave type and approval status for quick leave: see OQ11.

**Payroll (screenshots 5, 6, 8)**
- **FR-PAY-1** Employees Salaries page (5.png) with Back link and Tabs Monthly Pay and Daily Pay; filters Keyword, Location, Year, Month with Filter and Reset; Export CSV and Export PDF; table columns Name (with EMP code or mobile as sub-line), Basic Salary, Allowance, Commission, Salary Advance, Leaves, Total Nopay, EPF Deductions, Loan Deduction, Payee Tax, Over Time, Gross Salary, Net Salary, Payment Status, Action menu; money columns headed `(Rs.)`, right-aligned, two decimals (FR-FND-6); "N/A" where a value does not apply; page-size selector and pagination. Monthly Pay lists employees whose Salary Type is Monthly; Daily Pay lists Daily employees for a chosen period (assumption A6, the screenshots show no Daily Pay content; see OQ12). Sample employees in the mock data are given salaries so the table is not all zero.
- **FR-PAY-2** Row action menu (6.png): Add Leave (opens FR-LVE-4), Add Salary Advance (FR-PAY-4), Add Nopay Amount (FR-PAY-5). Salary Advance and Leaves cells link to the underlying records.
- **FR-PAY-3** Payroll calculation (mock, frontend), per employee per month:
  - Gross Salary = Basic Salary + Allowance + Commission + Over Time. Over Time = overtime hours x employee Over Time Rate (hours entered with the payroll row or mock data; see OQ13).
  - Commission is the stored Commission Rate % applied to a mock commission base for the month (FR-EMP-4: not linked to real sales; see OQ14).
  - Deductions = Total Nopay + Salary Advance + EPF Deductions + Loan Deduction + Payee Tax.
  - Net Salary = Gross Salary minus Deductions, never below zero (shortfall is shown as a warning).
  - EPF Deductions apply only if Calculate EPF is on, at an employee EPF rate; ETF (employer cost, not deducted from the employee) applies only if Calculate ETF is on. Statutory rates and the Payee Tax bands are **configurable mock constants with placeholder Sri Lankan defaults** (EPF employee 8% and employer 12%, ETF employer 3%, income tax on a monthly slab table). These defaults are an assumption to be confirmed by the stakeholder (OQ15). Rates live in mock settings, not hard-coded in components.
  - Total Nopay = sum of Add Nopay Amount entries plus nopay days x daily rate for unpaid leave (see OQ16). Loan Deduction shows N/A until loans exist (loans are out of scope).
  - Recalculates whenever employee salary, allowances, leave, advances or nopay change. Salary Type Daily uses daily rate x days worked (assumption A6).
- **FR-PAY-4** Create Salary Advance (8.png) modal: Counter, Date, Advance Amount. Amount must be above 0 and not above that month's gross salary; the advance is deducted in that month's payroll (FR-PAY-3). Counter is a mock cash counter/till selector (assumption A7, OQ17).
- **FR-PAY-5** Add Nopay Amount: modal with Date, Amount and Reason (assumed fields; the screenshots show only the menu item, OQ18), recorded against the employee and month and deducted as Total Nopay.
- **FR-PAY-6** Payment Status shows Unpaid or Paid as a badge with a word. Initial status is Unpaid. How a row becomes Paid is not shown in the screenshots (OQ19); assumption: a "Mark as paid" action is NOT built in this phase, the badge is display-only.
- **FR-PAY-7** Export CSV/PDF on this page exports the filtered payroll rows with every column (mock, frontend only, see FR-EMP-5).

**Access for the new screens (assumption A2, to be confirmed by the user)**
- **FR-AUTH-5** The user named no roles, so the defaults follow the existing model: Employee list and Leave pages follow the Employees module permission (Admin Full, Manager View, Pharmacist and Cashier No access). Payroll and salary data (salary fields on the employee form, Payroll page) are sensitive: Admin Full; Manager View only (can see the Payroll page and salary fields read-only; cannot add leave, salary advance or nopay, and cannot edit); Pharmacist and Cashier No access. View-only users see Export CSV/PDF (read action) but not Add employee, edit, delete, row-action menu items, Apply, approve or reject. Hidden modules and route guards per FR-AUTH-4. The permission matrix of FR-USR-1/FR-USR-2 shows Payroll as a row under Employees (Admin Full, Manager View, others No access) or the matrix is left at module level (see OQ9).

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

### 7.1 Assumptions for the HR amendment (v0.3), for the user to confirm
- A1 No new top-level sidebar modules; Leave and Payroll live under Employees (FR-SHELL-3 unchanged).
- A2 Access defaults in FR-AUTH-5 (Admin Full; Manager View; Pharmacist and Cashier none for Employees, Leave, Payroll).
- A3 Location is a mock list (single shop, per NG4 no branch selector); the Location field and filter are shown on HR screens because the screenshots have them, populated with the shop's mock locations (e.g. "Main Shop"). Created at filter is a date range.
- A4 Leave balance formula and seeded leave types as in FR-LVE-2.
- A5 Leave approve/reject is included because Approver and Pending Approval imply it.
- A6 Daily Pay tab content and Daily salary type calculation inferred (FR-PAY-1, FR-PAY-3).
- A7 "Counter" on Salary Advance is a mock till/counter selector.
- A8 The reference screenshots are layout and field references only; ShopDesk design system governs look and feel. Currency shown as `Rs.` per FR-FND-6.
- A9 Statutory EPF/ETF/tax rates are placeholder mock defaults, not verified payroll law (FR-PAY-3).

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
- OQ9 — Confirm access defaults for Employee list, Leave and Payroll (FR-AUTH-5, A2), and whether Payroll gets its own row in the permission matrix. Owner: user.
- OQ10 — Export CSV/PDF: real in-browser file generation (assumed in FR-EMP-5) or a mock message? Reverses NG5 for these screens only if generated. Owner: user.
- OQ11 — Quick Create Leave (7.png) has only Date: which leave type and status does it use (assumed: Casual Leave, approved)? Owner: user.
- OQ12 — Daily Pay tab content (not shown in screenshots). Owner: user.
- OQ13 — Where overtime hours come from (no attendance/time module in scope). Assumed: mock data or entered on the payroll row. Owner: user.
- OQ14 — Commission base for payroll (commission is not linked to sales per stakeholder). Assumed: a mock amount per employee per month. Owner: user.
- OQ15 — Correct EPF, ETF and Payee Tax rates and tax bands to use. Owner: user.
- OQ16 — Whether unpaid leave automatically creates Nopay, and the daily-rate formula (e.g. Basic / 30). Owner: user.
- OQ17 — Meaning of "Counter" on Salary Advance. Owner: user.
- OQ18 — Fields of the Add Nopay Amount modal (no screenshot). Owner: user.
- OQ19 — How a payroll row becomes Paid, and whether a payslip view is wanted. Owner: user.

## 10. Change Log
| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: HireFlow Job Application screen (frontend localStorage-only + standalone backend persistence demo). |
| v0.3 | 2026-10-17 | Shiham (PO) | Added section 5.8 HR amendment from 9 reference screenshots: FR-EMP-2 to 5, FR-LVE-1 to 4, FR-PAY-1 to 7, FR-AUTH-5; assumptions 7.1 (A1-A9); OQ9 to OQ19. Extends FR-EMP-1; frontend/mock only. |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with ShopDesk back-office frontend PRD (mock data behind service interfaces, mock auth and roles, UI-only sync pill, responsive requirement, approximate colour tokens). HireFlow archived: its E-1 frontend stories S-1.1.1 to S-1.1.6 were completed; backend S-1.2.1 was never started and is dropped. |
