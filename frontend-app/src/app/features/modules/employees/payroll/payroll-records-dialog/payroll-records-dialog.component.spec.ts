import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../../testing/auth-test.util';
import { UserRole } from '../../../../../core/models/enums/user-role.enum';
import { PayrollRow, PayrollService } from '../../../../../core/services/payroll.service';
import { defaultPayrollFilters } from '../../../../../core/utils/payroll-list.util';
import { PayrollRecordsDialogComponent } from './payroll-records-dialog.component';

describe('PayrollRecordsDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });
  afterEach(clearBrowserStorage);

  async function render(kind: 'advance' | 'leaves', employeeId: string, month = '2026-09') {
    await signInAs(UserRole.MANAGER);
    const rows = await firstValueFrom(
      TestBed.inject(PayrollService).getPayrollRows('monthly', defaultPayrollFilters('2026-09-21'))
    );
    const fixture = TestBed.createComponent(PayrollRecordsDialogComponent);
    fixture.componentRef.setInput(
      'row',
      rows.find(item => item.employee.id === employeeId) as PayrollRow
    );
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('monthKey', month);
    fixture.componentRef.setInput('monthLabel', 'September 2026');
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, closed: () => closed };
  }

  it('lists the month advances read-only with date, counter and amount', async () => {
    const rows = await (async () => {
      await signInAs(UserRole.MANAGER);
      return firstValueFrom(
        TestBed.inject(PayrollService).getPayrollRows(
          'monthly',
          defaultPayrollFilters('2026-09-21')
        )
      );
    })();
    const withAdvance = rows.find(item => item.pay.salaryAdvanceCents > 0);
    expect(withAdvance).toBeDefined();
    const { element } = await render('advance', withAdvance!.employee.id);
    expect(element.querySelector('h2')?.textContent).toContain('Salary advances');
    expect(element.querySelector('[data-testid="records-month"]')?.textContent).toContain(
      'September 2026'
    );
    const headers = Array.from(element.querySelectorAll('th')).map(item =>
      item.textContent?.trim()
    );
    expect(headers).toEqual(['Date', 'Counter', 'Amount']);
    expect(element.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    expect(element.querySelector('input, textarea, select')).toBeNull();
  });

  it('says so when there are no leave records in the month and closes on Close', async () => {
    const { element, closed } = await render('leaves', 'emp-001', '2026-01');
    expect(element.querySelector('h2')?.textContent).toContain('Leave records');
    expect(element.querySelector('[data-testid="records-empty"]')?.textContent).toContain(
      'No approved leave'
    );
    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.map(item => item.textContent?.trim())).toEqual(['Close']);
    buttons[0].click();
    expect(closed()).toBe(1);
  });
});
