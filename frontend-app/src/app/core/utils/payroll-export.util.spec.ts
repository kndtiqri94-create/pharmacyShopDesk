import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { PayrollRow, PayrollService } from '../services/payroll.service';
import {
  describePayrollFilters,
  payrollExportFileName,
  payrollExportHeaders,
  toPayrollCsv,
  toPayrollExportRows,
  toPayrollPdfBytes,
} from './payroll-export.util';
import { defaultPayrollFilters } from './payroll-list.util';

const FILTERS = defaultPayrollFilters('2026-09-21');

describe('payroll-export.util', () => {
  let monthly: PayrollRow[];
  let daily: PayrollRow[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    const service = TestBed.inject(PayrollService);
    monthly = await firstValueFrom(service.getPayrollRows('monthly', FILTERS));
    daily = await firstValueFrom(service.getPayrollRows('daily', FILTERS));
  });

  it('lists every Monthly column with (Rs.) money headings', () => {
    expect(payrollExportHeaders('monthly')).toEqual([
      'EMP Code',
      'Name',
      'Basic Salary (Rs.)',
      'Allowance (Rs.)',
      'Commission (Rs.)',
      'Salary Advance (Rs.)',
      'Leaves',
      'Total Nopay (Rs.)',
      'EPF Deductions (Rs.)',
      'Loan Deduction (Rs.)',
      'Payee Tax (Rs.)',
      'Over Time (Rs.)',
      'Gross Salary (Rs.)',
      'Net Salary (Rs.)',
      'Payment Status',
    ]);
  });

  it('uses Daily Rate and Days Worked on the Daily tab', () => {
    const headers = payrollExportHeaders('daily');
    expect(headers[2]).toBe('Daily Rate (Rs.)');
    expect(headers[3]).toBe('Days Worked');
    expect(toPayrollExportRows(daily, 'daily')[0]).toHaveSize(headers.length);
  });

  it('writes two-decimal money, N/A cells and the payment status word', () => {
    const rows = toPayrollExportRows(monthly, 'monthly');
    const headers = payrollExportHeaders('monthly');
    const kamal = rows[monthly.findIndex(row => row.employee.id === 'emp-002')];
    expect(kamal[0]).toBe(monthly.find(row => row.employee.id === 'emp-002')!.employee.code);
    expect(kamal[headers.indexOf('Gross Salary (Rs.)')]).toBe('189100.00');
    expect(kamal[headers.indexOf('Loan Deduction (Rs.)')]).toBe('N/A');
    expect(kamal[headers.indexOf('Payment Status')]).toBe('Unpaid');
    for (const cell of kamal.filter((_, index) => headers[index].includes('(Rs.)'))) {
      expect(cell === 'N/A' || /^-?\d+\.\d{2}$/.test(cell)).toBeTrue();
    }
  });

  it('quotes cells (RFC 4180) and neutralises formulas', () => {
    const risky: PayrollRow = {
      ...monthly[0],
      employee: { ...monthly[0].employee, name: '=HYPERLINK("x"),"a"' },
    };
    const csv = toPayrollCsv(toPayrollExportRows([risky], 'monthly'), 'monthly');
    expect(csv).toContain('"\'=HYPERLINK(""x""),""a"""');
    expect(csv.endsWith('\r\n')).toBeTrue();
    expect(csv.split('\r\n')[0]).toContain('Name');
    const plus: PayrollRow = { ...risky, employee: { ...risky.employee, name: '+1' } };
    expect(toPayrollCsv(toPayrollExportRows([plus], 'monthly'), 'monthly')).toContain("'+1");
  });

  it('gives a header-only CSV and a one-page PDF for an empty set', () => {
    expect(toPayrollCsv([], 'monthly').split('\r\n')).toHaveSize(2);
    const text = new TextDecoder().decode(
      toPayrollPdfBytes([], 'monthly', {
        shopName: 'Shop',
        madeOn: 'x',
        filters: [],
        note: 'n',
      })
    );
    expect(text).toContain('/Count 1');
    expect(text).toContain('Filters used: None');
  });

  it('describes the tab, year, month and optional filters', () => {
    expect(describePayrollFilters('monthly', FILTERS)).toEqual([
      'Tab: Monthly Pay',
      'Year: 2026',
      'Month: September',
    ]);
    expect(
      describePayrollFilters('daily', { ...FILTERS, keyword: ' ann ', location: 'Colombo' })
    ).toEqual([
      'Tab: Daily Pay',
      'Year: 2026',
      'Month: September',
      'Keyword: ann',
      'Location: Colombo',
    ]);
  });

  it('names files by tab and month', () => {
    expect(payrollExportFileName('csv', 'monthly', FILTERS)).toBe('payroll-monthly-2026-09.csv');
    expect(payrollExportFileName('pdf', 'daily', { year: 2026, month: 3 })).toBe(
      'payroll-daily-2026-03.pdf'
    );
  });

  it('builds a landscape PDF with the note and more pages for many rows', () => {
    const many = Array.from({ length: 80 }, () => toPayrollExportRows(monthly, 'monthly')[0]);
    const text = new TextDecoder().decode(
      toPayrollPdfBytes(many, 'monthly', {
        shopName: 'ShopDesk',
        madeOn: '21 Sep 2026',
        filters: ['Tab: Monthly Pay'],
        note: 'Sample rates, not payroll law.',
      })
    );
    expect(text.startsWith('%PDF')).toBeTrue();
    expect(text).toContain('/MediaBox [0 0 842 595]');
    expect(text).toContain('/Count 3');
    expect(text).toContain('Sample rates, not payroll law.');
    expect(text).toContain('Filters used: Tab: Monthly Pay');
  });
});
