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
import { ActualBalanceDialogComponent } from './actual-balance-dialog.component';

describe('ActualBalanceDialogComponent', () => {
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
    const fixture = TestBed.createComponent(ActualBalanceDialogComponent);
    fixture.componentRef.setInput('date', TEST_TODAY);
    fixture.componentRef.setInput('open', true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('#actual-balance-amount') as HTMLInputElement;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const save = async () => {
      const button = Array.from(element.querySelectorAll('button')).find(
        candidate => candidate.textContent?.trim() === 'Save actual balance'
      )!;
      button.click();
      await settle(fixture, 80);
    };
    return { fixture, element, type, save };
  }

  it('saves a valid amount, says so without the amount, and closes', async () => {
    const { fixture, type, save } = await render(UserRole.ADMIN);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));
    type('1500.25');
    await save();
    const report = await TestBed.inject(PosCashBookService).loadRange(TEST_TODAY, TEST_TODAY);
    expect(report.ok && report.report.ledger.actualBalanceCents).toBe(150_025);
    expect(TestBed.inject(NotificationService).current()?.message).toBe('Actual balance saved.');
    expect(closed).toBe(1);
  });

  it('shows a message for a bad amount and saves nothing', async () => {
    const { element, type, save } = await render(UserRole.ADMIN);
    for (const bad of ['', '-5', 'abc', '1.234']) {
      type(bad);
      await save();
      expect(element.querySelector('.field__error')).not.toBeNull();
    }
    const report = await TestBed.inject(PosCashBookService).loadRange(TEST_TODAY, TEST_TODAY);
    expect(report.ok && report.report.ledger.actualBalanceCents).toBeNull();
  });

  it('shows the Admin only message to a Cashier and saves nothing', async () => {
    const { element, type, save } = await render(UserRole.CASHIER);
    type('100');
    await save();
    expect(element.querySelector('.field__error')?.textContent).toContain('Only an Admin');
  });
});
