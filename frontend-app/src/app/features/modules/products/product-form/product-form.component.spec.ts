import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProductFormComponent, ProductFormMode } from './product-form.component';

describe('ProductFormComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole, mode: ProductFormMode, id: string | null = null) {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { mode }, paramMap: convertToParamMap(id ? { id } : {}) },
          },
        },
      ],
    });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(ProductFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  const control = (element: HTMLElement, key: string) =>
    element.querySelector(`#product-${key}`) as HTMLInputElement;

  function type(
    fixture: { detectChanges(): void },
    element: HTMLElement,
    key: string,
    value: string
  ): void {
    const input = control(element, key);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const buttons = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).filter(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement[];

  async function settle(fixture: { detectChanges(): void }) {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  function fillValid(fixture: { detectChanges(): void }, element: HTMLElement, sku = 'NEW-001') {
    type(fixture, element, 'name', 'Vitamin C 500mg');
    type(fixture, element, 'category', 'Supplement');
    type(fixture, element, 'sku', sku);
    type(fixture, element, 'costPrice', '2.00');
    type(fixture, element, 'sellingPrice', '3.00');
  }

  it('shows the add heading, breadcrumb, subtitle, groups, hints and footer actions', async () => {
    const { element } = await render(UserRole.ADMIN, 'create');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Add product');
    expect(element.querySelector('app-breadcrumb')?.textContent).toContain('Add product');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Fill in what you know now; batches and expiry come in through GRN.'
    );
    const groups = Array.from(element.querySelectorAll('section.group h2')).map(h =>
      h.textContent?.trim()
    );
    expect(groups).toEqual(['Basic details', 'Pricing', 'Stock rules']);
    expect(element.textContent).toContain('Point the scanner at the field and scan.');
    expect(element.textContent).toContain('Leave 0 and use GRN instead.');
    expect(buttons(element, 'Save product').length).toBe(2);
    expect(buttons(element, 'Save & add another').length).toBe(1);
    expect(buttons(element, 'Cancel').length).toBe(2);
    expect(element.textContent).toContain('receive stock with a GRN');
  });

  it('gives a sample-only message from the barcode scan button', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    (element.querySelector('button[aria-label="Scan barcode"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Barcode scanning');
  });

  it('marks required fields, saves nothing and focuses the first problem field', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    const before = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).length;
    buttons(element, 'Save product')[0].click();
    await settle(fixture);
    expect(element.textContent).toContain('Enter the product name');
    expect(document.activeElement).toBe(control(element, 'name'));
    expect(navigate).not.toHaveBeenCalled();
    const after = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).length;
    expect(after).toBe(before);
  });

  it('rejects a negative cost price and a non numeric reorder level', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillValid(fixture, element);
    type(fixture, element, 'costPrice', '-1');
    type(fixture, element, 'reorderLevel', 'abc');
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    expect(
      element.querySelectorAll('[role="alert"], .field__error, .sd-field-error').length
    ).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('rejects a SKU that already belongs to another product', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillValid(fixture, element, 'par-500');
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    expect(element.textContent).toContain('already used');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('saves valid details, confirms and returns to the list', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillValid(fixture, element);
    type(fixture, element, 'openingStock', '0');
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/products']);
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Vitamin C 500mg');
    const saved = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).find(
      product => product.sku === 'NEW-001'
    );
    expect(saved?.stockOnHand).toBe(0);
    expect(saved?.batches).toEqual([]);
  });

  it('saves and stays on a fresh empty form for Save & add another', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    fillValid(fixture, element);
    buttons(element, 'Save & add another')[0].click();
    await settle(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(control(element, 'name').value).toBe('');
    expect(control(element, 'sku').value).toBe('');
    const products = await firstValueFrom(TestBed.inject(ProductDataService).getAll());
    expect(products.some(product => product.sku === 'NEW-001')).toBe(true);
  });

  it('keeps a new batch-tracked product with opening stock free of batches', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    fillValid(fixture, element);
    type(fixture, element, 'openingStock', '40');
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    const saved = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).find(
      product => product.sku === 'NEW-001'
    );
    expect(saved?.stockOnHand).toBe(40);
    expect(saved?.trackBatches).toBe(true);
    expect(saved?.batches.length).toBe(0);
  });

  it('shows the live margin and handles missing cost without a broken figure', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'create');
    expect(element.querySelector('app-margin-card')?.textContent).toContain('No margin yet');
    type(fixture, element, 'costPrice', '2.10');
    type(fixture, element, 'sellingPrice', '3.00');
    const card = element.querySelector('app-margin-card')?.textContent ?? '';
    expect(card).toContain('30%');
    expect(card).toContain('Rs. 0.90 profit per tablet');
    type(fixture, element, 'costPrice', 'abc');
    expect(element.querySelector('app-margin-card')?.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('prefills an existing product and names it in the heading and breadcrumb', async () => {
    const { element } = await render(UserRole.ADMIN, 'edit', 'prod-001');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Edit Paracetamol 500mg');
    expect(element.querySelector('app-breadcrumb')?.textContent).toContain('Paracetamol 500mg');
    expect(control(element, 'name').value).toBe('Paracetamol 500mg');
    expect(control(element, 'sku').value).toBe('PAR-500');
    expect(control(element, 'sellingPrice').value).toBe('2.50');
  });

  it('allows an edited product to keep its own SKU', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'edit', 'prod-001');
    type(fixture, element, 'shelfLocation', 'Shelf B2');
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('shows a not found message for an unknown or malformed product id', async () => {
    const unknown = await render(UserRole.ADMIN, 'edit', 'nope-999');
    expect(unknown.element.textContent).toContain('That product is not in your list');
    TestBed.resetTestingModule();
    clearBrowserStorage();
    const malformed = await render(UserRole.ADMIN, 'edit', '<script>');
    expect(malformed.element.textContent).toContain('That product is not in your list');
  });

  it('asks before leaving only when something changed', async () => {
    const { fixture, element, navigate } = await render(UserRole.ADMIN, 'create');
    buttons(element, 'Cancel')[0].click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/products']);
    navigate.calls.reset();
    type(fixture, element, 'name', 'Something');
    buttons(element, 'Cancel')[0].click();
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Leave without saving');
    buttons(element, 'Discard changes')[0].click();
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('opens read-only with disabled fields and no save actions for view mode', async () => {
    const { element } = await render(UserRole.ADMIN, 'view', 'prod-001');
    expect(control(element, 'name').disabled).toBe(true);
    expect(control(element, 'sellingPrice').disabled).toBe(true);
    expect(buttons(element, 'Save product').length).toBe(0);
    expect(buttons(element, 'Save & add another').length).toBe(0);
    expect(buttons(element, 'Back to products').length).toBe(1);
    expect(
      Array.from(element.querySelectorAll<HTMLButtonElement>('button[role="switch"]')).every(
        item => item.disabled
      )
    ).toBe(true);
  });

  it('stays read-only for a Cashier even if the route says edit, and never saves', async () => {
    const { fixture, element } = await render(UserRole.CASHIER, 'edit', 'prod-001');
    expect(control(element, 'name').disabled).toBe(true);
    expect(buttons(element, 'Save product').length).toBe(0);
    fixture.componentInstance['save'](false);
    await settle(fixture);
    const product = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).find(
      candidate => candidate.id === 'prod-001'
    );
    expect(product?.name).toBe('Paracetamol 500mg');
  });

  it('keeps an inactive product listed after saving it as inactive', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, 'edit', 'prod-001');
    const buttonsList = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[role="switch"]')
    );
    buttonsList.find(item => item.textContent?.includes('Active, can be sold'))?.click();
    fixture.detectChanges();
    buttons(element, 'Save product')[1].click();
    await settle(fixture);
    const product = (await firstValueFrom(TestBed.inject(ProductDataService).getAll())).find(
      candidate => candidate.id === 'prod-001'
    );
    expect(product?.active).toBe(false);
  });
});
