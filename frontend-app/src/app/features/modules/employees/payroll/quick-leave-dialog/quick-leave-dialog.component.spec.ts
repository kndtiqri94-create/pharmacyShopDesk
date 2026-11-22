import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../../testing/auth-test.util';
import { UserRole } from '../../../../../core/models/enums/user-role.enum';
import { LeaveDataService } from '../../../../../core/services/data/leave-data.service';
import { PayrollService } from '../../../../../core/services/payroll.service';
import { defaultPayrollFilters } from '../../../../../core/utils/payroll-list.util';
import { QuickLeaveDialogComponent } from './quick-leave-dialog.component';

async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 30));
  fixture.detectChanges();
}

describe('QuickLeaveDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });
  afterEach(clearBrowserStorage);

  async function render(role: UserRole = UserRole.ADMIN) {
    await signInAs(role);
    const rows = await firstValueFrom(
      TestBed.inject(PayrollService).getPayrollRows('monthly', defaultPayrollFilters('2026-09-21'))
    );
    const fixture = TestBed.createComponent(QuickLeaveDialogComponent);
    fixture.componentRef.setInput(
      'row',
      rows.find(item => item.employee.id === 'emp-004')!
    );
    const events = { finished: 0, cancelled: 0 };
    fixture.componentInstance.finished.subscribe(() => (events.finished += 1));
    fixture.componentInstance.cancelled.subscribe(() => (events.cancelled += 1));
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (text: string) =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === text
      ) as HTMLButtonElement;
    const setDate = (value: string) => {
      const field = element.querySelector('input[type="date"]') as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, events, button, setDate };
  }

  it('shows Create Leave with a labelled Date defaulting to today and one primary button', async () => {
    const { element } = await render();
    expect(element.querySelector('h2')?.textContent).toContain('Create Leave');
    const label = element.querySelector('label') as HTMLLabelElement;
    expect(label.textContent).toContain('Date');
    expect(element.querySelector(`#${label.getAttribute('for')}`)).not.toBeNull();
    expect((element.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(
      '2026-09-21'
    );
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('shows a missing date on the date field and focuses it', async () => {
    const { fixture, element, events, button, setDate } = await render();
    setDate('');
    button('Save').click();
    await settle(fixture);
    fixture.detectChanges();
    expect(element.querySelector('.field__error')?.textContent).toContain('Choose a date');
    expect(document.activeElement?.getAttribute('type')).toBe('date');
    expect(events.finished).toBe(0);
  });

  it('shows a leave rule message on the date field when the leave is refused', async () => {
    const { fixture, element, events, button, setDate } = await render();
    setDate('2020-01-06');
    button('Save').click();
    await settle(fixture);
    fixture.detectChanges();
    expect(events.finished).toBe(0);
    expect(element.querySelector('dialog')).not.toBeNull();
    expect(element.querySelector('[data-testid="form-error"]')).not.toBeNull();
    const requests = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
    expect(requests.some(item => item.fromDate === '2020-01-06')).toBeFalse();
  });

  it('creates the leave once and finishes', async () => {
    const { fixture, events, button } = await render();
    button('Save').click();
    fixture.detectChanges();
    expect(button('Cancel').disabled).toBeTrue();
    await settle(fixture);
    expect(events.finished).toBe(1);
    const requests = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
    expect(
      requests.filter(item => item.employeeId === 'emp-004' && item.fromDate === '2026-09-21')
    ).toHaveSize(1);
  });

  it('reports a cancel', async () => {
    const { button, events } = await render();
    button('Cancel').click();
    expect(events.cancelled).toBe(1);
  });

  it('finishes with a warning for a Manager and saves nothing', async () => {
    const { fixture, events, button } = await render(UserRole.MANAGER);
    button('Save').click();
    await settle(fixture);
    expect(events.finished).toBe(1);
    const requests = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
    expect(
      requests.some(item => item.fromDate === '2026-09-21' && item.employeeId === 'emp-004')
    ).toBeFalse();
  });
});
