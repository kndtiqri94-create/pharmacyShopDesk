# ShopDesk — project context

**Product:** ShopDesk, "The quiet back office for a one-shop business." The back office of a single-branch pharmacy POS: a handful of staff, offline-capable, nine modules (Dashboard, Products, GRN, Purchase orders, Suppliers, Employees, Reload & Utility, Users, Settings).

Sources: `docs/design/ShopDesk-design-system.md`, `docs/design/SHOPDESK_FRONTEND_GUIDE.md`, PRD FR-FND-1 to FR-FND-7 and the Responsiveness NFR in `docs/SOLUTION_PRD.md`. The old HireFlow files are in `docs/design/archive/` and are stale for ShopDesk work.

## Brand and tokens
- Hex values below are APPROXIMATE (read from swatches) until the user supplies exact ones (PRD OQ1). Keep them in one tokens file and never use raw hex in components.
- Typeface: DM Sans (fallback Segoe UI); Consolas for codes (SKU, barcode, batch, GRN/PO numbers). Tabular numerals wherever numbers stack.
- Type scale: page-title 24/32 700; section-title 16/24 600; stat-value 28/34 700; body 14/20; body-strong 14/20 600; caption 12/16; label 12/16 600 (uppercase for table headers); code 13/20.
- Primary: indigo ~#4A4DB0 (hover ~#3B3E9B, soft ~#E7E8F8). Sidebar navy ~#1B2040. Ink ~#1B2033. App background ~#F6F7FC, surface #FFFFFF, border-strong ~#7F849E.
- Status colours (success, warning, danger, info, each with a soft ground) are for status only, never decoration.
- Spacing: 4px grid (4, 8, 12, 16, 20, 24, 32). 16 between cards, 20 card padding, 24 screen gutter.
- Radius: sm 4 (badges, checkboxes), md 6 (buttons, inputs), lg 10 (cards, modals), pill 999 (avatars, chips, toggle track).
- Depth: hairline borders; `shadow-card` barely there; `shadow-pop` only for menus and drawers. No gradients, glass, or tinted left-border cards.
- States: hover on rows and outline buttons = surface-sunken; hover on primary = primary-hover; focus = 2px primary ring, 2px offset (white on the sidebar); disabled = 55% opacity, no pointer response.

## Themes
- Light and dark themes, both as CSS custom properties. The sidebar is always dark.
- Text pairs meet 4.5:1; control borders and the focus ring meet 3:1, in both themes.

## Layout and responsiveness
- Desktop-first: 232px sidebar plus a fluid content column at 1280px and wider. Forms use a 12-column grid with a 320px summary column beside the main form.
- It MUST be responsive. Below desktop: the sidebar collapses (off-canvas or icon rail with a menu toggle); tables scroll horizontally or stack without losing key columns; form grids reflow to fewer columns; the 320px summary column moves below the main form; card grids reflow.
- No mobile mockups exist. Breakpoints and the smallest supported width are not set (PRD OQ5); derive from the desktop design and get stakeholder review.

## Content and brand rules
- Plain shopkeeper language: say "you", never "the user". Use shop terms (GRN, PO, batch, expiry, float, reorder level).
- Buttons are verbs in sentence case ("Receive stock", "Create PO", "Save product"). Never "Submit" or "OK". One primary button per screen or form. Danger is an outline, never filled.
- Page headings are nouns with a one-sentence subtitle.
- Numbers: `Rs. 84,250`, `1,240`; dates `21 Sep 2026`; expiry `Mar 2027` (inputs `03/2028`). Money columns are headed `(Rs.)`, two decimals, right-aligned.
- Status is always a word; colour supports it but never replaces it.
- Empty states say what to do next. Errors say what to fix. No emoji, no exclamation marks.
- Motion: none by default (no animated rows or numbers).
- One branch: no branch selector anywhere.

## Icons
- Own line-icon set in one Icon component: 24px grid, 1.75px stroke, round caps and joins, `currentColor`. Sizes 16 / 18 (default) / 22. No emoji, no filled icons.
- An icon alone is allowed only for row actions (view, edit, more), and then it needs an `aria-label`.

## Components
AppShell, Button (default/primary/soft/danger outline/ghost; sm/md/lg), Badge (dot plus word; `plain` for counts), Card (`flush` for tables; never nested), StatCard (tone tints the icon chip only), DataTable (right-align numbers, two-line first cell, mono codes, max 3 row actions, paginate only at 10+ rows), Field (prefix/suffix/hint/error/required, 12-column grid), Tabs (max 5), Toggle (instant-apply settings only), plus Chips with live counts, Pagination, Breadcrumb, Avatar, progress bar, Alert, on-screen keyboard button. Filters and search live inside the card of the table they filter. Use Chips for list filters, Tabs for sections.

## Touch sizing
Till and reload screens and the login button use the `lg` control (46px). Keypad and operator tiles are at least 52px tall.

## Standing instruction
Flag any later request that conflicts with the above before building it.
