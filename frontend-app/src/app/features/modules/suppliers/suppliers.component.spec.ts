import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { GrnDataService } from '../../../core/services/data/grn-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { amountOwedToSupplier } from '../../../core/utils/supplier-owed.util';
import { SuppliersComponent } from './suppliers.component';

describe('SuppliersComponent', () => {
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

  async function render(role: UserRole = UserRole.MANAGER, query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(SuppliersComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const names = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('.supplier-cell__name')?.textContent?.trim());
  const panel = (element: HTMLElement) =>
    element.querySelector('app-supplier-detail-panel') as HTMLElement;
  const buttonByText = (element: HTMLElement, text: string, scope = 'body') =>
    Array.from(element.querySelectorAll(`${scope} button`)).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const notification = () => TestBed.inject(NotificationService).current();
  const amountInput = (element: HTMLElement) =>
    element.querySelector('#record-payment-amount') as HTMLInputElement;
  const dialogButton = (element: HTMLElement, text: string) =>
    buttonByText(element, text, 'app-record-payment-dialog dialog') as HTMLButtonElement;

  function type(fixture: Detectable, input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function search(fixture: Detectable, element: HTMLElement, text: string): void {
    type(fixture, element.querySelector('input[type="search"]') as HTMLInputElement, text);
  }

  async function chooseSupplier(fixture: Detectable, element: HTMLElement, name: string) {
    const button = Array.from(element.querySelectorAll('.supplier-cell__name')).find(
      item => item.textContent?.trim() === name
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  }

  it('shows the heading, a subtitle that agrees with the Owing column and one primary button', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Suppliers');
    const owing = rows(element).map(row =>
      Number(row.querySelector('td:nth-child(2)')?.textContent?.trim().replaceAll(',', ''))
    );
    const total = owing.reduce((sum, value) => sum + value, 0);
    expect(total).toBe(14_400);
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      '4 active suppliers · Rs. 14,400 outstanding'
    );
    expect(buttonByText(element, 'Add supplier')?.getAttribute('data-variant')).toBe('primary');
    const primaries = Array.from(element.querySelectorAll('button[data-variant="primary"]')).filter(
      button => !button.closest('dialog')
    );
    expect(primaries).toHaveSize(1);
  });

  it('gives a sample-only message from Add supplier and changes nothing else', async () => {
    const { fixture, element } = await render();
    buttonByText(element, 'Add supplier')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Add supplier');
    expect(rows(element)).toHaveSize(5);
  });

  it('lists each supplier with avatar, contact, amount owing, last order and a status word', async () => {
    const { element } = await render();
    expect(names(element)).toEqual([
      'Lanka Pharma',
      'City Medicals',
      'Health Plus Ltd',
      'MediCare Distributors',
      'Ceylon Surgical',
    ]);
    const first = rows(element)[0];
    expect(first.querySelector('app-avatar')?.textContent?.trim()).toBe('LP');
    expect(first.querySelector('.supplier-cell__contact')?.textContent).toBe('Ashan Gunawardena');
    expect(first.querySelector('td:nth-child(2)')?.textContent?.trim()).toBe('11,600.00');
    expect(first.querySelector('td:nth-child(2)')?.classList).toContain('is-right');
    expect(first.querySelector('td:nth-child(3)')?.textContent?.trim()).toBe('10 Sep 2026');
    expect(first.querySelector('td:nth-child(4)')?.textContent).toContain('Active');
    expect(rows(element)[4].querySelector('td:nth-child(4)')?.textContent).toContain('Inactive');
    expect(element.querySelector('thead')?.textContent).toContain('Owing (Rs.)');
    expect(element.querySelector('app-pagination nav')).toBeNull();
  });

  it('narrows by supplier or contact ignoring case and updates the chip counts', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'CITY');
    expect(names(element)).toEqual(['City Medicals']);
    expect(chip(element, 'All').textContent).toContain('1');
    expect(chip(element, 'Owing').textContent).toContain('0');
    search(fixture, element, 'ishara dias');
    expect(names(element)).toEqual(['Ceylon Surgical']);
    expect(chip(element, 'Inactive').textContent).toContain('1');
  });

  it('shows live chip counts, one selected at a time, and filters by Owing and Inactive', async () => {
    const { fixture, element } = await render();
    const counts = () =>
      Array.from(element.querySelectorAll('button.chip')).map(button =>
        button.textContent?.replace(/\s+/g, ' ').trim()
      );
    expect(counts()).toEqual(['All 5', 'Owing 2', 'Inactive 1']);
    chip(element, 'Owing').click();
    fixture.detectChanges();
    expect(names(element)).toEqual(['Lanka Pharma', 'Health Plus Ltd']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    chip(element, 'Inactive').click();
    fixture.detectChanges();
    expect(names(element)).toEqual(['Ceylon Surgical']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
  });

  it('says plainly when no supplier matches', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'zzz');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No suppliers match');
    expect(element.textContent).toContain('Clear the search');
  });

  it('selects the first supplier and shows the full detail panel', async () => {
    const { element } = await render();
    const text = panel(element).textContent ?? '';
    expect(panel(element).querySelector('h2')?.textContent).toBe('Lanka Pharma');
    expect(text).toContain('Supplier since 2022');
    expect(text).toContain('Active');
    expect(panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent).toBe(
      'Rs. 11,600.00'
    );
    expect(text).toContain('Ashan Gunawardena');
    expect(text).toContain('+94 11 234 5678');
    expect(text).toContain('orders@lankapharma.example');
    expect(text).toContain('30 days credit · delivers in 2 days');
    expect(rows(element)[0].getAttribute('aria-current')).toBe('true');
  });

  it('changes the panel and the highlighted row when another supplier is chosen', async () => {
    const { fixture, element } = await render();
    await chooseSupplier(fixture, element, 'Health Plus Ltd');
    expect(panel(element).querySelector('h2')?.textContent).toBe('Health Plus Ltd');
    expect(panel(element).textContent).toContain('Rs. 2,800.00');
    expect(rows(element)[2].getAttribute('aria-current')).toBe('true');
    expect(rows(element)[0].getAttribute('aria-current')).toBeNull();
  });

  it('lists the latest events newest first, each with a state word', async () => {
    const { element } = await render();
    const items = Array.from(panel(element).querySelectorAll('li')).map(item =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(items).toHaveSize(4);
    expect(items[0]).toContain('GRN-0208 received');
    expect(items[0]).toContain('Unpaid');
    expect(items[1]).toContain('PO-0148 sent');
    expect(items[1]).toContain('Overdue');
  });

  it('gives a sample-only message from Edit', async () => {
    const { fixture, element } = await render();
    buttonByText(panel(element), 'Edit')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Edit supplier');
  });

  it('opens New purchase order with this supplier chosen', async () => {
    const { element, navigate } = await render();
    buttonByText(panel(element), 'New PO')?.click();
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'new'], {
      queryParams: { supplier: 'sup-001' },
    });
  });

  it('keeps an inactive supplier visible with its status but cannot start an order for it', async () => {
    const { fixture, element, navigate } = await render();
    await chooseSupplier(fixture, element, 'Ceylon Surgical');
    expect(panel(element).textContent).toContain('Inactive');
    const newOrder = buttonByText(panel(element), 'New PO') as HTMLButtonElement;
    expect(newOrder.disabled).toBeTrue();
    newOrder.click();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows Rs. 0.00 and an unavailable Record payment when nothing is owed', async () => {
    const { fixture, element } = await render();
    await chooseSupplier(fixture, element, 'City Medicals');
    expect(panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent).toBe(
      'Rs. 0.00'
    );
    expect(
      (buttonByText(panel(element), 'Record payment') as HTMLButtonElement).disabled
    ).toBeTrue();
  });

  it('preselects a supplier named in the address and falls back to the first for a bad one', async () => {
    const named = await render(UserRole.MANAGER, { supplier: 'sup-003' });
    expect(panel(named.element).querySelector('h2')?.textContent).toBe('Health Plus Ltd');
    TestBed.resetTestingModule();
    const bad = await render(UserRole.MANAGER, { supplier: '<script>' });
    expect(panel(bad.element).querySelector('h2')?.textContent).toBe('Lanka Pharma');
  });

  describe('Record payment', () => {
    async function openDialog(role: UserRole = UserRole.MANAGER) {
      const context = await render(role);
      buttonByText(panel(context.element), 'Record payment')?.click();
      context.fixture.detectChanges();
      return context;
    }

    it('opens a dialog pre-filled with the full outstanding amount, with confirm and cancel', async () => {
      const { element } = await openDialog();
      const dialog = element.querySelector('app-record-payment-dialog dialog') as HTMLDialogElement;
      expect(dialog.open).toBeTrue();
      expect(amountInput(element).value).toBe('11600.00');
      expect(dialogButton(element, 'Record payment')).toBeDefined();
      expect(dialogButton(element, 'Cancel')).toBeDefined();
      expect(document.activeElement).toBe(amountInput(element));
    });

    it('records nothing and says what to fix for an empty, text, zero, negative or too large amount', async () => {
      const { fixture, element } = await openDialog();
      const grnService = TestBed.inject(GrnDataService);
      const before = amountOwedToSupplier(await firstValueFrom(grnService.getAll()), 'sup-001');
      const cases: [string, string][] = [
        ['', 'Enter the amount you are paying'],
        ['abc', 'Enter the amount as a number, for example 1500.00'],
        ['1e3', 'Enter the amount as a number, for example 1500.00'],
        ['0', 'Enter an amount above zero'],
        ['-10', 'Enter an amount above zero'],
        ['11600.01', 'The amount can be at most Rs. 11,600'],
      ];
      for (const [value, message] of cases) {
        type(fixture, amountInput(element), value);
        dialogButton(element, 'Record payment').click();
        fixture.detectChanges();
        expect(element.querySelector('app-record-payment-dialog .field__error')?.textContent)
          .withContext(value)
          .toBe(message);
        expect(document.activeElement).toBe(amountInput(element));
      }
      await settle(fixture);
      expect(amountOwedToSupplier(await firstValueFrom(grnService.getAll()), 'sup-001')).toBe(
        before
      );
      expect(notification()).toBeNull();
    });

    it('lowers the outstanding by exactly the amount, shows the new figure in panel and list, and adds a Payment entry at the top', async () => {
      const { fixture, element } = await openDialog();
      type(fixture, amountInput(element), '6000');
      dialogButton(element, 'Record payment').click();
      await settle(fixture);
      expect(
        panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent
      ).toBe('Rs. 5,600.00');
      expect(rows(element)[0].querySelector('td:nth-child(2)')?.textContent?.trim()).toBe(
        '5,600.00'
      );
      expect(element.querySelector('app-page-header')?.textContent).toContain(
        'Rs. 8,400 outstanding'
      );
      expect(notification()?.tone).toBe('success');
      expect(notification()?.message).toContain('Rs. 6,000.00');
      const first = panel(element).querySelector('li')?.textContent ?? '';
      expect(first).toContain('Payment of Rs. 6,000');
      expect(first).toContain('Paid');
      expect(
        (element.querySelector('app-record-payment-dialog dialog') as HTMLDialogElement).open
      ).toBeFalse();
    });

    it('settles the oldest GRNs first and leaves the last one part paid', async () => {
      const { fixture, element } = await openDialog();
      type(fixture, amountInput(element), '6000');
      dialogButton(element, 'Record payment').click();
      await settle(fixture);
      const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
      const status = (id: string) => grns.find(grn => grn.id === id)?.paymentStatus;
      expect(status('grn-006')).toBe('PAID');
      expect(status('grn-007')).toBe('PART_PAID');
      expect(status('grn-001')).toBe('UNPAID');
      expect(grns.find(grn => grn.id === 'grn-007')?.paidCents).toBe(180_000);
    });

    it('changes nothing when cancelled', async () => {
      const { fixture, element } = await openDialog();
      type(fixture, amountInput(element), '500');
      dialogButton(element, 'Cancel').click();
      fixture.detectChanges();
      expect(
        (element.querySelector('app-record-payment-dialog dialog') as HTMLDialogElement).open
      ).toBeFalse();
      expect(
        panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent
      ).toBe('Rs. 11,600.00');
      expect(notification()).toBeNull();
    });

    it('applies a rapid double confirm only once', async () => {
      const { fixture, element } = await openDialog();
      type(fixture, amountInput(element), '1000');
      const confirm = dialogButton(element, 'Record payment');
      confirm.click();
      confirm.click();
      await settle(fixture);
      expect(
        panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent
      ).toBe('Rs. 10,600.00');
    });

    it('lets an Admin record a payment too', async () => {
      const { fixture, element } = await openDialog(UserRole.ADMIN);
      dialogButton(element, 'Record payment').click();
      await settle(fixture);
      expect(
        panel(element).querySelector('[data-testid="supplier-outstanding"]')?.textContent
      ).toBe('Rs. 0.00');
    });
  });

  describe('by role', () => {
    it('lets a Pharmacist read the list and panel but hides every write action', async () => {
      const { element } = await render(UserRole.PHARMACIST);
      expect(rows(element)).toHaveSize(5);
      expect(panel(element).textContent).toContain('Lanka Pharma');
      expect(buttonByText(element, 'Add supplier')).toBeUndefined();
      expect(buttonByText(element, 'Record payment')).toBeUndefined();
      expect(buttonByText(element, 'Edit')).toBeUndefined();
      expect(buttonByText(element, 'New PO')).toBeUndefined();
    });

    it('lets a Manager and an Admin use every action', async () => {
      for (const role of [UserRole.MANAGER, UserRole.ADMIN]) {
        TestBed.resetTestingModule();
        const { element } = await render(role);
        expect(buttonByText(element, 'Add supplier')).toBeDefined();
        expect(buttonByText(element, 'Record payment')).toBeDefined();
        expect(buttonByText(element, 'Edit')).toBeDefined();
        expect(buttonByText(element, 'New PO')).toBeDefined();
      }
    });
  });
});
