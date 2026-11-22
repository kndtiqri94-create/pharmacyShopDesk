import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import {
  cashBookExportFileName,
  csvSafeCell,
  toCashBookCsv,
  toCashBookPdfBytes,
  toCashBookTables,
} from './cash-book-export.util';
import { buildCashBookLedger } from './cash-book-ledger.util';
import { mockFiguresForDay } from './cash-book-mock.util';

describe('cash-book-export.util', () => {
  const report = (actualBalanceCents: number | null = null): CashBookReport => ({
    from: '2026-09-20',
    to: '2026-09-21',
    ledger: buildCashBookLedger({
      openingCents: 100_000,
      cashInvoicesCents: 50_000,
      cashDuesCents: 0,
      cashRefundsCents: 0,
      adjustmentsCents: -2_500,
      mock: mockFiguresForDay('2026-09-21'),
      actualBalanceCents,
    }),
    paymentInvoices: [
      { method: 'Card', invoiceCount: 1, amountCents: 700 },
      { method: 'Online', invoiceCount: 0, amountCents: 0 },
    ],
    dailySales: [
      { key: 'SALE_INVOICES', label: 'Sale Invoices', count: 2, amountCents: 2250 },
      { key: 'TAX', label: 'Tax', count: null, amountCents: 0 },
    ],
    toDayLocked: false,
  });

  it('builds the ledger, payment and daily tables from the shown figures', () => {
    const tables = toCashBookTables(report(90_000));
    expect(tables.map(table => table.title)).toEqual([
      'Cash ledger',
      'Other Payment Invoices',
      'Daily Sales Summary',
    ]);
    const ledgerRows = tables[0].rows;
    expect(ledgerRows).toHaveSize(16);
    expect(ledgerRows[1][0]).toBe('Total Expenses (Sample)');
    expect(ledgerRows[13][0]).toBe('Balance');
    expect(ledgerRows[14]).toEqual(['Actual Balance', '', '', '900.00']);
  });

  it('says so when no actual balance exists', () => {
    const rows = toCashBookTables(report())[0].rows;
    expect(rows[14][3]).toBe('Not entered yet');
    expect(rows[15][3]).toBe('Not available');
  });

  it('writes a csv with a title, the range and the sample note', () => {
    const csv = toCashBookCsv(report());
    expect(csv.startsWith('Cash Book\r\n')).toBeTrue();
    expect(csv).toContain('20 Sep 2026 to 21 Sep 2026');
    expect(csv).toContain('Sample figures, not an official report.');
    expect(csv).toContain('Other Payment Invoices');
    expect(csv).not.toContain('Reload');
  });

  it('keeps plain negative numbers but neutralises formula text', () => {
    expect(csvSafeCell('-25.00')).toBe('-25.00');
    expect(csvSafeCell('=1+1')).toBe("'=1+1");
    expect(csvSafeCell('+SUM(A1)')).toBe("'+SUM(A1)");
    expect(csvSafeCell('-cmd')).toBe("'-cmd");
    expect(csvSafeCell('@x')).toBe("'@x");
    expect(csvSafeCell('a,b')).toBe('"a,b"');
  });

  it('names files by range and builds a pdf', () => {
    expect(cashBookExportFileName('csv', report())).toBe('cash-book-2026-09-20-to-2026-09-21.csv');
    const bytes = toCashBookPdfBytes(report(), {
      shopName: 'Shop (A)',
      madeOn: '21 Sep 2026',
      note: 'Sample',
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBeTrue();
    expect(text).toContain('Cash Book');
    expect(text).toContain('Shop \\(A\\)');
    expect(text.trimEnd().endsWith('%%EOF')).toBeTrue();
  });
});
