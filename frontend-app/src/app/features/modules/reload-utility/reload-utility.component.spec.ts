import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { ReloadDataService } from '../../../core/services/data/reload-data.service';
import { SettingsDataService } from '../../../core/services/data/settings-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ReloadService } from '../../../core/services/reload.service';
import { ReloadUtilityComponent } from './reload-utility.component';

describe('ReloadUtilityComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  interface Detectable {
    detectChanges(): void;
  }

  async function settle(fixture: Detectable): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  async function render(role: UserRole = UserRole.CASHIER) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(ReloadUtilityComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const buttonByText = (scope: ParentNode, text: string) =>
    Array.from(scope.querySelectorAll('button')).find(item => item.textContent?.trim() === text) as
      HTMLButtonElement | undefined;
  const text = (scope: ParentNode, selector: string) =>
    scope.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const notification = () => TestBed.inject(NotificationService).current();
  const rows = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('app-recent-transactions tbody tr')).map(
      row => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    );

  function type(fixture: Detectable, input: HTMLInputElement | HTMLSelectElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  }

  const field = <T extends HTMLElement>(element: HTMLElement, id: string) =>
    element.querySelector(`#${id}`) as T;

  async function sendReload(
    fixture: Detectable & { nativeElement: HTMLElement },
    details: { operator?: number; mobile?: string; amountChip?: string; name?: string } = {}
  ) {
    const element = fixture.nativeElement;
    const radios = element.querySelectorAll<HTMLInputElement>('app-operator-tiles input');
    radios[details.operator ?? 0].click();
    fixture.detectChanges();
    type(fixture, field(element, 'reload-mobile'), details.mobile ?? '77 123 4567');
    if (details.name !== undefined)
      type(fixture, field(element, 'reload-customer-name'), details.name);
    buttonByText(element.querySelector('app-chips')!, details.amountChip ?? 'Rs. 500')!.click();
    fixture.detectChanges();
    buttonByText(element, 'Send reload')!.click();
    fixture.detectChanges();
    await settle(fixture);
  }

  describe('page', () => {
    it('shows the heading, the subtitle, Statement and one primary Top up float', async () => {
      const { element } = await render();
      expect(text(element, 'h1')).toBe('Reload & utility');
      expect(text(element, 'app-page-header')).toContain(
        'Sell mobile reloads and take bill payments at the counter.'
      );
      const header = element.querySelector('app-page-header')!;
      expect(buttonByText(header, 'Statement')).toBeDefined();
      const topUp = buttonByText(header, 'Top up float')!;
      expect(topUp.getAttribute('data-variant')).toBe('primary');
    });

    it('answers Statement and Export with a sample-only message and changes nothing', async () => {
      const { fixture, element } = await render();
      const before = rows(element);
      buttonByText(element, 'Statement')!.click();
      expect(notification()?.message).toBe(
        'Statement is sample only for now and does nothing yet.'
      );
      buttonByText(element, 'Export')!.click();
      expect(notification()?.message).toBe('Export is sample only for now and does nothing yet.');
      await settle(fixture);
      expect(rows(element)).toEqual(before);
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
    });
  });

  describe('mobile reload', () => {
    it('shows four operator tiles, the number with +94, an optional name, amount chips, the preview and the buttons', async () => {
      const { element } = await render();
      const card = element.querySelector('app-mobile-reload-card')!;
      expect(text(card, 'h2')).toBe('Mobile reload');
      expect(
        Array.from(card.querySelectorAll('.tile__name')).map(tile => tile.textContent)
      ).toEqual(['Dialog', 'Mobitel', 'Hutch', 'Airtel']);
      expect(text(card, '[for="reload-mobile"]')).toContain('Mobile number');
      expect(card.querySelector('[for="reload-mobile"] .field__required')).not.toBeNull();
      expect(card.textContent).toContain('+94');
      expect(text(card, '[for="reload-customer-name"]')).toBe('Customer name');
      expect(card.querySelector('[for="reload-customer-name"] .field__required')).toBeNull();
      const chips = Array.from(card.querySelectorAll('app-chips button')).map(chip =>
        chip.textContent?.trim()
      );
      expect(chips).toEqual(['Rs. 50', 'Rs. 100', 'Rs. 200', 'Rs. 500', 'Rs. 1,000', 'Other']);
      expect(card.textContent).toContain('Commission you earn');
      expect(card.textContent).toContain('Customer pays');
      expect(buttonByText(card, 'Clear')).toBeDefined();
      expect(buttonByText(card, 'Send reload')?.getAttribute('data-variant')).toBe('primary');
    });

    it('lets one operator be chosen at a time, by keyboard as well as pointer', async () => {
      const { fixture, element } = await render();
      const radios = Array.from(
        element.querySelectorAll<HTMLInputElement>('app-operator-tiles input')
      );
      expect(radios.every(radio => radio.type === 'radio' && !radio.disabled)).toBeTrue();
      radios[2].focus();
      radios[2].click();
      fixture.detectChanges();
      radios[0].click();
      fixture.detectChanges();
      expect(radios.filter(radio => radio.checked)).toHaveSize(1);
      expect(element.querySelector('.tile--selected')?.textContent).toContain('Dialog');
    });

    it('shows Rs. 0.00 for both before an amount is chosen and follows chips and typing', async () => {
      const { fixture, element } = await render();
      const amountText = () => ({
        commission: text(element, '[data-testid="commission-preview"]'),
        pays: text(element, '[data-testid="customer-pays"]'),
      });
      expect(amountText()).toEqual({ commission: 'Rs. 0.00 (2.5%)', pays: 'Rs. 0.00' });
      const chips = element.querySelector('app-chips')!;
      buttonByText(chips, 'Rs. 500')!.click();
      fixture.detectChanges();
      expect(amountText()).toEqual({ commission: 'Rs. 12.50 (2.5%)', pays: 'Rs. 500.00' });
      expect(buttonByText(chips, 'Rs. 500')?.getAttribute('aria-pressed')).toBe('true');
      buttonByText(chips, 'Rs. 100')!.click();
      fixture.detectChanges();
      expect(buttonByText(chips, 'Rs. 500')?.getAttribute('aria-pressed')).toBe('false');
      expect(field<HTMLInputElement>(element, 'reload-amount').value).toBe('100');

      buttonByText(chips, 'Other')!.click();
      fixture.detectChanges();
      const amount = field<HTMLInputElement>(element, 'reload-amount');
      expect(amount.readOnly).toBeFalse();
      expect(document.activeElement).toBe(amount);
      type(fixture, amount, '250.50');
      expect(amountText()).toEqual({ commission: 'Rs. 6.26 (2.5%)', pays: 'Rs. 250.50' });
      type(fixture, amount, 'abc');
      expect(amountText()).toEqual({ commission: 'Rs. 0.00 (2.5%)', pays: 'Rs. 0.00' });
    });

    it('keeps the amount box read-only while a ready-made amount is chosen', async () => {
      const { fixture, element } = await render();
      buttonByText(element.querySelector('app-chips')!, 'Rs. 200')!.click();
      fixture.detectChanges();
      expect(field<HTMLInputElement>(element, 'reload-amount').readOnly).toBeTrue();
    });

    it('Clear empties the form and changes no transaction or float', async () => {
      const { fixture, element } = await render();
      const before = rows(element);
      element.querySelectorAll<HTMLInputElement>('app-operator-tiles input')[1].click();
      type(fixture, field(element, 'reload-mobile'), '77 123 4567');
      type(fixture, field(element, 'reload-customer-name'), 'Kasun');
      buttonByText(element.querySelector('app-chips')!, 'Rs. 500')!.click();
      fixture.detectChanges();
      buttonByText(element, 'Clear')!.click();
      fixture.detectChanges();
      expect(element.querySelector('app-operator-tiles input:checked')).toBeNull();
      expect(field<HTMLInputElement>(element, 'reload-mobile').value).toBe('');
      expect(field<HTMLInputElement>(element, 'reload-customer-name').value).toBe('');
      expect(field<HTMLInputElement>(element, 'reload-amount').value).toBe('');
      expect(text(element, '[data-testid="customer-pays"]')).toBe('Rs. 0.00');
      expect(rows(element)).toEqual(before);
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
    });

    it('sends nothing and shows what to fix, focusing the first problem', async () => {
      const { fixture, element } = await render();
      const before = rows(element);
      buttonByText(element, 'Send reload')!.click();
      fixture.detectChanges();
      await settle(fixture);
      const card = element.querySelector('app-mobile-reload-card')!;
      expect(text(card, '[role=alert]')).toBe('Choose the operator');
      expect(text(card, '#reload-mobile-error')).toContain('Enter the mobile number');
      expect(text(card, '#reload-amount-error')).toBe('Enter the amount');
      expect(document.activeElement).toBe(card.querySelector('#reload-operator'));
      expect(rows(element)).toEqual(before);

      element.querySelectorAll<HTMLInputElement>('app-operator-tiles input')[0].click();
      fixture.detectChanges();
      expect(card.querySelector('app-operator-tiles [role=alert]')).toBeNull();
      buttonByText(element, 'Send reload')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(document.activeElement).toBe(field(element, 'reload-mobile'));
    });

    it('refuses an amount above the available float and each wrong number', async () => {
      const { fixture, element } = await render();
      const card = element.querySelector('app-mobile-reload-card')!;
      element.querySelectorAll<HTMLInputElement>('app-operator-tiles input')[0].click();
      buttonByText(card, 'Other')!.click();
      fixture.detectChanges();
      for (const [mobile, amount, expected] of [
        ['77 123', '100', 'Enter the 9 digits'],
        ['77 abc 4567', '100', 'Use digits only'],
        ['77 123 4567', '6200.01', 'The amount can be at most Rs. 6,200'],
        ['77 123 4567', '-5', 'Enter an amount above zero'],
        ['77 123 4567', '0', 'Enter an amount above zero'],
        ['77 123 4567', '1e3', 'Enter the amount as a number'],
      ]) {
        type(fixture, field(element, 'reload-mobile'), mobile);
        type(fixture, field(element, 'reload-amount'), amount);
        buttonByText(element, 'Send reload')!.click();
        fixture.detectChanges();
        await settle(fixture);
        expect(card.textContent).withContext(`${mobile} ${amount}`).toContain(expected);
      }
      expect(text(element, '[data-testid="reloads-today"]')).toBe('38');
    });

    it('sends a valid reload: confirmation, cleared form, new Success row on top and updated float', async () => {
      const { fixture, element } = await render();
      await sendReload(fixture, { name: 'Kasun' });
      expect(notification()?.tone).toBe('success');
      expect(notification()?.message).toBe(
        'Reload of Rs. 500.00 sent on Dialog. You earned Rs. 12.50.'
      );
      expect(field<HTMLInputElement>(element, 'reload-mobile').value).toBe('');
      expect(field<HTMLInputElement>(element, 'reload-customer-name').value).toBe('');
      expect(element.querySelector('app-operator-tiles input:checked')).toBeNull();
      const list = rows(element);
      expect(list).toHaveSize(6);
      expect(list[0]).toContain('Dialog');
      expect(list[0]).toContain('Reload');
      expect(list[0]).toContain('077 123 4567');
      expect(list[0]).toContain('500.00');
      expect(list[0]).toContain('12.50');
      expect(list[0]).toContain('Success');
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 5,700');
      expect(text(element, '[data-testid="reloads-today"]')).toBe('39');
      expect(text(element, '[data-testid="commission-today"]')).toBe('Rs. 1,252.50');
      expect(text(element, '[data-testid="bills-today"]')).toBe('9');
    });

    it('never puts the mobile number in the confirmation', async () => {
      const { fixture } = await render();
      await sendReload(fixture);
      expect(notification()?.message).not.toContain('077');
      expect(notification()?.message).not.toContain('123');
    });

    it('still sends when the customer name is left empty', async () => {
      const { fixture, element } = await render();
      await sendReload(fixture, { amountChip: 'Rs. 100' });
      expect(rows(element)).toHaveSize(6);
    });
  });

  describe('reload float', () => {
    it('shows the first-time figures and the warning with the level from Settings', async () => {
      const { element } = await render();
      const card = element.querySelector('app-reload-float-card')!;
      expect(text(card, '[data-testid="available-float"]')).toBe('Rs. 6,200');
      expect(text(card, '[data-testid="reloads-today"]')).toBe('38');
      expect(text(card, '[data-testid="bills-today"]')).toBe('9');
      expect(text(card, '[data-testid="commission-today"]')).toBe('Rs. 1,240.00');
      expect(text(card, 'app-alert')).toBe(
        'Float is below Rs. 10,000. Top up before the evening rush.'
      );
      expect(card.querySelector('progress')).not.toBeNull();
    });

    it('shows no warning when the saved level is at or below the float', async () => {
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      const settings = TestBed.inject(SettingsDataService);
      await firstValueFrom(
        settings.save({ ...(await firstValueFrom(settings.get())), lowFloatCents: 620_000 })
      );
      await signInAs(UserRole.CASHIER);
      const fixture = TestBed.createComponent(ReloadUtilityComponent);
      fixture.detectChanges();
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('app-reload-float-card app-alert')).toBeNull();
    });
  });

  describe('top up float', () => {
    const dialog = (element: HTMLElement) =>
      element.querySelector('app-top-up-dialog dialog') as HTMLDialogElement;
    const openDialog = async (fixture: Detectable, element: HTMLElement) => {
      buttonByText(element.querySelector('app-page-header')!, 'Top up float')!.click();
      fixture.detectChanges();
      await settle(fixture);
    };

    it('asks for an amount with a way to confirm and a way to cancel', async () => {
      const { fixture, element } = await render();
      expect(dialog(element).open).toBeFalse();
      await openDialog(fixture, element);
      expect(dialog(element).open).toBeTrue();
      expect(buttonByText(dialog(element), 'Cancel')).toBeDefined();
      expect(buttonByText(dialog(element), 'Top up float')).toBeDefined();
      expect(field(element, 'top-up-amount')).not.toBeNull();
    });

    it('adds nothing and says what to fix for a wrong amount', async () => {
      const { fixture, element } = await render();
      await openDialog(fixture, element);
      for (const value of ['', 'abc', '0', '-5', '10.5', '1000001']) {
        type(fixture, field(element, 'top-up-amount'), value);
        buttonByText(dialog(element), 'Top up float')!.click();
        fixture.detectChanges();
        expect(dialog(element).querySelector('.field__error')).withContext(value).not.toBeNull();
      }
      expect(dialog(element).open).toBeTrue();
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
    });

    it('raises the float by exactly the amount and updates the card, the bar and the warning', async () => {
      const { fixture, element } = await render();
      await openDialog(fixture, element);
      type(fixture, field(element, 'top-up-amount'), '3000');
      buttonByText(dialog(element), 'Top up float')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(dialog(element).open).toBeFalse();
      expect(notification()?.message).toBe(
        'Float topped up by Rs. 3,000. Available float is now Rs. 9,200.'
      );
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 9,200');
      expect((element.querySelector('progress') as HTMLProgressElement).value).toBe(920_000);
      expect(element.querySelector('app-reload-float-card app-alert')).not.toBeNull();
      expect(rows(element)).toHaveSize(5);

      await openDialog(fixture, element);
      type(fixture, field(element, 'top-up-amount'), '1000');
      buttonByText(dialog(element), 'Top up float')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 10,200');
      expect(element.querySelector('app-reload-float-card app-alert')).toBeNull();
    });

    it('changes nothing when cancelled', async () => {
      const { fixture, element } = await render();
      await openDialog(fixture, element);
      type(fixture, field(element, 'top-up-amount'), '3000');
      buttonByText(dialog(element), 'Cancel')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(dialog(element).open).toBeFalse();
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
      expect(notification()).toBeNull();
    });
  });

  describe('bill payment', () => {
    const card = (element: HTMLElement) => element.querySelector('app-bill-payment-card')!;

    it('shows provider, account, amount, the fee hint and a Pay bill button', async () => {
      const { element } = await render();
      expect(text(card(element), 'h2')).toBe('Bill payment');
      const options = Array.from(card(element).querySelectorAll('option')).map(option =>
        option.textContent?.trim()
      );
      expect(options).toEqual([
        'Choose a provider',
        'Electricity (CEB)',
        'Water (NWSDB)',
        'Telephone (SLT)',
        'Internet',
      ]);
      expect(text(card(element), '[for="bill-account"]')).toContain('Account number');
      expect(text(card(element), '[for="bill-amount"]')).toContain('Amount (Rs.)');
      expect(text(card(element), '[data-testid="bill-fee-hint"]')).toBe(
        'Service fee Rs. 25.00 added at the counter.'
      );
      expect(buttonByText(card(element), 'Pay bill')?.getAttribute('data-variant')).toBe('default');
    });

    it('pays nothing and shows what to fix', async () => {
      const { fixture, element } = await render();
      buttonByText(card(element), 'Pay bill')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(text(card(element), '#bill-provider-error')).toBe('Choose the provider');
      expect(text(card(element), '#bill-account-error')).toBe('Enter the account number');
      expect(text(card(element), '#bill-amount-error')).toBe('Enter the amount');
      expect(document.activeElement).toBe(field(element, 'bill-provider'));
      expect(rows(element)).toHaveSize(5);
      expect(text(element, '[data-testid="bills-today"]')).toBe('9');
    });

    it('pays a bill: total in the confirmation, cleared fields, new row, one more bill and nothing else changes', async () => {
      const { fixture, element } = await render();
      type(fixture, field<HTMLSelectElement>(element, 'bill-provider'), 'Water (NWSDB)');
      type(fixture, field(element, 'bill-account'), 'ACC-77');
      type(fixture, field(element, 'bill-amount'), '1000');
      buttonByText(card(element), 'Pay bill')!.click();
      fixture.detectChanges();
      await settle(fixture);
      expect(notification()?.message).toBe('Bill paid. The customer pays Rs. 1,025.00.');
      expect(notification()?.message).not.toContain('ACC-77');
      expect(field<HTMLInputElement>(element, 'bill-account').value).toBe('');
      expect(field<HTMLInputElement>(element, 'bill-amount').value).toBe('');
      expect(field<HTMLSelectElement>(element, 'bill-provider').value).toBe('');
      const list = rows(element);
      expect(list).toHaveSize(6);
      expect(list[0]).toContain('Water (NWSDB)');
      expect(list[0]).toContain('Bill payment');
      expect(list[0]).toContain('Account ACC-77');
      expect(list[0]).toContain('1,000.00');
      expect(list[0]).toContain('Success');
      expect(text(element, '[data-testid="bills-today"]')).toBe('10');
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
      expect(text(element, '[data-testid="reloads-today"]')).toBe('38');
      expect(text(element, '[data-testid="commission-today"]')).toBe('Rs. 1,240.00');
    });
  });

  describe('recent transactions', () => {
    it('has the right columns, money right-aligned with two decimals, and status words', async () => {
      const { element } = await render();
      const table = element.querySelector('app-recent-transactions')!;
      expect(text(table, 'h2')).toBe('Recent transactions');
      expect(
        Array.from(table.querySelectorAll('th')).map(cell => cell.textContent?.trim())
      ).toEqual([
        'Time',
        'Provider',
        'Number or account',
        'Amount (Rs.)',
        'Commission (Rs.)',
        'Status',
      ]);
      expect(buttonByText(table, 'Export')).toBeDefined();
      const list = rows(element);
      expect(list).toHaveSize(5);
      expect(list[0]).toContain('Airtel');
      expect(list[0]).toContain('Failed');
      expect(list[4]).toContain('Dialog');
      expect(list.join(' ')).toContain('Success');
      expect(list.join(' ')).toContain('Pending');
      expect(list.join(' ')).toContain('Failed');
      const moneyCells = table.querySelectorAll('td.is-right');
      expect(moneyCells.length).toBeGreaterThan(0);
      expect(list[0]).toContain('1,000.00');
      expect(list[0]).toContain('25.00');
    });

    it('lists newest first and keeps Pending and Failed rows', async () => {
      const { element } = await render();
      const times = Array.from(
        element.querySelectorAll('app-recent-transactions tbody tr td:first-child')
      ).map(cell => cell.textContent?.replace('Time', '').trim());
      expect(times).toEqual(['10:52', '10:30', '10:05', '09:40', '09:12']);
    });

    it('pages only above 10 rows', async () => {
      const { element } = await render();
      expect(element.querySelector('app-recent-transactions app-pagination nav')).toBeNull();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
      await signInAs(UserRole.ADMIN);
      for (let count = 0; count < 5; count++) {
        const sent = await TestBed.inject(ReloadService).sendReload({
          operator: 'Dialog',
          mobile: '77 123 4567',
          customerName: '',
          amount: '10',
        });
        expect(sent.ok).toBeTrue();
      }
      expect(await firstValueFrom(TestBed.inject(ReloadDataService).getTransactions())).toHaveSize(
        10
      );
      const tenFixture = TestBed.createComponent(ReloadUtilityComponent);
      tenFixture.detectChanges();
      await settle(tenFixture);
      expect(tenFixture.nativeElement.querySelector('app-pagination nav')).toBeNull();
      await TestBed.inject(ReloadService).sendReload({
        operator: 'Dialog',
        mobile: '77 123 4567',
        customerName: '',
        amount: '10',
      });
      const elevenFixture = TestBed.createComponent(ReloadUtilityComponent);
      elevenFixture.detectChanges();
      await settle(elevenFixture);
      const paged = elevenFixture.nativeElement as HTMLElement;
      expect(paged.querySelector('app-pagination nav')).not.toBeNull();
      expect(rows(paged)).toHaveSize(10);
      expect(paged.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
        'of 11'
      );
    });
  });

  describe('access', () => {
    it('lets a Manager and an Admin use every action', async () => {
      for (const role of [UserRole.MANAGER, UserRole.ADMIN]) {
        TestBed.resetTestingModule();
        const { element } = await render(role);
        expect(buttonByText(element, 'Send reload')).toBeDefined();
        expect(buttonByText(element, 'Pay bill')).toBeDefined();
        expect(buttonByText(element, 'Clear')).toBeDefined();
        expect(buttonByText(element, 'Top up float')).toBeDefined();
        expect(element.querySelector('app-page-header app-badge')).toBeNull();
      }
    });

    it('lets a Pharmacist read everything but hides Send reload, Top up float, Pay bill and Clear', async () => {
      const { element } = await render(UserRole.PHARMACIST);
      for (const label of ['Send reload', 'Top up float', 'Pay bill', 'Clear']) {
        expect(buttonByText(element, label)).withContext(label).toBeUndefined();
      }
      expect(element.querySelector('app-top-up-dialog')).toBeNull();
      expect(text(element, 'app-page-header')).toContain('View only');
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
      expect(rows(element)).toHaveSize(5);
      expect(buttonByText(element, 'Statement')).toBeDefined();
      expect(buttonByText(element, 'Export')).toBeDefined();
      expect(
        Array.from(
          element.querySelectorAll<HTMLInputElement>('app-mobile-reload-card input')
        ).every(input => input.matches(':disabled'))
      ).toBeTrue();
    });

    it('does not let a Pharmacist change anything even by calling the service', async () => {
      const { element } = await render(UserRole.PHARMACIST);
      const result = await TestBed.inject(ReloadService).topUpFloat(100_000);
      expect(result).toEqual({ ok: false, reason: 'denied' });
      expect(text(element, '[data-testid="available-float"]')).toBe('Rs. 6,200');
    });
  });
});
