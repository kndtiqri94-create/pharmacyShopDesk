import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../../testing/auth-test.util';
import { UserRole } from '../../../../../core/models/enums/user-role.enum';
import { PayrollDataService } from '../../../../../core/services/data/payroll-data.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PayrollService } from '../../../../../core/services/payroll.service';
import { defaultPayrollFilters } from '../../../../../core/utils/payroll-list.util';
import { NopayDialogComponent } from './nopay-dialog.component';

async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 30));
  fixture.detectChanges();
}

describe('NopayDialogComponent', () => {
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
    const fixture = TestBed.createComponent(NopayDialogComponent);
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
    const fill = (selector: string, value: string) => {
      const field = element.querySelector(selector) as HTMLInputElement & HTMLTextAreaElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, events, button, fill };
  }

  it('labels the fields, defaults the date to today and has one primary button', async () => {
    const { element } = await render();
    expect(element.querySelector('h2')?.textContent).toContain('Create Nopay Amount');
    for (const label of ['Date', 'Amount', 'Reason']) {
      const node = Array.from(element.querySelectorAll('label')).find(item =>
        item.textContent?.includes(label)
      );
      expect(element.querySelector(`#${node!.getAttribute('for')}`)).not.toBeNull();
    }
    expect((element.querySelector('input[type="date"]') as HTMLInputElement).value).toBe(
      '2026-09-21'
    );
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('counts the reason and stops at 250 characters', async () => {
    const { element, fill } = await render();
    expect(element.textContent).toContain('0 of 250 characters');
    fill('textarea', 'x'.repeat(300));
    expect(element.textContent).toContain('250 of 250 characters');
  });

  it('shows every field error, focuses the first and saves nothing', async () => {
    const { fixture, element, events, button, fill } = await render();
    fill('input[type="date"]', '');
    button('Save').click();
    await settle(fixture);
    fixture.detectChanges();
    expect(element.textContent).toContain('Choose a date');
    expect(element.textContent).toContain('must be above 0');
    expect(element.textContent).toContain('Enter the reason');
    expect(document.activeElement?.getAttribute('type')).toBe('date');
    expect(events.finished).toBe(0);
    expect(
      (await firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries())).length
    ).toBeGreaterThan(0);
  });

  it('saves a trimmed entry and finishes', async () => {
    const { fixture, events, button, fill } = await render();
    fill('input[inputmode="decimal"]', '1000');
    fill('textarea', '  Absent  ');
    const before = (await firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries()))
      .length;
    button('Save').click();
    await settle(fixture);
    fixture.detectChanges();
    const entries = await firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries());
    expect(entries).toHaveSize(before + 1);
    expect(entries.at(-1)?.reason).toBe('Absent');
    expect(events.finished).toBe(1);
  });

  it('names the month in the confirmation only when the date is outside the month shown (AC-54)', async () => {
    const { fixture, button, fill } = await render();
    fixture.componentRef.setInput('month', '2026-09');
    fill('input[inputmode="decimal"]', '1000');
    fill('textarea', 'Absent');
    fill('input[type="date"]', '2026-08-10');
    button('Save').click();
    await settle(fixture);
    const message = TestBed.inject(NotificationService).current()?.message ?? '';
    expect(message).toContain('Nopay amount added for');
    expect(message).toContain('It applies to August 2026.');
  });

  it('does not name the month when the date is in the month shown', async () => {
    const { fixture, button, fill } = await render();
    fixture.componentRef.setInput('month', '2026-09');
    fill('input[inputmode="decimal"]', '1000');
    fill('textarea', 'Absent');
    button('Save').click();
    await settle(fixture);
    const message = TestBed.inject(NotificationService).current()?.message ?? '';
    expect(message).toContain('Nopay amount added for');
    expect(message).not.toContain('It applies to');
  });

  it('finishes with a warning for a Manager and saves nothing', async () => {
    const { fixture, events, button, fill } = await render(UserRole.MANAGER);
    const before = (await firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries()))
      .length;
    fill('input[inputmode="decimal"]', '1000');
    fill('textarea', 'Absent');
    button('Save').click();
    await settle(fixture);
    fixture.detectChanges();
    expect(events.finished).toBe(1);
    expect(
      (await firstValueFrom(TestBed.inject(PayrollDataService).getNopayEntries())).length
    ).toBe(before);
  });

  it('reports a cancel and disables Cancel while saving', async () => {
    const { fixture, events, button, fill } = await render();
    button('Cancel').click();
    expect(events.cancelled).toBe(1);
    fill('input[inputmode="decimal"]', '1000');
    fill('textarea', 'Absent');
    button('Save').click();
    fixture.detectChanges();
    expect(button('Cancel').disabled).toBeTrue();
    await settle(fixture);
  });
});
