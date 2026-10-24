import { TestBed } from '@angular/core/testing';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { PosPaymentComponent } from './pos-payment.component';

describe('PosPaymentComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
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
    const key = (label: string) =>
      element.querySelector<HTMLButtonElement>(`.keypad__key[aria-label="${label}"]`)!;
    const field = (id: string) => element.querySelector(`#${id}`) as HTMLInputElement;
    const type = (id: string, value: string) => {
      field(id).value = value;
      field(id).dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const message = () => TestBed.inject(NotificationService).current()?.message;
    return { fixture, element, tile, key, field, type, pos, message };
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

    it('selects Cash by default and moves the keypad target with the chosen method', async () => {
      const { fixture, element, tile, pos } = await render();
      expect(pos.activePaymentField()).toBe('cash');
      expect(element.querySelector('.keypad__target')?.textContent).toContain('Cash received');
      tile('Card').click();
      fixture.detectChanges();
      expect(pos.activePaymentField()).toBe('card');
      expect(tile('Card').getAttribute('aria-pressed')).toBe('true');
      expect(tile('Cash').getAttribute('aria-pressed')).toBe('false');
      expect(element.querySelector('.keypad__target')?.textContent).toContain('Card amount');
      tile('Online').click();
      fixture.detectChanges();
      expect(element.querySelector('.keypad__target')?.textContent).toContain('Online amount');
    });

    it('lets the till pick a method by code, as the function keys do', async () => {
      const { fixture, field, pos } = await render();
      fixture.componentInstance.selectMethod('online');
      fixture.detectChanges();
      expect(pos.activePaymentField()).toBe('online');
      expect(document.activeElement).toBe(field('pos-pay-online'));
    });
  });

  describe('amounts', () => {
    it('updates what is paid as the cashier types', async () => {
      const { type, pos } = await render();
      type('pos-pay-cash', '6');
      type('pos-pay-card', '4');
      expect(pos.totals().paidCents).toBe(1000);
      expect(pos.totals().balanceKind).toBe('SETTLED');
    });

    it('points the keypad at the field that was clicked into', async () => {
      const { fixture, field, pos } = await render();
      field('pos-pay-online').dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      expect(pos.activePaymentField()).toBe('online');
    });

    it('shows an error under an amount that is not a number', async () => {
      const { element, type } = await render();
      type('pos-pay-cash', 'abc');
      expect(element.querySelector('#pos-pay-cash-error')?.textContent).toContain(
        'Enter an amount like 100 or 100.50.'
      );
    });

    it('keeps an optional reference for Card and Online', async () => {
      const { type, pos } = await render();
      type('pos-ref-card', 'AUTH-77');
      type('pos-ref-online', 'TXN-9');
      expect(pos.bill().payments.cardReference).toBe('AUTH-77');
      expect(pos.bill().payments.onlineReference).toBe('TXN-9');
    });

    it('limits the length of every amount and reference', async () => {
      const { field } = await render();
      expect(field('pos-pay-cash').getAttribute('maxlength')).toBe('12');
      expect(field('pos-ref-card').getAttribute('maxlength')).toBe('40');
    });
  });

  describe('credit', () => {
    it('is blocked for the Walk-in Customer with a message asking for a named customer', async () => {
      const { fixture, tile, pos, message } = await render();
      tile('Credit').click();
      fixture.detectChanges();
      expect(pos.bill().payments.creditSelected).toBeFalse();
      expect(tile('Credit').getAttribute('aria-pressed')).toBe('false');
      expect(message()).toContain('named customer');
    });

    it('shows Credit due for a named customer and can be switched off again', async () => {
      const { fixture, element, tile, type, pos } = await render();
      pos.setCustomer('cus-002');
      type('pos-pay-cash', '3');
      tile('Credit').click();
      fixture.detectChanges();
      expect(tile('Credit').getAttribute('aria-pressed')).toBe('true');
      expect(element.querySelector('[data-testid="credit-note"]')?.textContent).toContain(
        'Credit due Rs. 7.00'
      );
      expect(element.querySelector('[data-testid="credit-note"]')?.textContent).toContain(
        'Sunil Rathnayake'
      );
      tile('Credit').click();
      fixture.detectChanges();
      expect(element.querySelector('[data-testid="credit-note"]')).toBeNull();
    });
  });

  describe('keypad', () => {
    it('types digits into Cash received by default and shows them in the field', async () => {
      const { fixture, key, field } = await render();
      key('1').click();
      key('2').click();
      fixture.detectChanges();
      expect(field('pos-pay-cash').value).toBe('12');
    });

    it('accepts one decimal point and two decimal places only', async () => {
      const { fixture, key, pos } = await render();
      for (const label of ['1', 'Decimal point', '5', 'Decimal point', '7', '9']) {
        key(label).click();
      }
      fixture.detectChanges();
      expect(pos.bill().payments.cash).toBe('1.57');
    });

    it('deletes with Backspace and types into the chosen field', async () => {
      const { fixture, key, tile, pos } = await render();
      tile('Card').click();
      key('4').click();
      key('5').click();
      key('Backspace').click();
      fixture.detectChanges();
      expect(pos.bill().payments.card).toBe('4');
      expect(pos.bill().payments.cash).toBe('');
    });

    it('has exactly the digits, the decimal point and Backspace', async () => {
      const { element } = await render();
      const labels = Array.from(element.querySelectorAll('.keypad__key')).map(candidate =>
        candidate.getAttribute('aria-label')
      );
      expect([...labels].sort()).toEqual(
        ['.', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace']
          .map(label => (label === '.' ? 'Decimal point' : label))
          .sort()
      );
    });

    it('makes every key at least 52px tall', async () => {
      const { element } = await render();
      const keys = Array.from(element.querySelectorAll<HTMLElement>('.keypad__key'));
      expect(keys).toHaveSize(12);
      for (const candidate of keys) {
        expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
      }
    });

    it('makes every method tile at least 52px tall', async () => {
      const { element } = await render();
      for (const candidate of Array.from(element.querySelectorAll<HTMLElement>('.tile'))) {
        expect(parseFloat(getComputedStyle(candidate).minHeight)).toBeGreaterThanOrEqual(52);
      }
    });
  });
});
