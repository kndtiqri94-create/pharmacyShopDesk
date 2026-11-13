import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../../testing/auth-test.util';
import { TEST_TODAY, closeOpenDialogs, settle } from '../../../../../../testing/pos-test.util';
import { UserRole } from '../../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../../core/services/notification.service';
import { PosCashBookService } from '../../../../../core/services/pos-cash-book.service';
import { AdjustmentDialogComponent } from './adjustment-dialog.component';

describe('AdjustmentDialogComponent', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(role: UserRole) {
    await signInAs(role);
    const fixture = TestBed.createComponent(AdjustmentDialogComponent);
    fixture.componentRef.setInput('date', TEST_TODAY);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const control = element.querySelector(selector) as HTMLInputElement;
      control.value = value;
      control.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const save = async () => {
      const button = Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === 'Save adjustment'
      )!;
      button.click();
      await settle(fixture, 80);
    };
    const adjustmentsCredit = async () => {
      const result = await TestBed.inject(PosCashBookService).loadRange(TEST_TODAY, TEST_TODAY);
      return result.ok ? result.report.ledger.rows[11].creditCents : -1;
    };
    return { fixture, element, type, save, adjustmentsCredit };
  }

  it('saves a signed amount with a note', async () => {
    const { fixture, type, save, adjustmentsCredit } = await render(UserRole.ADMIN);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    type('#adjustment-amount', '75');
    type('#adjustment-note', 'Float top up');
    await save();
    expect(await adjustmentsCredit()).toBe(7_500);
    expect(TestBed.inject(NotificationService).current()?.message).toBe('Adjustment saved.');
    expect(closed).toBe(1);
  });

  it('asks for a note and saves nothing without one', async () => {
    const { element, type, save, adjustmentsCredit } = await render(UserRole.ADMIN);
    type('#adjustment-amount', '75');
    await save();
    expect(element.querySelector('#adjustment-note-error')).not.toBeNull();
    expect(await adjustmentsCredit()).toBe(0);
  });

  it('rejects a non numeric or zero amount on the amount field', async () => {
    const { element, type, save, adjustmentsCredit } = await render(UserRole.ADMIN);
    for (const bad of ['abc', '0', '']) {
      type('#adjustment-amount', bad);
      type('#adjustment-note', 'note');
      await save();
      expect(element.querySelector('#adjustment-amount-error')).not.toBeNull();
    }
    expect(await adjustmentsCredit()).toBe(0);
  });

  it('refuses a non Admin', async () => {
    const { element, type, save, adjustmentsCredit } = await render(UserRole.MANAGER);
    type('#adjustment-amount', '75');
    type('#adjustment-note', 'note');
    await save();
    expect(element.querySelector('app-alert')?.textContent).toContain('Only an Admin');
    expect(await adjustmentsCredit()).toBe(0);
  });
});
