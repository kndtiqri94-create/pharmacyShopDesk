import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { GrnStatus } from '../../../../core/models/enums/grn-status.enum';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { GrnDataService } from '../../../../core/services/data/grn-data.service';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import { GrnFormComponent, GrnFormMode } from './grn-form.component';

describe('GrnFormComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  interface Options {
    id?: string;
    query?: Record<string, string>;
  }

  async function render(role: UserRole, mode: GrnFormMode, options: Options = {}) {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              paramMap: convertToParamMap(options.id ? { id: options.id } : {}),
              queryParamMap: convertToParamMap(options.query ?? {}),
            },
          },
        },
      ],
    });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    return { ...(await mount()), navigate };
  }

  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  async function mount() {
    const fixture = TestBed.createComponent(GrnFormComponent);
    const component = fixture.componentInstance as unknown as { loaded(): boolean };
    fixture.detectChanges();
    for (let attempt = 0; attempt < 400 && !component.loaded(); attempt++)
      await new Promise(resolve => setTimeout(resolve, 5));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  interface Fixture {
    detectChanges(): void;
  }
  const field = (element: HTMLElement, key: string) =>
    element.querySelector(`#grn-${key}`) as HTMLInputElement & HTMLSelectElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;

  function type(fixture: Fixture, element: HTMLElement, key: string, value: string): void {
    const input = field(element, key);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function choose(fixture: Fixture, element: HTMLElement, key: string, value: string): void {
    const select = field(element, key);
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function addItem(fixture: Fixture, element: HTMLElement, productId: string): void {
    buttonByText(element, 'Add item').click();
    fixture.detectChanges();
    const select = element.querySelector(
      'select[aria-label="Product to add"]'
    ) as HTMLSelectElement;
    select.value = productId;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function fillLine(fixture: Fixture, element: HTMLElement, index: number, values: object): void {
    for (const [key, value] of Object.entries(values))
      type(fixture, element, `line-${index}-${key}`, value);
  }

  const lineRows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const notification = () => TestBed.inject(NotificationService).current();

  it('shows the heading, breadcrumb, subtitle with the next number and the two header buttons', async () => {
    const { element } = await render(UserRole.MANAGER, 'create');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('New GRN');
    expect(element.querySelector('app-breadcrumb')?.textContent).toContain('GRN');
    expect(element.querySelector('app-breadcrumb')?.textContent).toContain('New GRN');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'GRN-0212 · Draft saved automatically'
    );
    expect(buttonByText(element, 'Save draft')).toBeDefined();
    expect(buttonByText(element, 'Receive stock').getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('marks supplier and invoice no as required and starts with today and the signed-in person', async () => {
    const { element } = await render(UserRole.MANAGER, 'create');
    const labelOf = (key: string) =>
      element.querySelector(`label[for="grn-${key}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(labelOf('supplierId')).toBe('Supplier *');
    expect(labelOf('invoiceNo')).toBe('Supplier invoice no *');
    expect(labelOf('purchaseOrderId')).toBe('Purchase order');
    expect(element.textContent).toContain('Lines are filled from the PO.');
    expect(field(element, 'receivedDate').value).toBe('2026-09-21');
    expect(field(element, 'receivedBy').value).toBe('Kamal Silva');
    expect(field(element, 'receivedBy').readOnly).toBeTrue();
    const methods = Array.from(field(element, 'paymentMethod').options).map(option =>
      option.textContent?.trim()
    );
    expect(methods).toContain('Credit (pay later)');
    expect(field(element, 'paymentMethod').value).toBe('CREDIT');
    expect(element.textContent).toContain(
      'Receiving adds each batch to stock and updates the cost price of the products.'
    );
  });

  it('refuses an empty GRN, shows what to fix with red borders and focuses the first problem', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    buttonByText(element, 'Receive stock').click();
    await settle(fixture);
    expect(element.querySelector('#grn-supplierId-error')?.textContent?.trim()).toBe(
      'Choose the supplier'
    );
    expect(element.querySelector('#grn-invoiceNo-error')?.textContent?.trim()).toBe(
      'Enter the supplier invoice number'
    );
    expect(element.querySelector('#grn-lines')?.textContent).toContain('Add an item first');
    expect(
      field(element, 'invoiceNo')
        .closest('.sd-field-box')
        ?.classList.contains('sd-field-box--error')
    ).toBeTrue();
    expect(document.activeElement).toBe(field(element, 'supplierId'));
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    expect(grns).toHaveSize(5);
  });

  it('adds a line with the product cost and price, and removes it again', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-002');
    expect(lineRows(element)).toHaveSize(1);
    expect(lineRows(element)[0].textContent).toContain('Amoxicillin 500mg');
    expect(field(element, 'line-0-cost').value).toBe('12.50');
    expect(lineRows(element)[0].textContent).toContain('18.00');
    expect(element.querySelector('[data-testid="totals-summary"]')?.textContent).toContain(
      '1 line'
    );
    (
      element.querySelector('button[aria-label="Remove Amoxicillin 500mg"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(lineRows(element)).toHaveSize(0);
    expect(element.textContent).toContain('No items yet');
  });

  it('gives a sample-only message from Scan item', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    buttonByText(element, 'Scan item').click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Scan item');
  });

  it('updates line total, units, discount, total and balance as figures change, free units cost nothing', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-001');
    fillLine(fixture, element, 0, { received: '100', free: '10', cost: '1.80' });
    expect(lineRows(element)[0].querySelector('td:nth-child(8)')?.textContent?.trim()).toBe(
      '180.00'
    );
    expect(element.querySelector('[data-testid="totals-summary"]')?.textContent).toContain(
      '1 line · 110 units'
    );
    expect(element.querySelector('[data-testid="totals-total"]')?.textContent?.trim()).toBe(
      'Rs. 180'
    );
    type(fixture, element, 'discount', '30');
    expect(element.querySelector('[data-testid="totals-total"]')?.textContent?.trim()).toBe(
      'Rs. 150'
    );
    type(fixture, element, 'paidNow', '50');
    expect(element.querySelector('[data-testid="totals-balance"]')?.textContent?.trim()).toBe(
      'Rs. 100'
    );
  });

  it('flags a missing batch, a bad expiry, a zero quantity and negative figures', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    choose(fixture, element, 'supplierId', 'sup-001');
    type(fixture, element, 'invoiceNo', 'INV-1');
    addItem(fixture, element, 'prod-001');
    fillLine(fixture, element, 0, { expiry: '13/2027', received: '0', free: '-1', cost: '-2' });
    buttonByText(element, 'Receive stock').click();
    await settle(fixture);
    const message = (key: string) =>
      element.querySelector(`#grn-line-0-${key}-error`)?.textContent?.trim();
    expect(message('batchNo')).toBe('Enter the batch number');
    expect(message('expiry')).toContain('MM/YYYY');
    expect(message('received')).toBe('Enter a received quantity above 0');
    expect(message('free')).toContain('whole number');
    expect(message('cost')).toContain('amount');
    expect(document.activeElement).toBe(field(element, 'line-0-batchNo'));
  });

  it('rejects a paid now amount that is negative, not a number or more than the total', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    choose(fixture, element, 'supplierId', 'sup-001');
    type(fixture, element, 'invoiceNo', 'INV-1');
    addItem(fixture, element, 'prod-001');
    fillLine(fixture, element, 0, {
      batchNo: 'B1',
      expiry: '03/2029',
      received: '10',
      cost: '1.00',
    });
    for (const paid of ['-5', 'abc', '10.01']) {
      type(fixture, element, 'paidNow', paid);
      buttonByText(element, 'Receive stock').click();
      await settle(fixture);
      expect(element.querySelector('#grn-paidNow-error')).not.toBeNull();
    }
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    expect(grns).toHaveSize(5);
  });

  it('warns about short expiry naming the product and month, and clears the warning when corrected', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-002');
    fillLine(fixture, element, 0, { expiry: '02/2027' });
    expect(element.textContent).toContain(
      'Amoxicillin 500mg expires in 5 months (02/2027). Check with the supplier before accepting.'
    );
    expect(
      field(element, 'line-0-expiry')
        .closest('.sd-field-box')
        ?.classList.contains('sd-field-box--error')
    ).toBeTrue();
    type(fixture, element, 'line-0-expiry', '03/2029');
    expect(element.textContent).not.toContain('expires in');
    expect(
      field(element, 'line-0-expiry')
        .closest('.sd-field-box')
        ?.classList.contains('sd-field-box--error')
    ).toBeFalse();
  });

  it('names every short-dated product', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-002');
    addItem(fixture, element, 'prod-001');
    fillLine(fixture, element, 0, { expiry: '02/2027' });
    fillLine(fixture, element, 1, { expiry: '01/2027' });
    expect(element.querySelectorAll('.alert[data-tone="warning"]')).toHaveSize(2);
    expect(element.textContent).toContain('Paracetamol 500mg expires in 4 months (01/2027)');
  });

  it('offers only open POs for the chosen supplier and fills supplier and lines from a PO', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    const options = () =>
      Array.from(field(element, 'purchaseOrderId').options).map(option =>
        option.textContent?.trim()
      );
    expect(options().filter(text => text?.startsWith('PO-'))).toHaveSize(2);
    choose(fixture, element, 'supplierId', 'sup-001');
    expect(options().filter(text => text?.startsWith('PO-'))).toEqual([
      'PO-0148 · Lanka Pharma · expected 20 Sep',
    ]);
    choose(fixture, element, 'supplierId', '');
    choose(fixture, element, 'purchaseOrderId', 'po-004');
    expect(field(element, 'supplierId').value).toBe('sup-001');
    expect(lineRows(element)).toHaveSize(2);
    expect(lineRows(element)[0].textContent).toContain('ordered 200');
    expect(field(element, 'line-0-received').value).toBe('200');
    expect(field(element, 'line-0-cost').value).toBe('12.50');
  });

  it('keeps the lines editable after a PO and lets the PO choice be cleared', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    choose(fixture, element, 'purchaseOrderId', 'po-004');
    type(fixture, element, 'line-0-received', '150');
    (element.querySelector('button[aria-label="Remove ORS Sachet"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(lineRows(element)).toHaveSize(1);
    choose(fixture, element, 'purchaseOrderId', '');
    expect(lineRows(element)).toHaveSize(1);
    expect(field(element, 'line-0-received').value).toBe('150');
    expect(element.textContent).not.toContain('ordered 200');
  });

  it('clears a PO that does not belong to the newly chosen supplier', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    choose(fixture, element, 'purchaseOrderId', 'po-004');
    choose(fixture, element, 'supplierId', 'sup-002');
    expect(field(element, 'purchaseOrderId').value).toBe('');
  });

  it('starts from the PO named in the address and ignores a bad one with a plain message', async () => {
    const good = await render(UserRole.PHARMACIST, 'create', { query: { po: 'po-004' } });
    expect(field(good.element, 'purchaseOrderId').value).toBe('po-004');
    expect(lineRows(good.element)).toHaveSize(2);
    TestBed.resetTestingModule();
    const bad = await render(UserRole.MANAGER, 'create', { query: { po: 'po-001' } });
    expect(lineRows(bad.element)).toHaveSize(0);
    expect(notification()?.message).toContain('cannot be received');
    TestBed.resetTestingModule();
    const junk = await render(UserRole.MANAGER, 'create', { query: { po: '../../x' } });
    expect(lineRows(junk.element)).toHaveSize(0);
  });

  it('saves a draft that shows in the list as Draft with no change to stock, batches, cost or PO', async () => {
    const { fixture, element, navigate } = await render(UserRole.MANAGER, 'create', {
      query: { po: 'po-004' },
    });
    type(fixture, element, 'invoiceNo', 'INV-DRAFT');
    const productsBefore = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    buttonByText(element, 'Save draft').click();
    await settle(fixture);
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    const saved = grns.find(grn => grn.invoiceNo === 'INV-DRAFT');
    expect(saved?.status).toBe(GrnStatus.DRAFT);
    expect(saved?.number).toBe('GRN-0212');
    expect(await firstValueFrom(TestBed.inject(ProductDataService).getAll())).toEqual(
      productsBefore
    );
    const order = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getById('po-004'));
    expect(order?.status).toBe(PoStatus.SENT);
    expect(notification()?.message).toContain('saved as a draft');
    expect(navigate).toHaveBeenCalledWith(['/grn']);
  });

  it('keeps in-progress entries for the session and restores them when you come back', async () => {
    const first = await render(UserRole.MANAGER, 'create');
    type(first.fixture, first.element, 'invoiceNo', 'INV-KEEP');
    addItem(first.fixture, first.element, 'prod-001');
    fillLine(first.fixture, first.element, 0, { batchNo: 'B77' });
    first.fixture.destroy();
    const second = await mount();
    expect(field(second.element, 'invoiceNo').value).toBe('INV-KEEP');
    expect(field(second.element, 'line-0-batchNo').value).toBe('B77');
    expect(localStorage.length).toBe(0);
  });

  it('receives stock from a PO: batches, stock, cost, PO closed, list opened, confirmation shown', async () => {
    const { fixture, element, navigate } = await render(UserRole.MANAGER, 'create', {
      query: { po: 'po-004' },
    });
    const before = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).find(
      product => product.id === 'prod-002'
    )!;
    type(fixture, element, 'invoiceNo', 'INV-NEW');
    fillLine(fixture, element, 0, {
      batchNo: 'B9001',
      expiry: '09/2028',
      free: '10',
      cost: '13.00',
    });
    fillLine(fixture, element, 1, { batchNo: 'B9002', expiry: '10/2028' });
    type(fixture, element, 'paidNow', '100');
    buttonByText(element, 'Receive stock').click();
    await settle(fixture);
    const products = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    const after = products.find(product => product.id === 'prod-002')!;
    expect(getStockOnHand(after)).toBe(getStockOnHand(before) + 210);
    expect(after.costCents).toBe(1300);
    expect(
      after.batches.some(batch => batch.batchNo === 'B9001' && batch.quantity === 210)
    ).toBeTrue();
    const order = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getById('po-004'));
    expect(order?.status).toBe(PoStatus.RECEIVED);
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    const received = grns.find(grn => grn.invoiceNo === 'INV-NEW');
    expect(received?.status).toBe(GrnStatus.RECEIVED);
    expect(received?.paymentStatus).toBe('PART_PAID');
    expect(notification()?.message).toContain('received');
    expect(navigate).toHaveBeenCalledWith(['/grn']);
  });

  it('shows the earliest-expiring batch first after receiving', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    choose(fixture, element, 'supplierId', 'sup-001');
    type(fixture, element, 'invoiceNo', 'INV-EARLY');
    addItem(fixture, element, 'prod-002');
    fillLine(fixture, element, 0, {
      batchNo: 'B1',
      expiry: '10/2026',
      received: '5',
      cost: '12.00',
    });
    buttonByText(element, 'Receive stock').click();
    await settle(fixture);
    const products = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    const batches = products.find(product => product.id === 'prod-002')!.batches;
    expect(batches.map(batch => batch.batchNo)).toEqual(['B1', 'B2406']);
  });

  it('lets a GRN be received by hand with no PO', async () => {
    const { fixture, element } = await render(UserRole.PHARMACIST, 'create');
    choose(fixture, element, 'supplierId', 'sup-003');
    type(fixture, element, 'invoiceNo', 'INV-HAND');
    addItem(fixture, element, 'prod-007');
    fillLine(fixture, element, 0, {
      batchNo: 'H1',
      expiry: '12/2028',
      received: '4',
      cost: '380.00',
    });
    buttonByText(element, 'Receive stock').click();
    await settle(fixture);
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    expect(grns.find(grn => grn.invoiceNo === 'INV-HAND')?.purchaseOrderNumber).toBeNull();
  });

  it('reopens a draft GRN for editing', async () => {
    const { element } = await render(UserRole.MANAGER, 'open', { id: 'grn-005' });
    expect(element.querySelector('app-page-header')?.textContent).toContain('GRN-0211 · Draft');
    expect(field(element, 'invoiceNo').value).toBe('INV-88301');
    expect(field(element, 'purchaseOrderId').value).toBe('po-004');
    expect(lineRows(element)).toHaveSize(1);
    expect(buttonByText(element, 'Receive stock')).toBeDefined();
  });

  it('shows a received GRN read-only', async () => {
    const { element } = await render(UserRole.MANAGER, 'open', { id: 'grn-001' });
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('GRN-0208');
    expect(element.textContent).toContain('View only');
    expect(buttonByText(element, 'Receive stock')).toBeUndefined();
    expect(buttonByText(element, 'Save draft')).toBeUndefined();
    expect(field(element, 'invoiceNo').disabled).toBeTrue();
    expect(element.querySelector('button[aria-label^="Remove"]')).toBeNull();
  });

  it('says plainly when the GRN does not exist or the address is malformed', async () => {
    const missing = await render(UserRole.MANAGER, 'open', { id: 'grn-999' });
    expect(missing.element.textContent).toContain('That GRN is not in your list');
    TestBed.resetTestingModule();
    const odd = await render(UserRole.MANAGER, 'open', { id: '<img src=x>' });
    expect(odd.element.textContent).toContain('That GRN is not in your list');
  });
});
