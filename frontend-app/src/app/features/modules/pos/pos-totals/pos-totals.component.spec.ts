import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { SettingsDataService } from '../../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosDiscountApprovalService } from '../../../../core/services/pos-discount-approval.service';
import { PosService } from '../../../../core/services/pos.service';
import { PendingApproval } from '../pending-approval.model';
import { PosTotalsComponent } from './pos-totals.component';

describe('PosTotalsComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render(options: { billDiscountOff?: boolean } = {}) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    if (options.billDiscountOff) {
      const settingsDataService = TestBed.inject(SettingsDataService);
      const current = await firstValueFrom(settingsDataService.get());
      await firstValueFrom(settingsDataService.save({ ...current, posBillDiscountEnabled: false }));
    }
    const pos = TestBed.inject(PosService);
    await pos.open();
    pos.addProduct('prod-001');
    pos.setQuantity('prod-001', '4');
    const fixture = TestBed.createComponent(PosTotalsComponent);
    const approvals: PendingApproval[] = [];
    fixture.componentInstance.approvalRequested.subscribe(request => approvals.push(request));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const read = (testId: string) =>
      element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    const amountInput = () => element.querySelector('#pos-discount-amount') as HTMLInputElement;
    const percentInput = () => element.querySelector('#pos-discount-percent') as HTMLInputElement;
    const change = (target: HTMLInputElement, value: string) => {
      target.value = value;
      target.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const message = () => TestBed.inject(NotificationService).current()?.message;
    return { fixture, element, read, amountInput, percentInput, change, approvals, pos, message };
  }

  it('shows No. of items, Sub total, Total, Paid and Balance for the bill', async () => {
    const { read } = await render();
    expect(read('item-count')).toBe('1');
    expect(read('sub-total')).toBe('Rs. 10.00');
    expect(read('total')).toBe('Rs. 10.00');
    expect(read('paid')).toBe('Rs. 0.00');
    expect(read('balance-label')).toBe('Amount due');
    expect(read('balance')).toBe('Rs. 10.00');
  });

  it('updates as soon as the lines change', async () => {
    const { fixture, read, pos } = await render();
    pos.addProduct('prod-007');
    fixture.detectChanges();
    expect(read('item-count')).toBe('2');
    expect(read('sub-total')).toBe('Rs. 460.00');
    pos.removeLine('prod-007');
    fixture.detectChanges();
    expect(read('sub-total')).toBe('Rs. 10.00');
  });

  describe('balance', () => {
    it('is labelled Change, in words, when cash is more than the amount due', async () => {
      const { fixture, read, pos } = await render();
      pos.setPaymentText('cash', '12');
      fixture.detectChanges();
      expect(read('balance-label')).toBe('Change');
      expect(read('balance')).toBe('Rs. 2.00');
      expect(read('paid')).toBe('Rs. 12.00');
    });

    it('is labelled Credit due, in words, when Credit covers the rest for a named customer', async () => {
      const { fixture, read, pos } = await render();
      pos.setCustomer('cus-002');
      pos.setPaymentText('cash', '3');
      pos.setCredit(true);
      fixture.detectChanges();
      expect(read('balance-label')).toBe('Credit due');
      expect(read('balance')).toBe('Rs. 7.00');
      expect(read('paid')).toBe('Rs. 3.00');
    });

    it('is zero when paid in full across methods', async () => {
      const { fixture, read, pos } = await render();
      pos.setPaymentText('cash', '6');
      pos.setPaymentText('card', '4');
      fixture.detectChanges();
      expect(read('paid')).toBe('Rs. 10.00');
      expect(read('balance')).toBe('Rs. 0.00');
    });
  });

  describe('bill discount', () => {
    it('starts at the Settings default in both Rs. and %', async () => {
      const { amountInput, percentInput } = await render();
      expect(amountInput().value).toBe('0.00');
      expect(percentInput().value).toBe('0');
      expect(amountInput().disabled).toBeFalse();
    });

    it('asks for approval for a percentage and keeps the old value meanwhile', async () => {
      const { change, percentInput, approvals, pos } = await render();
      change(percentInput(), '5');
      expect(approvals).toEqual([
        {
          request: { scope: 'BILL', productId: null, percent: 5 },
          billInput: { mode: 'PERCENT', percent: 5 },
        },
      ]);
      expect(percentInput().value).toBe('0');
      expect(pos.totals().discountCents).toBe(0);
    });

    it('asks for approval for an amount, with the matching percentage', async () => {
      const { change, amountInput, approvals } = await render();
      change(amountInput(), '1');
      expect(approvals[0].request.percent).toBe(10);
      expect(approvals[0].billInput).toEqual({ mode: 'AMOUNT', cents: 100 });
    });

    it('shows Rs. and % linked after an approved change, in both directions', async () => {
      const { fixture, amountInput, percentInput, read, pos } = await render();
      const approvalService = TestBed.inject(PosDiscountApprovalService);
      const byPercent = await approvalService.approve(
        { scope: 'BILL', productId: null, percent: 10 },
        'nimal',
        'Owner@2026'
      );
      if (!byPercent.ok) throw new Error('Expected an approval');
      pos.setBillDiscount({ mode: 'PERCENT', percent: 10 }, byPercent.approval);
      fixture.detectChanges();
      expect(amountInput().value).toBe('1.00');
      expect(percentInput().value).toBe('10');
      expect(read('total')).toBe('Rs. 9.00');
      const byAmount = await approvalService.approve(
        { scope: 'BILL', productId: null, percent: 5 },
        'nimal',
        'Owner@2026'
      );
      if (!byAmount.ok) throw new Error('Expected an approval');
      pos.setBillDiscount({ mode: 'AMOUNT', cents: 50 }, byAmount.approval);
      fixture.detectChanges();
      expect(amountInput().value).toBe('0.50');
      expect(percentInput().value).toBe('5');
    });

    it('refuses a percentage above the maximum with a message and no approval request', async () => {
      const { change, percentInput, approvals, message } = await render();
      change(percentInput(), '25');
      expect(approvals).toHaveSize(0);
      expect(message()).toContain('20%');
      expect(percentInput().value).toBe('0');
    });

    it('refuses an amount above the sub total with a message and no approval request', async () => {
      const { change, amountInput, approvals, message } = await render();
      change(amountInput(), '10.01');
      expect(approvals).toHaveSize(0);
      expect(message()).toContain('sub total');
      expect(amountInput().value).toBe('0.00');
    });

    it('cannot be edited when bill discount is off in Settings', async () => {
      const { amountInput, percentInput } = await render({ billDiscountOff: true });
      expect(amountInput().disabled).toBeTrue();
      expect(percentInput().disabled).toBeTrue();
    });

    it('limits how much can be typed in each field', async () => {
      const { amountInput, percentInput } = await render();
      expect(amountInput().getAttribute('maxlength')).toBe('12');
      expect(percentInput().getAttribute('maxlength')).toBe('6');
    });
  });
});
