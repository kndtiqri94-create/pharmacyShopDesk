import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { closeOpenDialogs, settle } from '../../../../../testing/pos-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosPaymentComponent } from './pos-payment.component';

describe('PosPaymentComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    closeOpenDialogs();
    TestBed.inject(NotificationService).dismiss();
    clearBrowserStorage();
  });

  async function render() {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(UserRole.CASHIER);
    const pos = TestBed.inject(PosService);
    await pos.open();
    pos.addProduct('prod-001');
    pos.setQuantity('prod-001', '4');
    const fixture = TestBed.createComponent(PosPaymentComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tile = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.tile')).find(candidate =>
        candidate.textContent?.trim().startsWith(label)
      )!;
    const field = (id: string) => element.querySelector(`#${id}`) as HTMLInputElement;
    const type = (id: string, value: string) => {
      field(id).value = value;
      field(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const choose = (label: string) => {
      tile(label).click();
      fixture.detectChanges();
    };
    const clearButton = (name: string) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
    const text = (testId: string) =>
      element.querySelector(`[data-testid="${testId}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    return { fixture, element, tile, field, type, choose, clearButton, text, pos };
  }

  describe('methods', () => {
    it('offers exactly Cash, Card, Online and Credit, with no More option', async () => {
      const { element } = await render();
      const tiles = Array.from(element.querySelectorAll('.tile')).map(candidate =>
        candidate.getAttribute('aria-label')
      );
      expect(tiles).toEqual(['Cash F3', 'Card F4', 'Online F7', 'Credit']);
      const hints = Array.from(element.querySelectorAll('.tile__key')).map(
        hint => hint.textContent
      );
      expect(hints).toEqual(['F3', 'F4', 'F7']);
      expect(element.textContent).not.toContain('More');
    });

    it('selects Cash by default and marks the chosen method', async () => {
      const { choose, tile, pos } = await render();
      expect(pos.activePaymentMethod()).toBe('cash');
      expect(tile('Cash').classList).toContain('tile--active');
      choose('Card');
      expect(pos.activePaymentMethod()).toBe('card');
      expect(tile('Card').getAttribute('aria-pressed')).toBe('true');
      expect(tile('Cash').getAttribute('aria-pressed')).toBe('false');
      choose('Credit');
      expect(tile('Credit').getAttribute('aria-pressed')).toBe('true');
    });

    it('lets the till pick a method by code, as the function keys do', async () => {
      const { fixture, field, pos } = await render();
      fixture.componentInstance.selectMethod('online');
      await settle(fixture);
      expect(pos.activePaymentMethod()).toBe('online');
      expect(document.activeElement).toBe(field('pos-pay-online'));
    });

    it('has no on-screen keypad', async () => {
      const { element } = await render();
      expect(element.querySelector('app-pos-keypad')).toBeNull();
      expect(element.querySelector('[aria-label="Number keypad"]')).toBeNull();
    });

    it('makes every method tile at least 52px tall', async () => {
      const { element } = await render();
      for (const candidate of Array.from(element.querySelectorAll<HTMLElement>('.tile'))) {
        expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
      }
    });
  });

  describe('cash', () => {
    it('shows Cash Received and updates what is paid as the cashier types', async () => {
      const { element, type, text, pos } = await render();
      expect(element.querySelector('label[for="pos-pay-cash"]')?.textContent).toContain(
        'Cash Received'
      );
      type('pos-pay-cash', '6');
      expect(pos.totals().paidCents).toBe(600);
      expect(text('paid')).toBe('Rs. 6.00');
    });

    it('shows an error under an amount that is not a number', async () => {
      const { element, type } = await render();
      type('pos-pay-cash', 'abc');
      expect(element.querySelector('#pos-pay-cash-error')?.textContent).toContain(
        'Enter an amount like 100 or 100.50.'
      );
    });

    it('limits the length of the amount', async () => {
      const { field } = await render();
      expect(field('pos-pay-cash').getAttribute('maxlength')).toBe('12');
    });

    it('clears only that field, counts it as 0 and puts focus back in it', async () => {
      const { fixture, type, field, clearButton, pos } = await render();
      type('pos-pay-cash', '6');
      clearButton('Clear Cash Received').click();
      fixture.detectChanges();
      expect(pos.bill().payments.cash).toBe('');
      expect(pos.totals().paidCents).toBe(0);
      expect(document.activeElement).toBe(field('pos-pay-cash'));
    });
  });

  describe('card', () => {
    it('shows Paid and Last 4 No. with a clear button on each', async () => {
      const { element, choose, clearButton } = await render();
      choose('Card');
      expect(element.querySelector('label[for="pos-pay-card"]')?.textContent).toContain('Paid');
      expect(element.querySelector('label[for="pos-card-last4"]')?.textContent).toContain(
        'Last 4 No.'
      );
      expect(clearButton('Clear Paid')).not.toBeNull();
      expect(clearButton('Clear Last 4 No.')).not.toBeNull();
    });

    it('accepts only digits and no more than four in Last 4 No.', async () => {
      const { choose, type, field, pos } = await render();
      choose('Card');
      expect(field('pos-card-last4').getAttribute('maxlength')).toBe('4');
      type('pos-card-last4', '12ab345');
      expect(pos.bill().payments.cardLast4).toBe('1234');
      expect(field('pos-card-last4').value).toBe('1234');
    });

    it('shows a message beside Last 4 No. after a save is refused for a partial entry', async () => {
      const { fixture, element, choose, type, pos } = await render();
      choose('Card');
      type('pos-pay-card', '10');
      type('pos-card-last4', '12');
      await pos.saveBill();
      fixture.detectChanges();
      expect(element.querySelector('#pos-card-last4-error')?.textContent).toContain('4 digits');
    });

    it('clears Last 4 No. only', async () => {
      const { fixture, choose, type, field, clearButton, pos } = await render();
      choose('Card');
      type('pos-pay-card', '10');
      type('pos-card-last4', '1234');
      clearButton('Clear Last 4 No.').click();
      fixture.detectChanges();
      expect(pos.bill().payments.cardLast4).toBe('');
      expect(pos.bill().payments.card).toBe('10');
      expect(document.activeElement).toBe(field('pos-card-last4'));
    });
  });

  describe('online', () => {
    it('lists the three sample accounts as Bank - Account No (Holder Name), sorted by bank', async () => {
      const { element, choose } = await render();
      choose('Online');
      const options = Array.from(
        element.querySelectorAll<HTMLOptionElement>('#pos-pay-account option')
      )
        .slice(1)
        .map(option => option.textContent?.trim());
      expect(options).toEqual([
        'Bank of Ceylon - 0012345678 (ShopDesk Pharmacy)',
        'Commercial Bank of Ceylon - 8001234567 (ShopDesk Pharmacy)',
        'Sampath Bank - 1002345678 (ShopDesk Pharmacy)',
      ]);
    });

    it('shows Paid, Account with an info icon and a plus button, and a Note of up to 200 characters', async () => {
      const { element, choose, field, clearButton } = await render();
      choose('Online');
      expect(clearButton('Clear Paid')).not.toBeNull();
      expect(element.querySelector('.account__info app-icon')).not.toBeNull();
      expect(element.querySelector('button[aria-label="Add a new account"]')).not.toBeNull();
      expect(field('pos-online-note').getAttribute('maxlength')).toBe('200');
    });

    it('keeps the chosen account and note on the bill', async () => {
      const { fixture, choose, field, type, pos } = await render();
      choose('Online');
      const select = field('pos-pay-account') as unknown as HTMLSelectElement;
      select.value = 'bank-003';
      select.dispatchEvent(new Event('change'));
      type('pos-online-note', 'ref 12');
      fixture.detectChanges();
      expect(pos.bill().payments.onlineAccountId).toBe('bank-003');
      expect(pos.bill().payments.onlineNote).toBe('ref 12');
    });

    it('names the Account field when a save is refused without one', async () => {
      const { fixture, element, choose, type, pos } = await render();
      choose('Online');
      type('pos-pay-online', '10');
      const result = await pos.saveBill();
      fixture.detectChanges();
      expect(!result.ok && result.message).toContain('Account');
      expect(element.querySelector('#pos-pay-account-error')?.textContent).toContain('Account');
    });

    it('opens Create Account from the plus button and selects the new account', async () => {
      const { fixture, element, choose, pos } = await render();
      choose('Online');
      element.querySelector<HTMLButtonElement>('button[aria-label="Add a new account"]')!.click();
      await settle(fixture);
      const dialog = element.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.open).toBeTrue();
      const set = (id: string, value: string) => {
        const control = element.querySelector(`#${id}`) as HTMLInputElement;
        control.value = value;
        control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
      };
      set('create-account-bank', 'HSBC');
      set('create-account-branch', 'Kandy');
      set('create-account-holder', 'ShopDesk Pharmacy');
      set('create-account-number', '123456789');
      set('create-account-balance', '0');
      fixture.detectChanges();
      Array.from(dialog.querySelectorAll('button'))
        .find(button => button.textContent?.trim() === 'Save')!
        .click();
      await settle(fixture);
      expect(dialog.open).toBeFalse();
      const selected = pos.bill().payments.onlineAccountId;
      expect(selected).not.toBeNull();
      expect(
        (element.querySelector('#pos-pay-account') as unknown as HTMLSelectElement).value
      ).toBe(selected!);
    });
  });

  describe('credit', () => {
    it('shows a read-only credit amount and asks for a named customer for the Walk-in Customer', async () => {
      const { choose, field, element, pos } = await render();
      choose('Credit');
      expect(field('pos-credit-amount').readOnly).toBeTrue();
      expect(element.querySelector('[data-testid="credit-note"]')?.textContent).toContain(
        'named customer'
      );
      expect(pos.bill().payments.creditSelected).toBeFalse();
    });

    it('shows the unpaid amount as the credit amount for a named customer', async () => {
      const { fixture, choose, type, field, element, pos } = await render();
      pos.setCustomer('cus-002');
      type('pos-pay-cash', '3');
      choose('Card');
      type('pos-pay-card', '2');
      choose('Credit');
      fixture.detectChanges();
      expect(field('pos-credit-amount').value).toBe('5.00');
      expect(element.querySelector('[data-testid="credit-note"]')).toBeNull();
      expect(pos.bill().payments.creditSelected).toBeTrue();
    });
  });

  describe('split payment and Paid / Balance', () => {
    it('keeps amounts when switching methods and adds them up', async () => {
      const { choose, type, pos } = await render();
      type('pos-pay-cash', '6');
      choose('Card');
      type('pos-pay-card', '4');
      choose('Cash');
      expect(pos.bill().payments.cash).toBe('6');
      expect(pos.bill().payments.card).toBe('4');
      expect(pos.totals().paidCents).toBe(1000);
      expect(pos.totals().balanceKind).toBe('SETTLED');
    });

    it('keeps the Change and Credit due wording in the Paid / Balance box', async () => {
      const { choose, type, text, pos } = await render();
      type('pos-pay-cash', '12');
      expect(text('balance-label')).toBe('Change');
      expect(text('balance')).toBe('Rs. 2.00');
      pos.setCustomer('cus-002');
      type('pos-pay-cash', '3');
      choose('Credit');
      expect(text('balance-label')).toBe('Credit due');
      expect(text('balance')).toBe('Rs. 7.00');
    });
  });
});
