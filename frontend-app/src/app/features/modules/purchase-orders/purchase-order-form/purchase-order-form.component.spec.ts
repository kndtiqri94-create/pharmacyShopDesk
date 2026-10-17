import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { PurchaseOrderDataService } from '../../../../core/services/data/purchase-order-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PurchaseOrderFormComponent, PurchaseOrderFormMode } from './purchase-order-form.component';

describe('PurchaseOrderFormComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(
    role: UserRole,
    mode: PurchaseOrderFormMode,
    id: string | null = null,
    query: Record<string, string> = {}
  ) {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { mode },
              paramMap: convertToParamMap(id ? { id } : {}),
              queryParamMap: convertToParamMap(query),
            },
          },
        },
      ],
    });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(PurchaseOrderFormComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  interface Fixture {
    detectChanges(): void;
  }
  const field = (element: HTMLElement, key: string) =>
    element.querySelector(`#po-${key}`) as HTMLInputElement & HTMLSelectElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;
  const lineRows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const notification = () => TestBed.inject(NotificationService).current();

  async function settle(fixture: Fixture): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

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

  it('shows the heading, breadcrumb, subtitle with the next number and the three header buttons', async () => {
    const { element } = await render(UserRole.MANAGER, 'create');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('New purchase order');
    expect(element.querySelector('app-breadcrumb')?.textContent).toContain('Purchase orders');
    expect(element.querySelector('app-page-header')?.textContent).toContain('PO-0150 · Draft');
    expect(buttonByText(element, 'Save draft')).toBeDefined();
    expect(buttonByText(element, 'Print')).toBeDefined();
    expect(buttonByText(element, 'Mark as sent').getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('marks supplier as required and starts the order date as today', async () => {
    const { element } = await render(UserRole.MANAGER, 'create');
    const label = (key: string) =>
      element.querySelector(`label[for="po-${key}"]`)?.textContent?.replace(/\s+/g, ' ').trim();
    expect(label('supplierId')).toBe('Supplier *');
    expect(label('orderDate')).toBe('Order date');
    expect(label('expectedDate')).toBe('Expected delivery');
    expect(label('notes')).toBe('Notes to supplier');
    expect(field(element, 'orderDate').value).toBe('2026-09-21');
  });

  it('invites you to choose a supplier, then shows their card with what you owe', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    const card = () => element.querySelector('app-supplier-side-card') as HTMLElement;
    expect(card().textContent).toContain('Choose a supplier');
    choose(fixture, element, 'supplierId', 'sup-002');
    expect(card().textContent).toContain('City Medicals');
    expect(card().textContent).toContain('Supplier since 2023');
    expect(card().textContent).toContain('+94 11 234 5679');
    expect(card().textContent).toContain('14 days credit');
    expect(card().textContent).toContain('2-3 days');
    expect(card().textContent).toContain('You owe them Rs. 0.00');
    choose(fixture, element, 'supplierId', 'sup-001');
    expect(card().querySelector('[data-testid="supplier-owed"]')?.textContent?.trim()).toBe(
      'You owe them Rs. 11,600.00'
    );
  });

  it('preselects the supplier named in the address and shows what you owe them', async () => {
    const { element } = await render(UserRole.MANAGER, 'create', null, { supplier: 'sup-001' });
    expect(field(element, 'supplierId').value).toBe('sup-001');
    expect(element.querySelector('[data-testid="supplier-owed"]')?.textContent?.trim()).toBe(
      'You owe them Rs. 11,600.00'
    );
    expect(notification()).toBeNull();
  });

  it('ignores an inactive, unknown or malformed supplier in the address and says so', async () => {
    for (const supplier of ['sup-005', 'sup-999', '<script>alert(1)</script>']) {
      TestBed.resetTestingModule();
      const { element } = await render(UserRole.MANAGER, 'create', null, { supplier });
      expect(field(element, 'supplierId').value).withContext(supplier).toBe('');
      expect(notification()?.message).withContext(supplier).toContain('choose one from the list');
      TestBed.inject(NotificationService).dismiss();
    }
  });

  it('hides inactive suppliers from the picker', async () => {
    const { element } = await render(UserRole.MANAGER, 'create');
    const names = Array.from(field(element, 'supplierId').options).map(option =>
      option.textContent?.trim()
    );
    expect(names).not.toContain('Ceylon Surgical');
    expect(names).toContain('Lanka Pharma');
  });

  it('adds an item with its stock, reorder level and unit cost, and updates totals as figures change', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-008');
    const row = lineRows(element)[0];
    expect(row.textContent).toContain('Metformin 500mg');
    expect(row.querySelector('td:nth-child(2)')?.textContent?.trim()).toBe('260');
    expect(row.querySelector('td:nth-child(3)')?.textContent?.trim()).toBe('300');
    expect(field(element, 'line-0-unitCost').value).toBe('2.20');
    type(fixture, element, 'line-0-quantity', '100');
    expect(lineRows(element)[0].querySelector('td:nth-child(6)')?.textContent?.trim()).toBe(
      '220.00'
    );
    type(fixture, element, 'delivery', '50');
    expect(element.querySelector('[data-testid="totals-subtotal"]')?.textContent?.trim()).toBe(
      'Rs. 220'
    );
    expect(element.querySelector('[data-testid="totals-total"]')?.textContent?.trim()).toBe(
      'Rs. 270'
    );
    expect(element.querySelector('[data-testid="totals-summary"]')?.textContent).toContain(
      '1 line · 100 units'
    );
  });

  it('removes a line and updates the totals', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-008');
    type(fixture, element, 'line-0-quantity', '10');
    (
      element.querySelector('button[aria-label="Remove Metformin 500mg"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(lineRows(element)).toHaveSize(0);
    expect(element.querySelector('[data-testid="totals-total"]')?.textContent?.trim()).toBe(
      'Rs. 0'
    );
  });

  it('adds every low-stock product once with a suggested quantity and never duplicates', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    addItem(fixture, element, 'prod-006');
    buttonByText(element, 'Add all low-stock items').click();
    fixture.detectChanges();
    const names = lineRows(element).map(row => row.querySelector('td')?.textContent);
    expect(names).toHaveSize(3);
    expect(names.join(' ')).toContain('ORS Sachet');
    expect(names.join(' ')).toContain('Cetirizine 10mg');
    expect(names.join(' ')).toContain('Metformin 500mg');
    expect(field(element, 'line-1-quantity').value).toBe('120');
    buttonByText(element, 'Add all low-stock items').click();
    fixture.detectChanges();
    expect(lineRows(element)).toHaveSize(3);
    expect(notification()?.message).toContain('No product is at or below its reorder level');
  });

  it('gives a sample-only message from Print', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    buttonByText(element, 'Print').click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Print');
  });

  it('saves a draft without lines, shows it as Draft and leaves stock alone', async () => {
    const { fixture, element, navigate } = await render(UserRole.MANAGER, 'create');
    const before = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    buttonByText(element, 'Save draft').click();
    await settle(fixture);
    const orders = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
    const saved = orders.find(order => order.number === 'PO-0150');
    expect(saved?.status).toBe(PoStatus.DRAFT);
    expect(saved?.lines).toEqual([]);
    expect(await firstValueFrom(TestBed.inject(ProductDataService).getAll())).toEqual(before);
    expect(notification()?.message).toContain('saved as a draft');
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders']);
  });

  it('refuses to send without a supplier, without lines or with bad figures', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'create');
    buttonByText(element, 'Mark as sent').click();
    await settle(fixture);
    expect(element.querySelector('#po-supplierId-error')?.textContent?.trim()).toBe(
      'Choose the supplier'
    );
    expect(element.querySelector('#po-lines')?.textContent).toContain('Add an item to order first');
    expect(document.activeElement).toBe(field(element, 'supplierId'));
    choose(fixture, element, 'supplierId', 'sup-002');
    type(fixture, element, 'expectedDate', '2026-09-30');
    addItem(fixture, element, 'prod-008');
    type(fixture, element, 'line-0-quantity', '0');
    type(fixture, element, 'line-0-unitCost', '-3');
    buttonByText(element, 'Mark as sent').click();
    await settle(fixture);
    expect(element.querySelector('#po-line-0-quantity-error')?.textContent?.trim()).toBe(
      'Enter an order quantity above 0'
    );
    expect(element.querySelector('#po-line-0-unitCost-error')).not.toBeNull();
    const orders = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
    expect(orders).toHaveSize(5);
  });

  it('marks a valid order as sent with its expected date and leaves stock unchanged', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    const before = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    choose(fixture, element, 'supplierId', 'sup-002');
    type(fixture, element, 'expectedDate', '2026-09-30');
    addItem(fixture, element, 'prod-008');
    type(fixture, element, 'line-0-quantity', '100');
    type(fixture, element, 'delivery', '50');
    buttonByText(element, 'Mark as sent').click();
    await settle(fixture);
    const orders = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
    const sent = orders.find(order => order.number === 'PO-0150');
    expect(sent?.status).toBe(PoStatus.SENT);
    expect(sent?.expectedDate).toBe('2026-09-30');
    expect(sent?.totalCents).toBe(22_000 + 5_000);
    expect(sent?.deliveryCents).toBe(5_000);
    expect(await firstValueFrom(TestBed.inject(ProductDataService).getAll())).toEqual(before);
    expect(notification()?.message).toContain('marked as sent');
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders']);
  });

  it('reopens a draft for editing with its saved details and updates it in place', async () => {
    const { fixture, element } = await render(UserRole.MANAGER, 'edit', 'po-005');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Edit purchase order');
    expect(element.querySelector('app-page-header')?.textContent).toContain('PO-0149 · Draft');
    expect(field(element, 'supplierId').value).toBe('sup-003');
    expect(lineRows(element)).toHaveSize(1);
    type(fixture, element, 'notes', 'Call before delivery');
    buttonByText(element, 'Save draft').click();
    await settle(fixture);
    const orders = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
    expect(orders).toHaveSize(5);
    expect(orders.find(order => order.id === 'po-005')?.notes).toBe('Call before delivery');
  });

  it('sends the edit address of a sent order to the read-only view', async () => {
    const { navigate } = await render(UserRole.MANAGER, 'edit', 'po-004');
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'po-004'], { replaceUrl: true });
  });

  it('shows a non-draft order read-only with no save, print or send', async () => {
    const { element } = await render(UserRole.PHARMACIST, 'view', 'po-004');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('PO-0148');
    expect(element.textContent).toContain('View only');
    expect(buttonByText(element, 'Save draft')).toBeUndefined();
    expect(buttonByText(element, 'Print')).toBeUndefined();
    expect(buttonByText(element, 'Mark as sent')).toBeUndefined();
    expect(buttonByText(element, 'Add item')).toBeUndefined();
    expect(field(element, 'supplierId').disabled).toBeTrue();
    expect(element.querySelector('button[aria-label^="Remove"]')).toBeNull();
    expect(lineRows(element)).toHaveSize(2);
  });

  it('keeps a Pharmacist from changing orders even if the form is opened', async () => {
    const { element } = await render(UserRole.PHARMACIST, 'create');
    expect(element.textContent).toContain('View only');
    expect(buttonByText(element, 'Mark as sent')).toBeUndefined();
  });

  it('says plainly when the order does not exist or the address is malformed', async () => {
    const missing = await render(UserRole.MANAGER, 'view', 'po-999');
    expect(missing.element.textContent).toContain('That purchase order is not in your list');
    TestBed.resetTestingModule();
    const odd = await render(UserRole.MANAGER, 'view', '<b>x</b>');
    expect(odd.element.textContent).toContain('That purchase order is not in your list');
  });
});
