import { TestBed } from '@angular/core/testing';
import { PayrollRow } from '../../../../../core/services/payroll.service';
import { EMPLOYEE_SEED } from '../../../../../core/services/data/in-memory/seed/employee.seed';
import { PayrollCalculation } from '../../../../../core/utils/payroll-calculation.util';
import { PayrollPaymentStatus } from '../../../../../core/models/enums/payroll-payment-status.enum';
import { SalaryType } from '../../../../../core/models/enums/salary-type.enum';
import { PayrollTab } from '../../../../../core/utils/payroll-list.util';
import { PayrollTableComponent } from './payroll-table.component';

function pay(overrides: Partial<PayrollCalculation> = {}): PayrollCalculation {
  return {
    employeeId: 'emp-001',
    month: '2026-09',
    salaryType: SalaryType.MONTHLY,
    basicCents: 12345600,
    daysWorked: null,
    basicEarnedCents: 12345600,
    allowanceCents: 100000,
    commissionCents: 0,
    salaryAdvanceCents: 0,
    leaves: null,
    totalNopayCents: 0,
    epfDeductionCents: null,
    loanDeductionCents: null,
    payeeTaxCents: 0,
    overTimeCents: 0,
    grossCents: 12445600,
    deductionsCents: 0,
    netCents: 12445600,
    shortfallWarning: false,
    employerEpfCents: 0,
    employerEtfCents: 0,
    paymentStatus: PayrollPaymentStatus.UNPAID,
    ...overrides,
  };
}

function manyRows(count: number): PayrollRow[] {
  return Array.from({ length: count }, (_, index) => ({
    employee: {
      ...EMPLOYEE_SEED[0],
      id: `x-${index}`,
      code: `X-${index}`,
      name: `Person ${String(index).padStart(2, '0')}`,
    },
    pay: pay({ employeeId: `x-${index}` }),
  }));
}

describe('PayrollTableComponent', () => {
  function render(rows: readonly PayrollRow[], tab: PayrollTab = 'monthly') {
    const fixture = TestBed.createComponent(PayrollTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('tab', tab);
    const resets: number[] = [];
    fixture.componentInstance.resetRequested.subscribe(() => resets.push(1));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, resets };
  }

  const headers = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim());
  const cells = (element: HTMLElement, row = 0) =>
    Array.from(element.querySelectorAll('tbody tr')[row].querySelectorAll('td')).map(td =>
      td.textContent?.replace(/\s+/g, ' ').trim()
    );
  const entries = (element: HTMLElement) =>
    element.querySelector('[data-testid="entries-text"]')?.textContent?.trim();

  it('shows the Monthly columns with (Rs.) on money headings and no Action column yet', () => {
    const { element } = render(manyRows(1));
    expect(headers(element)).toEqual([
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
    expect(element.querySelector('tbody button')).toBeNull();
  });

  it('shows the name with the code beneath, two decimals, thousands separators and N/A cells', () => {
    const { element } = render(manyRows(1));
    const row = cells(element);
    expect(row[0]).toBe('Person 00 X-0');
    expect(row[1]).toBe('123,456.00');
    expect(row[2]).toBe('1,000.00');
    expect(row[5]).toBe('N/A');
    expect(row[7]).toBe('N/A');
    expect(row[8]).toBe('N/A');
    expect(row[11]).toBe('124,456.00');
    expect(row[12]).toBe('124,456.00');
  });

  it('right-aligns the money and number cells', () => {
    const { element } = render(manyRows(1));
    const tds = element.querySelectorAll('tbody tr:first-child td');
    expect(tds[1].classList).toContain('is-right');
    expect(tds[5].classList).toContain('is-right');
    expect(tds[0].classList).not.toContain('is-right');
  });

  it('shows leave days when present and EPF as an amount when it applies', () => {
    const rows = manyRows(1);
    rows[0].pay = pay({ leaves: 2, epfDeductionCents: 987654 });
    const { element } = render(rows);
    const row = cells(element);
    expect(row[5]).toBe('2');
    expect(row[7]).toBe('9,876.54');
  });

  it('opens the read-only records from the Salary Advance and Leaves cells only when they have a value (AC-39, AC-54)', () => {
    const rows = manyRows(2);
    rows[0].pay = pay({ leaves: 2, salaryAdvanceCents: 250000 });
    const { fixture, element } = render(rows);
    const asked: string[] = [];
    fixture.componentInstance.recordsRequested.subscribe(event =>
      asked.push(`${event.row.employee.id}:${event.kind}`)
    );
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('tbody button'));
    expect(buttons.map(item => item.getAttribute('aria-label'))).toEqual([
      'View salary advances for Person 00',
      'View leave records for Person 00',
    ]);
    expect(buttons.map(item => item.textContent?.trim())).toEqual(['2,500.00', '2']);
    buttons.forEach(item => item.click());
    expect(asked).toEqual(['x-0:advance', 'x-0:leaves']);
    expect(cells(element, 1)[4]).toBe('0.00');
    expect(cells(element, 1)[5]).toBe('N/A');
  });

  it('shows Unpaid and Paid as words in a badge', () => {
    const rows = manyRows(2);
    rows[1].pay = pay({ paymentStatus: PayrollPaymentStatus.PAID });
    const { element } = render(rows);
    const badges = Array.from(element.querySelectorAll('app-badge')).map(badge =>
      badge.textContent?.trim()
    );
    expect(badges).toEqual(['Unpaid', 'Paid']);
  });

  it('warns in words when deductions are more than pay and still shows the net', () => {
    const rows = manyRows(2);
    rows[0].pay = pay({ shortfallWarning: true, netCents: 0, deductionsCents: 99999999 });
    const { element } = render(rows);
    const warnings = element.querySelectorAll('[data-testid="shortfall-warning"]');
    expect(warnings).toHaveSize(1);
    expect(warnings[0].textContent).toContain('Deductions are more than pay');
    expect(cells(element, 0)[12]).toContain('0.00');
  });

  it('heads Basic as Daily Rate and adds Days Worked on the Daily tab', () => {
    const rows = manyRows(1);
    rows[0].pay = pay({ salaryType: SalaryType.DAILY, daysWorked: 20 });
    const { element } = render(rows, 'daily');
    const names = headers(element);
    expect(names[1]).toBe('Daily Rate (Rs.)');
    expect(names[2]).toBe('Days Worked');
    expect(names).toHaveSize(15);
    expect(cells(element)[2]).toBe('20');
  });

  it('pages 10, 25 and 50 with the entries text', () => {
    const { fixture, element } = render(manyRows(30));
    expect(element.querySelectorAll('tbody tr')).toHaveSize(10);
    expect(entries(element)).toBe('Showing 1 to 10 of 30 entries');
    const size = element.querySelector('#payroll-page-size') as HTMLSelectElement;
    size.value = '25';
    size.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveSize(25);
    expect(entries(element)).toBe('Showing 1 to 25 of 30 entries');
    size.value = '50';
    size.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveSize(30);
    expect(Array.from(size.options).map(option => option.value)).toEqual(['10', '25', '50']);
  });

  it('shows an empty state with a Reset that asks the page to reset, and 0 entries', () => {
    const { fixture, element, resets } = render([]);
    expect(element.textContent).toContain('No employees match');
    expect(element.querySelector('table')).toBeNull();
    expect(entries(element)).toBe('Showing 0 to 0 of 0 entries');
    const reset = Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Reset filters'
    ) as HTMLButtonElement;
    reset.click();
    fixture.detectChanges();
    expect(resets).toHaveSize(1);
  });

  it('keeps the table in a horizontal scroll container', () => {
    const { element } = render(manyRows(1));
    expect(element.querySelector('.table-wrap')?.classList).toContain('sd-scroll-x');
  });

  it('never writes raw HTML for names', () => {
    const rows = manyRows(1);
    rows[0].employee = { ...rows[0].employee, name: '<img src=x onerror=alert(1)>' };
    const { element } = render(rows);
    expect(element.querySelector('tbody img')).toBeNull();
    expect(cells(element)[0]).toContain('<img src=x');
  });
});
