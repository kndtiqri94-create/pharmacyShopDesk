# ShopDesk — Basic Frontend Guide

Source: `ShopDesk-design-system.pdf` (brand book, foundations, components, 13 screens).
Technical rules (Angular, structure, testing, security) live in
`docs/development-standards/FRONTEND_STANDARDS.md` and win on any conflict about *how* to code.
This guide covers *what* to build and how it must look and read.

## 1. Product in one paragraph
ShopDesk is the back office of a one-shop pharmacy POS: quiet, dense, fast to scan. One branch
(no branch selector anywhere), a handful of staff, works offline. Nine modules: Dashboard,
Products, GRN, Purchase orders, Suppliers, Employees, Reload & Utility, Users, Settings.

## 2. Start a new frontend app
1. Copy `docs/development-standards/template/frontend-app/` to `frontend-app/` (never edit the template).
2. Install DM Sans (fallback Segoe UI) and use Consolas for codes.
3. Define all design tokens (section 4) as CSS custom properties in `src/styles/_tokens.scss`,
   with a dark theme override. Components use tokens only, never hex values.
4. Build the shared components (section 5) in `src/app/shared/components/` before any screen.
5. Add the icon set as one `Icon` component (24px grid, 1.75px stroke, round caps, `currentColor`).
6. Build the `AppShell`, then screens under `src/app/features/<module>/`.
7. Routes: one lazy-loaded route per module; the sidebar lists exactly the nine modules.

## 3. Content rules
- Write for a shopkeeper at a counter. Say "you", never "the user". Use shop terms: GRN, PO, batch, expiry, float, reorder level.
- Buttons are verbs in sentence case: "Receive stock", "Create PO", "Save product". Never "Submit" or "OK".
- Page heading is a noun; one sentence below says what the page is for.
- Numbers: `Rs. 84,250`, `1,240`, dates `21 Sep 2026`, expiry `Mar 2027` (inputs `03/2028`). Money in tables sits in a column headed `(Rs.)` with two decimals.
- Status is always a word ("Low stock", "Overdue", "Unpaid"); colour only supports it.
- Empty states say what to do next ("No purchase orders yet. Create the first one.").
- No emoji, no exclamation marks, no jokes. Errors say what to fix: "Enter a batch number for Amoxicillin 500mg."

## 4. Tokens
**Colour (light values)**: `app-bg` page, `surface` cards, `surface-sunken` table headers/hover/read-only,
`border` hairlines, `border-strong` input and outline-button borders, `ink`, `ink-muted`, `ink-subtle`,
`primary` (indigo), `primary-hover`, `primary-soft`, `on-primary`, `sidebar-bg`, `sidebar-hover`,
`sidebar-ink`, `sidebar-label`, `sidebar-ink-strong`, `success`/`warning`/`danger`/`info` each with a
`-soft` ground, `focus-ring`, `focus-ring-inverse`.
Take exact values from PDF page 5. The sidebar is always dark, in both themes.
Status colours are for status only, never decoration. Every text pair must reach 4.5:1 (3:1 for control borders and focus ring) in both themes.

**Type** (DM Sans; Consolas for codes):
`page-title` 24/32 700 · `section-title` 16/24 600 · `stat-value` 28/34 700 · `body` 14/20 · `body-strong` 14/20 600 ·
`caption` 12/16 · `label` 12/16 600 (uppercase for table headers) · `code` 13/20 (SKU, barcode, batch, GRN/PO numbers).
Use tabular numerals wherever numbers stack in a column.

**Spacing** (4px base): space-1 4, -2 8, -3 12, -4 16 (gap between cards), -5 20 (card padding), -6 24 (gutter), -8 32.
**Radius**: sm 4 (badges, checkboxes) · md 6 (buttons, inputs) · lg 10 (cards) · pill 999 (avatars, chips, toggle track).
**Depth**: hairline border; `shadow-card` barely there; `shadow-pop` only for menus and drawers.
No gradients, no glass, no tinted left-border cards.

**States**: hover on rows/outline buttons = `surface-sunken`; hover on primary = `primary-hover`;
focus = solid 2px `focus-ring`, 2px offset; disabled = 55% opacity, no pointer response.
**Motion**: none. No animated row inserts or number changes.
**Touch** (till and reload screens): `lg` controls 46px, keypad/operator tiles at least 52px tall.

## 5. Components to build first
| Component | Key inputs | Rules |
|---|---|---|
| AppShell | active, title, user, sync, counts | 232px dark sidebar, top bar with search, sync pill, user. Sync pill on every screen; never block a screen when offline. No second nav row, no footer. |
| Button | variant (default/primary/soft/danger/ghost), size (sm/md/lg), icon, block, disabled | One primary per screen/form. Danger is an outline, never filled. `lg` only for till, reload, login. |
| Badge | tone (neutral/success/warning/danger/info/primary), plain | Dot plus word. Always has text. |
| Card | title, subtitle, actions, footer, flush | Filters and search live inside the card of the table they filter. No card inside a card. |
| StatCard | label, value, note, icon, tone | Tone tints only the icon chip; value stays `ink`. Note says something actionable. |
| DataTable | columns, rows, rowKey, selectable, onRowClick, footer | Right-align numbers; two-line first cell; mono for codes; row-actions column with at most 3 icons (each with `aria-label`); paginate only above 10 rows. |
| Field | label, as, type, options, prefix, suffix, hint, error, required | `Rs.` prefix on money, unit suffix on quantity. Error replaces hint and turns border danger. 12-column `sd-form-grid`. |
| Tabs | items, value, onChange | Five or fewer. Use Chips (not Tabs) for list filters. |
| Toggle | label, checked | For settings that apply at once. "On" is the active behaviour. |
| Icon | name, size, label | Line icons only; icon-only is allowed only for row actions. Add new icons to the same set. |

## 6. Screen structure
Page header (title, one-line purpose, actions on the right, primary button last) → stat cards → a card with
toolbar (search, status chips with live counts, filters) and a table; or a two-column form with a 320px summary beside it.
Layout: 232px sidebar plus fluid content at 1280px and wider.

Screens to build (13): Sign in · Dashboard · Products · Add product · GRN list · New GRN · Purchase orders ·
New purchase order · Suppliers · Employees · Reload & Utility · Users & roles · Settings.

## 7. Domain rules the UI must respect
- Stock is tracked in batches with expiry; sales take the earliest-expiring batch first (FEFO). A product can turn batch tracking off.
- Stock status is derived, not typed: Out of stock at 0; Low stock at or below reorder level; Expiring soon when the nearest batch expires within the alert window (60 days default).
- Only a GRN changes stock. A PO only records what was asked for. A GRN may exist without a PO. Receive on a PO opens a GRN pre-filled from it.
- Employees are staff records; Users are sign-ins; a user links to at most one employee.
- Roles: Admin, Manager, Pharmacist, Cashier. Permission per module: Full, View, No access.
- Status words — Products: In stock, Low stock, Expiring soon, Out of stock · GRN: Draft, Received, Cancelled; payment: Paid, Part paid, Unpaid · PO: Draft, Sent, Part received, Received, Cancelled · Reload: Success, Pending, Failed.
- Offline first: the app keeps working offline; the sync pill shows how many changes are waiting.
- Expiry under six months on a GRN line shows an inline warning. Reload float below Rs. 10,000 (a setting) shows a warning.

## 8. Definition of done for any screen
- Uses only tokens and shared components; matches the PDF screen.
- Content rules in section 3 followed (labels, formats, status words, empty and error text).
- Keyboard focus visible; contrast met in light and dark; icon-only buttons have `aria-label`.
- Works offline and shows sync state; no branch selector.
- Passes the FRONTEND_STANDARDS.md checks (strict TS, one class per file, tests, i18n, security).
