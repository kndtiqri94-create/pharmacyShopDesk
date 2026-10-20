import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../../testing/auth-test.util';
import { UserRole } from '../../../../../core/models/enums/user-role.enum';
import { PayrollDataService } from '../../../../../core/services/data/payroll-data.service';
import { PayrollAdminService } from '../../../../../core/services/payroll-admin.service';
import { PayrollService } from '../../../../../core/services/payroll.service';
import { defaultPayrollFilters } from '../../../../../core/utils/payroll-list.util';
import { SalaryAdvanceDialogComponent } from './salary-advance-dialog.component';

async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 30));
  fixture.detectChanges();
}

describe('SalaryAdvanceDialogComponent', () => {
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
    const fixture = TestBed.createComponent(SalaryAdvanceDialogComponent);
    fixture.componentRef.setInput(
      'row',
      rows.find(item => item.employee.id === 'emp-004')!
    );
    fixture.componentRef.setInput('month', '2026-09');
    const events = { finished: 0, cancelled: 0 };
    fixture.componentInstance.finished.subscribe(() => (events.finished += 1));
    fixture.componentInstance.cancelled.subscribe(() => (events.cancelled += 1));
    fixture.detectChanges();
    await settle(fixture);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const save = () =>
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === 'Save'
      ) as HTMLButtonElement;
    const fill = (selector: string, value: string, event = 'input') => {
      const field = element.querySelector(selector) as HTMLInputElement & HTMLSelectElement;
      field.value = value;
      field.dispatchEvent(new Event(event));
      fixture.detectChanges();
    };
    return { fixture, element, events, save, fill };
  }

  it('labels every field, defaults the date to today and offers the settings counters', async () => {
    const { element } = await render();
    expect(element.querySelector('h2')?.textContent).toContain('Create Salary Advance');
    for (const label of ['Counter', 'Date', 'Advance Amount']) {
      const node = Array.from(element.querySelectorAll('label')).find(item =>
        item.textContent?.includes(label)
      );
      expect(node).toBeDefined();
      expect(element.querySelector(`#${node!.getAttribute('for')}`)).not.toBeNull();
    }
    expect((element.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(
      '2026-09-21'
    );
    const options = Array.from(element.querySelectorAll('select option')).map(item =>
      item.textContent?.trim()
    );
    expect(options).toContain('Counter1');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('shows the gross limit hint for the shown month and a general one for another month', async () => {
    const { fixture, element, fill } = await render();
    expect(element.textContent).toContain("this month's gross salary of Rs.");
    fill('input[type="date"]', '2026-08-10');
    expect(fixture.nativeElement.textContent).toContain('gross salary of the month of the date');
  });

  it('shows field errors, keeps the dialog open and focuses the first error', async () => {
    const { fixture, element, events, save } = await render();
    save().click();
    await settle(fixture);
    fixture.detectChanges();
    expect(element.textContent).toContain('Choose a counter');
    expect(element.querySelector('[data-testid="form-error"]')).not.toBeNull();
    expect(document.activeElement?.tagName).toBe('SELECT');
    expect(events.finished).toBe(0);
  });

  it('shows the over-gross message on the amount field and saves nothing', async () => {
    const { fixture, element, save, fill } = await render();
    fill('select', 'Counter1', 'change');
    fill('input[inputmode="decimal"]', '99999999');
    save().click();
    await settle(fixture);
    fixture.detectChanges();
    expect(element.querySelector('.field__error')?.textContent).toContain('gross salary');
    expect(document.activeElement?.getAttribute('inputmode')).toBe('decimal');
    const before = (await firstValueFrom(TestBed.inject(PayrollDataService).getAdvances())).length;
    expect((await firstValueFrom(TestBed.inject(PayrollDataService).getAdvances())).length).toBe(
      before
    );
  });

  it('disables both buttons while saving and finishes once', async () => {
    const { fixture, events, save, fill, element } = await render();
    fill('select', 'Counter1', 'change');
    fill('input[inputmode="decimal"]', '1000');
    save().click();
    fixture.detectChanges();
    const buttons = Array.from(element.querySelectorAll('.confirm__actions button'));
    expect(buttons.every(item => (item as HTMLButtonElement).disabled)).toBeTrue();
    await settle(fixture);
    fixture.detectChanges();
    expect(events.finished).toBe(1);
  });

  it('reports a cancel', async () => {
    const { element, events } = await render();
    (
      Array.from(element.querySelectorAll('button')).find(
        item => item.textContent?.trim() === 'Cancel'
      ) as HTMLButtonElement
    ).click();
    expect(events.cancelled).toBe(1);
  });

  it('finishes with a warning when the service is busy elsewhere', async () => {
    const { fixture, element, events, save, fill } = await render();
    spyOn(TestBed.inject(PayrollAdminService), 'addSalaryAdvance').and.resolveTo({
      ok: false,
      reason: 'busy',
      errors: {},
      firstErrorField: null,
    });
    fill('select', 'Counter1', 'change');
    fill('input[inputmode="decimal"]', '1000');
    save().click();
    await settle(fixture);
    fixture.detectChanges();
    expect(element.querySelector('[data-testid="form-error"]')?.textContent).toContain(
      'still saving'
    );
    expect(events.finished).toBe(0);
  });
});
