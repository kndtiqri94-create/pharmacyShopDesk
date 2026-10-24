# Product Requirements Document — ShopDesk

> **Status:** Draft
> **Version:** v0.8
> **Last updated:** 2026-10-24
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
- NG2 (REVISED v0.4) The POS till/sales screen is now IN scope as a frontend-only, mock-data screen (section 5.9, FR-POS). Still out of scope for it: real payment/card-terminal integration, real receipt/drawer hardware, real barcode-scanner hardware, and a real backend (NG1, NG5 still apply).
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
- **FR-SET-4** (v0.6) Settings gains a "Point of sale" section holding POS configuration, saved with Save changes / Discard like the other sections (FR-SET-2): (a) discounts (REVISED v0.7): line discount on/off, bill discount on/off, a **default discount %** (0 or more; pre-filled on new lines and on the bill when the matching discount is on; changing a discount away from it needs Admin credentials, FR-POS-16), and a maximum discount % cap (hard limit for everyone, including Admin; the default must not exceed it). The v0.6 per-role "approval above" levels are removed; (b) "Hide sidebar when POS opens" on/off (default on; replaces the v0.5 "Open POS maximised" setting, see FR-POS-2, A10 and A18). Browser fullscreen is never a setting, it is only entered by the user's click.
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

### 5.9 POS till / sales screen (FR-POS) — added v0.4
> Added from the user's request for a "POS" button in the header and a full POS till screen modelled on the MyFlexiPOS reference screenshots (layout and fields only; ShopDesk design system, tokens, shared components, content rules and responsive rules govern the look). The user will NOT supply the screenshots (v0.5, OQ30 closed): the written requirements below are the only specification, so there is no POS design-file reference. This is a single-pharmacy product: no wholesale pricing, no branch transfers. Frontend only; all data mock/in-memory behind service interfaces. This revises NG2. Supersedes the "nine modules" wording only in that POS is reached from the top bar, not the sidebar: FR-SHELL-3 still lists exactly nine sidebar modules.
>
> **Phasing (Product Owner recommendation, to confirm).** Phase A (first release) delivers a complete sell-and-take-payment till. Phase B delivers the back-office-adjacent extras (returns, quotations, cash book, counter close, etc.) once Phase A is accepted. Items marked [A] are Phase A, [B] Phase B.

**Entry point**
- **FR-POS-1** [A] Top-bar POS button: a separate blue "POS" pill button in the AppShell top bar (placed with the sync pill / theme controls, before the avatar). Clicking it navigates to the POS screen route. Visible only to roles with POS access (FR-POS-12). Keyboard operable, has an accessible name, and shows an active state while on the POS route.
- **FR-POS-2** [A] (REVISED v0.6) POS screen route: lazy-loaded. The POS header has ONE fullscreen toggle button, placed beside the dark-mode and refresh controls (as in the user's reference header). It toggles browser fullscreen (Fullscreen API): the icon is "maximise" (expand arrows) when not fullscreen and "minimise" (compress arrows) when fullscreen; its accessible name and tooltip state the action it will perform ("Enter full screen" / "Exit full screen"). The icon state follows the real browser state, so it updates when the user exits with Esc or F11. Browsers block entering fullscreen without a user gesture, so POS never enters fullscreen automatically on open; fullscreen starts only when the user clicks the button (the button is the gesture). If the browser does not support fullscreen, the button is hidden. Separately, the POS layout has the sidebar hidden by default (till mode, full width), controlled by Settings "Hide sidebar when POS opens" (FR-SET-4); the sidebar can still be opened with the shell's normal menu control. A "Back to back office" control returns to the Dashboard. The POS header also shows the current date/time, a dark-mode toggle and a refresh (reload data, with unsaved-bill confirmation) control. Interpretation of the user's "image has once maximize then full screen and minimize button" (see A10, A15, A18; OQ31 closed).

**Bill header**
- **FR-POS-3** [A] Top actions Create New Bill and Hold Bill. Bill date (defaults to today, editable). Bill type: Invoice [A] and Return [B]. There is no Transfer bill type and no Retail / Wholesale toggle: single pharmacy, every sale uses the product Selling price (OQ21, OQ28 closed v0.5). Auto-generated invoice number shown; invoice-number lookup and return-bill lookup fields [B].
- **FR-POS-4** [A] Customer select, defaulting to "Walk-in Customer" (mock customers; a customer can be chosen from a searchable list; there is NO inline "add customer", OQ24 closed v0.5). Rep select (mock sales reps, optional) [A: field and per-line Rep column stored only; no commission effect, consistent with FR-EMP-4].

**Product search and bill lines**
- **FR-POS-5** [A] Product search by name, generic name, SKU and barcode (typing or scan-style Enter), from the mock products. Selecting a result, or an exact barcode/SKU match, adds the line (repeat adds increase quantity). Out-of-stock products are shown but cannot be added (message says why); expired batches cannot be sold when Settings "block expired" is on.
- **FR-POS-6** [A] Line-items table with columns S/N, SKU, Rep, Barcode, Sale Price, Discount %, QTY, Action (remove) and Total. The reference columns Warranty, V.code, UOM and Code are dropped (OQ22 closed v0.5); no product fields are added for them. Qty and Discount % are editable per line (Discount % only when line discount is enabled in Settings, FR-SET-4, never above the configured maximum, pre-filled with the Settings default discount %, and any change from that default needs Admin credentials, FR-POS-16); quantity cannot exceed available stock (FEFO batch allocation shown as a hint); money columns right-aligned with two decimals (FR-FND-6); table scrolls horizontally on small screens.
- **FR-POS-7** [A] Totals panel: No. of Items, Sub Total, Discount (Rs.), Discount (%) (bill-level; editing one updates the other), Total, Paid and Balance, all recalculating live. Discount cannot exceed the sub total. Bill-level discount fields are enabled only when bill discount is on in Settings, and the discount % cannot exceed the Settings maximum; it starts at the Settings default discount % and any change from that default needs Admin credentials (FR-SET-4, FR-POS-16).

**Payment**
- **FR-POS-8** [A] (REVISED v0.7, OQ25 closed) Payment methods are exactly Cash (F3), Card (F4), Online (F7) and Credit. There is no "More" dropdown and no other method. Cash has a Cash Received field with change/balance shown. Card and Online record method plus an optional reference only (no integration, NG5). A bill may be paid by more than one method (split payment) [A]. Credit means the amount is left owing on the bill: it needs a named customer chosen from the mock customer list, not Walk-in (A16); selecting Credit with Walk-in Customer is blocked with a message asking for a customer. Credit amount = Total minus the sum of Cash, Card and Online amounts. No credit limits.
- **FR-POS-8a** [A] (v0.7) Paid and Balance wording: Paid = sum of Cash, Card and Online amounts actually received (Credit is not "paid"); Balance = Total minus Paid, shown as "Change" when Cash received exceeds what is due, and as "Credit due" when the sale is saved with a Credit amount. Labels use these words, never colour alone.
- **FR-POS-9** [A] On-screen numeric keypad: 0-9, decimal point and Backspace, minimum 52px keys (FR-FND-7), writing into the focused amount field (Cash Received by default, or the active method's amount field: Card, Online or Credit).

**Bill actions**
- **FR-POS-10** [A] Action buttons: Save & Print (F1), Save (F2), Hold (F10), New (F12). Save requires at least one line and a valid payment (paid not above total plus allowed change). Saving creates a mock sale record, reduces product stock FEFO from batches (assumption A11, a deliberate exception to "only a GRN changes stock" in FR-GRN-5 and G3: GRN adds stock, a POS sale deducts it; see OQ20), then clears for a new bill. Print is the browser print of a receipt-style view, no printer integration (NG5). Hold parks the bill in memory under a hold number; held bills are listed and can be resumed or discarded [A]. Save Quotation (F11) is [B] (FR-POS-14). Function-key shortcuts are active only on the POS screen and have visible hints on the buttons.
- **FR-POS-11** [A] Error and edge states: empty bill cannot be saved/held; stock shortfall at save time (another bill sold it) blocks with a message naming the product; leaving the POS screen or pressing New/Refresh with an unsaved bill asks to confirm; permission denial per FR-POS-12.

**Access**
- **FR-POS-12** [A] POS access (A12, CONFIRMED v0.6): Admin Full, Manager Full, Cashier Full, Pharmacist Full; the permission matrix (FR-USR-1/2) gains a "POS" row. A user without access sees no POS button and a blocked route message (FR-AUTH-4). Discount changes from the default need Admin credentials regardless of the signed-in role (FR-POS-16, FR-SET-4).
- **FR-POS-16** [A] (REVISED v0.7, replaces the v0.6 per-role model) Discount approval against a configured default. Settings holds a default discount % (FR-SET-4). Line and bill discounts start at that default. When a user changes a line discount % or the bill discount % to any value different from the default, the POS opens an approval popup (accessible modal, keyboard operable) asking for an Admin's username and password (real credentials, not a PIN). The credentials are checked against the mock Users data (same mock credentials as mock sign-in, OQ3) and the account must be an active user with the Admin role; a Manager, Pharmacist or Cashier account is rejected with a message saying an Admin is required (A20). On success the new discount is applied and the approver's name and the time are stored on the mock sale (an Admin approval covers that one change; changing it again asks again). On a wrong credential, a non-Admin account, or Cancel, the discount reverts to the default and a message says why; the password is never stored or shown. Changing a discount back to the default needs no approval. The Settings maximum cap still applies to everyone including Admin, and the change is blocked before the popup if it is above the cap. Frontend only, mock data. Open detail: OQ33.

**Bottom bar (Phase B, hidden in Phase A, confirmed v0.7, OQ27 closed)**
- **FR-POS-13** [B] Bottom bar buttons (the reference "Normal" view-mode button is dropped: dropped, not needed in a single-pharmacy till): Last Invoice (re-open/reprint the last sale), Quotations (list), Cash Book, Update Products (quick stock/price edit), Add OB (opening balance), Counter Close, Bill & Reload (jump to Reload & Utility), Drawer (End), Due Amount (customer dues).
- **FR-POS-14** [B] Returns: look up a past invoice and return lines; return restocks FEFO to the original batch where possible and records a refund or customer credit. There is no Transfer bill type (dropped v0.5, OQ28 closed). Quotations: Save Quotation (F11) stores a quote that can be converted to an invoice; no stock effect until converted.
- **FR-POS-15** [B] Cash handling: Cash Book (daily cash in/out from POS sales, Reload & Utility sales are handled separately and are NOT included in the POS cash book or counter close (OQ29 closed v0.6), Counter Close (count expected vs counted cash, shows difference, locks the day's counter report), Drawer End, and Due Amount (customers with unpaid balances, take a payment).

### 5.9.1 Assumptions for POS (v0.4), for the user to confirm
- A10 (REVISED v0.6) POS is reached only via the top-bar POS button. Its header has one fullscreen toggle button whose icon switches between maximise and minimise with the real browser fullscreen state (FR-POS-2). Based on the user's reference header screenshot; closes OQ31.
- A11 CONFIRMED v0.5 (OQ20): a POS sale deducts stock FEFO (mock); sales feed the Dashboard "Today's sales/profit" StatCards from the mock sales service. This is the deliberate exception to "only a GRN changes stock".
- A12 CONFIRMED v0.6: Admin, Manager, Cashier and Pharmacist all have full POS access (FR-POS-12).
- A15 (REVISED v0.6) The maximise/minimise button IS the browser-fullscreen toggle (one control, v0.5 reading withdrawn). POS never auto-enters fullscreen because browsers require a user gesture; the user's click enters it. Hidden where the browser lacks fullscreen support.
- A18 (v0.6) The v0.5 "Open POS maximised" setting is kept but redefined as "Hide sidebar when POS opens" (default on), since fullscreen cannot be auto-started. The user did not mention this setting in the latest answer; to confirm it is still wanted.
- A16 (REVISED v0.7) Credit is one of the four payment methods (Cash, Card, Online, Credit, FR-POS-8). A Credit sale needs a named customer from the mock customer list (not Walk-in); no credit limits, no customer module, no inline add. User confirmed the four methods ("no more cash card online credit").
- A17 (REVISED v0.7) Discount configuration in Settings: line discount on/off, bill discount on/off, a default discount %, and a maximum discount % cap for everyone (FR-SET-4). Any change from the default needs Admin credentials in a popup (FR-POS-16), per the user's answer. The v0.6 per-role "approval above" levels and PIN prompt are withdrawn. The maximum cap is retained from earlier answers (not restated by the user).
- A20 (v0.7) Product Owner interpretation to confirm: only an Admin account may approve (a Manager may not); the prompt applies to every signed-in role, including an Admin; one approval covers one change; a refused or cancelled change reverts to the default; the Settings default is one value used for both line and bill discounts. See OQ33.
- A19 (v0.6) Reload & Utility sales are handled separately from the POS till: not in POS cash book, counter close or the POS bill (FR-POS-15).
- A13 Hardware (receipt printer, cash drawer, card terminal, barcode scanner) is not integrated; scanning is keyboard-wedge-style input into the search box.
- A14 Phase A / Phase B split as marked above.

### 5.9.2 POS billing screen visual restyle (FR-POS-17 to 19) — added v0.8
> Style guide only, taken from a reference POS screenshot (muted grey page, slightly darker panel around line items, colour-coded soft buttons, compact line-item table). Not a pixel copy or a feature copy. Scope: the POS billing screen only (`frontend-app/src/app/features/modules/pos/`). Indigo primary and primary buttons unchanged. No other behaviour or data changes.

- **FR-POS-17** [A] Surfaces and secondary buttons. The billing screen uses a muted grey page background and a slightly darker panel around the line items, both token based with light and dark values. Secondary buttons on this screen only (e.g. Hold in amber, Save in green) become soft tinted, colour-coded buttons, with a dark-theme tint for each. Primary buttons and the indigo palette are unchanged. Meaning is never carried by colour alone (labels and icons stay). Contrast must still pass in both themes: text 4.5:1, borders and controls 3:1 (`frontend-app/scripts/check-contrast.mjs`).
- **FR-POS-18** [A] Line-item details popup. Selecting a line item opens an accessible dialog (focus trapped, Esc and Close, keyboard operable) showing the item details the app currently holds for that product. No new fields are added and no data changes. Cost price is shown only if existing role rules already allow that role to see it (OQ35).
- **FR-POS-19** [A] Taller line-item rows with a bigger box, sized to the closest design-system row size to the reference (proposed lg 46px or 52px, confirmed at the plan gate), keeping a compact-table feel, 52px touch targets and horizontal scroll on small screens.

**A21 (v0.8)** Narrow design-rule exception: `docs/design/CLAUDE.md` says status colours are never decoration. The user chose colour-coded secondary buttons on the billing screen only ("button colors also change not for all"), so FR-POS-17 is a scoped exception covering billing-screen secondary buttons and nothing else. `docs/design/ShopDesk-design-system.md` (a hand transcription of the user's PDF) is not changed; the exception is recorded here and is to be noted in `docs/design/CLAUDE.md` (OQ34).

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

- OQ20 — RESOLVED v0.5: yes, a POS sale reduces stock FEFO and feeds Dashboard Today's sales/profit (A11).
- OQ21 — RESOLVED v0.5: no wholesale price (single pharmacy). Retail/Wholesale toggle removed.
- OQ22 — RESOLVED v0.5: Warranty, V.code, UOM and Code columns dropped.
- OQ23 — PARTLY RESOLVED v0.5: credit sales for named customers from the mock list kept as assumption A16 (user did not object); credit limits not discussed, none built.
- OQ24 — RESOLVED v0.5: mock list only, no inline "add customer".
- OQ25 — RESOLVED v0.7: payment methods are exactly Cash, Card, Online and Credit; no "More" dropdown (FR-POS-8, A16).
- OQ26 — RESOLVED v0.6: discounts are configurable in Settings and discount level approval is needed (FR-SET-4, FR-POS-16, A17). Mechanism details are in OQ32.
- OQ27 — RESOLVED v0.7: Phase B bottom-bar buttons are hidden in Phase A.
- OQ28 — RESOLVED v0.5: Transfer dropped entirely.
- OQ29 — RESOLVED v0.6: Reload & Utility sales are handled separately; not in POS cash book or counter close (A19).
- OQ30 — RESOLVED v0.5: the user will not save the POS screenshots; the written requirements are the specification and no `docs/design/pos-reference/` folder is expected.
- OQ31 — RESOLVED v0.6: one browser-fullscreen toggle button, icon maximise before and minimise in fullscreen, per the user's reference header screenshot (FR-POS-2, A10, A15). Residual detail on the sidebar setting is A18.
- OQ32 — RESOLVED v0.7: the user's answer is a configured default discount; any change from it opens a popup where an admin user enters credentials (FR-POS-16, FR-SET-4, A17). The v0.6 per-role levels and PIN are withdrawn. Remaining details moved to OQ33.
- OQ33 — OPEN (new v0.7), discount approval details, built to A20 unless the user says otherwise (owner: user): (1) May a Manager also approve, or Admin only (assumed Admin only)? (2) Does an Admin who is signed in still get the popup (assumed yes)? (3) One default for both line and bill discounts, and the default value and maximum cap to seed (placeholders: default 0%, cap 20%)? (4) Is the sidebar-hide setting (A18) still wanted?
- OQ34 — OPEN (v0.8): (1) Add the narrow exception (A21) to `docs/design/CLAUDE.md`: outside the Product Owner write scope, so it needs the Team Lead or Frontend Developer. (2) Confirm the line-item row size at the plan gate (lg 46px or 52px). Owner: user / Sanjeewa.
- OQ35 — OPEN (v0.8): which roles may see cost price in the line-item details popup? Assumed to follow whatever role rule the app already applies to cost price on Products; if none exists, hide cost price on the popup until the user decides. Owner: user.

## 10. Change Log
| Version | Date | Author | Change |
|---|---|---|---|
| v0.8 | 2026-10-24 | Shiham (PO) | POS billing screen visual restyle: new section 5.9.2 with FR-POS-17 (grey surfaces and soft colour-coded secondary buttons, light and dark, contrast kept), FR-POS-18 (line-item details popup), FR-POS-19 (taller line-item rows); A21 narrow exception to the "status colour is not decoration" design rule; OQ34, OQ35 opened. |
| v0.7 | 2026-10-22 | Shiham (PO) | More POS answers: discount model replaced by a Settings default discount % with an Admin-credentials popup on any change (FR-POS-16, FR-SET-4, FR-POS-6/7/12, A17, new A20; per-role approval levels and PIN removed; OQ32 closed, new OQ33); payment methods are exactly Cash, Card, Online, Credit, no "More" (FR-POS-8, new FR-POS-8a, FR-POS-9, A16; OQ25 closed); Phase B bottom bar hidden in Phase A (OQ27 closed). Still open: OQ33 (plus unrelated OQ1 to OQ19). |
| v0.6 | 2026-10-22 | Shiham (PO) | More POS answers: maximise/minimise is one browser-fullscreen toggle (FR-POS-2, A10, A15; no auto-fullscreen because of the browser gesture rule; OQ31 closed); "Open POS maximised" setting redefined as "Hide sidebar when POS opens" (A18); discount level approval added (FR-POS-16, FR-SET-4 per-role approval levels, A17; OQ26 closed, new OQ32); A12 confirmed, FR-POS-12 updated; Reload & Utility excluded from POS cash book and counter close (FR-POS-15, A19; OQ29 closed). Still open: OQ25, OQ27, OQ32. |
| v0.5 | 2026-10-22 | Shiham (PO) | POS answers incorporated: confirmed FEFO stock deduction and Dashboard feed (OQ20); removed Retail/Wholesale toggle and wholesale pricing (OQ21); dropped Warranty, V.code, UOM, Code columns (OQ22); no inline add customer (OQ24); added FR-SET-4 Settings "Point of sale" (configurable discounts, Open POS maximised); single maximise/minimise toggle replaces fullscreen toggle (FR-POS-2, A10, A15); dropped Transfer bill type and "Normal" button (OQ28); removed screenshot/design-folder references (OQ30). New assumptions A15-A17, new OQ31. Still open: OQ25, OQ27, OQ29, OQ31, part of OQ26; A12 unconfirmed. |
| v0.4 | 2026-10-21 | Shiham (PO) | Revised NG2 (POS screen now in scope). Added section 5.9 FR-POS-1 to 15 (header POS button, till screen, Phase A/B split), assumptions A10-A14, OQ20 to OQ30. |
| v0.1 | 2026-08-13 | Shiham (PO) | Initial draft: HireFlow Job Application screen (frontend localStorage-only + standalone backend persistence demo). |
| v0.3 | 2026-10-17 | Shiham (PO) | Added section 5.8 HR amendment from 9 reference screenshots: FR-EMP-2 to 5, FR-LVE-1 to 4, FR-PAY-1 to 7, FR-AUTH-5; assumptions 7.1 (A1-A9); OQ9 to OQ19. Extends FR-EMP-1; frontend/mock only. |
| v0.2 | 2026-10-03 | Shiham (PO) | Replaced HireFlow with ShopDesk back-office frontend PRD (mock data behind service interfaces, mock auth and roles, UI-only sync pill, responsive requirement, approximate colour tokens). HireFlow archived: its E-1 frontend stories S-1.1.1 to S-1.1.6 were completed; backend S-1.2.1 was never started and is dropped. |
