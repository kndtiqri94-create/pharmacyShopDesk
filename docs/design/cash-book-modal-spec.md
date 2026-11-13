# Cash Book modal — design specification (S-2.10.8)

- **Story:** `docs/user-stories/2.10.8_CASH_BOOK_EXTENSION_USER_STORY.md` (AC-1 to AC-21)
- **Plan:** `docs/features/2.10.8_CASH_BOOK_EXTENSION_PLAN.md`
- **Author:** Hasika (Frontend Developer). Written before any build work.
- **Design system:** `docs/design/ShopDesk-design-system.md`, `docs/design/CLAUDE.md`, `docs/design/SHOPDESK_FRONTEND_GUIDE.md`. Only existing tokens are used (`--sd-*`, `--sd-pos-*`); no new colours.
- **Status of data:** sample (mock) where noted. Semantics follow assumption A36 until OQ38 is answered.

## 1. Purpose
One accountant-style view of the till's money for a chosen date range: how the cash drawer should balance, what was counted, and the difference. It extends the S-2.10.4 Cash Book in place (same `app-cash-book-dialog`, same till bottom-bar entry).

## 2. Layout (top to bottom, large POS dialog)
1. **Header:** title "Cash Book", close icon button (aria-label "Close").
2. **Filter bar (one row, wraps on narrow widths):**
   - Group label "Created at", two date fields: "From" and "To" (default both Today, max Today).
   - Buttons: Filter (primary), Reset.
   - Right side: Export CSV, Export PDF (`tone="muted"` buttons, `xl` 52px).
3. **Action bar:** Add Actual Balance, Adjustment, Add OB (`tone="blue"` buttons, `xl`, same as the till-level bottom-bar actions). Admin only, see section 5.
4. **Message area:** inline `Alert` for an invalid range (warning), locked/past-day notice (info), and the sample-data notice.
5. **Ledger table** (caption "Cash ledger"): columns Description, Credit (Rs.), Debit (Rs.), Balance (Rs.).
6. **Other Payment Invoices** table: Method, Invoices, Amount (Rs.). Rows: Card, Online. Nothing else.
7. **Daily Sales Summary** table: Item, Count, Amount (Rs.). Rows: Sale Invoices, Invoice Returns, Discount, Tax, Unpaid Invoices.
8. **Footer:** Close button.

The two lower tables sit side by side at desktop widths (two columns) and stack below that.

## 3. Ledger rows (fixed order, always all shown)
| # | Description | Column | Source |
|---|---|---|---|
| 1 | Opening Balance | Credit | Real: opening balance of the From day (counter report if closed, else saved opening, else 0) |
| 2 | Total Expenses | Debit | Sample |
| 3 | Advance Salary | Debit | Sample |
| 4 | Employee Loan Settlement | Credit | Sample |
| 5 | Incomes | Credit | Sample |
| 6 | Invoices | Credit | Real: cash kept from sales (cash received minus change). Card, Online, Credit never counted |
| 7 | Previous Invoices | Credit | Real: cash payments received against earlier credit invoices (dues) |
| 8 | Invoice Returns | Debit | Real: cash refunds on returns |
| 9 | GRNs | Debit | Sample |
| 10 | GRN Returns | Credit | Sample |
| 11 | Cash back | Debit | Sample |
| 12 | Adjustments | Credit if positive, Debit if negative | Real: signed adjustments recorded in the session for the range |
| 13 | Cashbook Bank Deposit | Debit | Sample |

Then three summary rows (bold, top border):
- **Balance:** Credit = total credits, Debit = total debits, Balance = credits minus debits.
- **Actual Balance:** Balance column shows the counted cash for the To day, or the text "Not entered yet" when none is recorded.
- **Difference:** Actual Balance minus Balance (A36). Shows "Not available" until an actual balance exists. Status by word: "Short", "Over" or "Matches" next to the figure, never colour alone.

The Balance column of rows 1-13 is the running balance after that row.

Rows marked **Sample** carry a small text tag "Sample" beside the description. A notice states: "Rows marked Sample use made-up figures until those modules exist." Sample rows show figures only for days that are Today or have till activity (an opening balance, sale, return or due payment); a range with no activity at all shows zeros (AC-7).

Reload and Utility never appear: no Reload Commission row, no Provider TopUp row, no Add Reload Commission button (AC-12).

## 4. Other tables
- **Other Payment Invoices:** Card and Online only. "Invoices" is the count of invoices with a payment of that method in the range; "Amount" is the sum paid by that method. Cash is in the ledger; Credit is shown as Unpaid Invoices.
- **Daily Sales Summary:**
  - Sale Invoices: count and total of invoices.
  - Invoice Returns: count and total of returns (any settlement).
  - Discount: total discount given.
  - Tax: Rs. 0.00 with a caption "Tax is not recorded on sales yet." (sales carry no tax figure).
  - Unpaid Invoices: count and total left on credit.

## 5. Behaviour
- **Open:** Today by default; the date fields reset on every open (AC-2).
- **Filter:** validates the draft range. Valid: figures refresh for the range (AC-5). Invalid, reversed or too wide (more than 92 days) or a future date: warning "Choose a valid date range, From on or before To, today at the latest, and at most 92 days." and the previous figures stay (AC-8).
- **Reset:** both dates return to Today, figures refresh (AC-6).
- **Empty range:** all amounts show 0.00, no error (AC-7).
- **Export CSV / PDF:** built from the figures currently shown (the same ledger object), with a "Sample figures, not an official report" note. Downloaded in the browser, no server (AC-9). File names `cash-book-<from>-to-<to>.csv|pdf`. CSV text cells that start with `=`, `+`, `-` or `@` are neutralised.
- **Admin only actions (AC-13 to AC-17):**
  - Add Actual Balance: dialog "Add actual balance", one money field "Counted cash" (zero or more, two decimals) for the To day. Replaces the shown figure by adding a newer dated entry; earlier entries are kept.
  - Adjustment: dialog "Add adjustment", "Amount" (signed, two decimals, not zero, `-` for money taken out) and "Note" (required, up to 200 characters), for the To day. Adjustments row and Balance update.
  - Add OB: opens the existing Add opening balance dialog (same confirm-to-change and change log). It sets today's opening balance.
  - Non-Admin POS users see the three buttons **disabled** with the visible line "Only an Admin can add actual balance, adjustments or opening balance." Filter, Reset and exports still work. The service also refuses them.
  - Writes for a closed (locked) day are refused with "That day is closed and locked, so it cannot be changed."
  - Success toasts name the action only ("Actual balance saved."), never amounts.
- **Existing till-level Add OB button** is unchanged (decision of the user); only the Add OB inside the Cash Book is Admin only.
- **Unsaved bill:** opening and closing the Cash Book never touches the bill (AC-20).

## 6. Accessibility (AC-18)
- Native modal `<dialog>`: focus trapped inside, Esc closes, focus returns to the opener.
- Every control reachable by keyboard in reading order: filter bar, exports, actions, tables, Close. Targets 52px (`xl`).
- Labels tied to inputs (`for`/`id`); tables have captions or `aria-label`; header cells use `scope="col"`; summary row labels are row headers.
- Errors are announced (alert role) and tied to fields; status words (Short, Over, Matches, Sample) are text.
- Disabled buttons keep their label and the explanation stays visible text, not a tooltip only.

## 7. Appearance (AC-19)
- Surfaces, borders, ink, focus ring from `--sd-*` tokens; works in light and dark without extra rules.
- Money columns right-aligned, tabular numerals (`sd-num`), always two decimals, headed `(Rs.)`; negatives with a leading minus.
- Table headers uppercase 12px label style per the design system; summary rows body-strong; no gradients, no motion.
- Buttons are sentence case verbs; one primary (Filter).

## 8. Out of scope
Reload and Utility in any form, other languages, real server data, real PDF/CSV services, payment methods beyond Cash, Card, Online and Credit, linking Cashbook Bank Deposit to a real bank account.
