import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { ProductDataService } from '../../../../core/services/data/product-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProductListComponent } from './product-list.component';

describe('ProductListComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(
    role: UserRole,
    query: Record<string, string> = {},
    before?: () => Promise<void>
  ) {
    const params = convertToParamMap(query);
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) },
        },
      ],
    });
    await signInAs(role);
    if (before) await before();
    const fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const names = (element: HTMLElement) =>
    rows(element).map(row =>
      row.querySelector('td:nth-child(2) .sd-body-strong')?.textContent?.trim()
    );
  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;

  function search(
    fixture: { detectChanges(): void; nativeElement: HTMLElement },
    text: string
  ): void {
    const input = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows the heading, a subtitle with live counts and the three header buttons', async () => {
    const { element } = await render(UserRole.ADMIN);
    expect(element.querySelector('h1')?.textContent).toBe('Products');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      '10 products · 3 low stock · 1 expiring soon'
    );
    expect(buttonByText(element, 'Import CSV')).toBeDefined();
    expect(buttonByText(element, 'Export')).toBeDefined();
    expect(buttonByText(element, 'Add product').getAttribute('data-variant')).toBe('primary');
  });

  it('gives a sample-only message from Import CSV and Export', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    buttonByText(element, 'Import CSV').click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Import CSV');
    buttonByText(element, 'Export').click();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Export');
  });

  it('shows each product row with batch, stock, cost, price and status', async () => {
    const { element } = await render(UserRole.ADMIN);
    const first = rows(element)[0];
    const text = (selector: string) => first.querySelector(selector)?.textContent?.trim();
    expect(text('td:nth-child(2)')).toContain('Paracetamol 500mg');
    expect(text('td:nth-child(2) .cell-sub')).toBe('Analgesic · Paracetamol · Tablet');
    expect(first.querySelector('td.is-mono')?.textContent?.trim()).toBe('PAR-500');
    expect(text('td:nth-child(4)')).toBe('B2405 / Exp Mar 2027');
    expect(text('td:nth-child(5)')).toContain('3,600');
    expect(text('td:nth-child(5)')).toContain('min 500');
    expect(text('td:nth-child(6)')).toBe('1.80');
    expect(text('td:nth-child(7)')).toBe('2.50');
    expect(text('td:nth-child(8)')).toBe('In stock');
    const headings = Array.from(element.querySelectorAll('thead th')).map(th =>
      th.textContent?.trim()
    );
    expect(headings).toContain('Cost (Rs.)');
    expect(headings).toContain('Price (Rs.)');
  });

  it('shows a dash for a product without batch tracking and for a new batch-tracked product', async () => {
    const { element } = await render(UserRole.ADMIN);
    const byName = (name: string) =>
      rows(element).find(row => row.textContent?.includes(name)) as Element;
    expect(
      byName('Digital Thermometer').querySelector('td:nth-child(4)')?.textContent?.trim()
    ).toBe('–');
    expect(byName('ORS Sachet').querySelector('td:nth-child(4)')?.textContent?.trim()).toBe('–');
    expect(byName('ORS Sachet').textContent).toContain('Out of stock');
  });

  it('gives view, edit and more actions with accessible names', async () => {
    const { element } = await render(UserRole.ADMIN);
    const labels = Array.from(rows(element)[0].querySelectorAll('button.row-action')).map(button =>
      button.getAttribute('aria-label')
    );
    expect(labels).toEqual([
      'View Paracetamol 500mg',
      'Edit Paracetamol 500mg',
      'More options for Paracetamol 500mg',
    ]);
  });

  it('opens the product form from view and edit and gives a sample message from more', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const action = (label: string) =>
      element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    action('View Paracetamol 500mg').click();
    expect(navigate).toHaveBeenCalledWith(['/products', 'prod-001']);
    action('Edit Paracetamol 500mg').click();
    expect(navigate).toHaveBeenCalledWith(['/products', 'prod-001', 'edit']);
    action('More options for Paracetamol 500mg').click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
  });

  it('narrows by search across name, generic name, SKU and barcode ignoring case', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    search(fixture, 'PARACET');
    expect(names(element)).toEqual(['Paracetamol 500mg']);
    search(fixture, 'amx-500');
    expect(names(element)).toEqual(['Amoxicillin 500mg']);
    search(fixture, '4791000000103');
    expect(names(element)).toEqual(['Digital Thermometer']);
    search(fixture, 'ASCORBIC');
    expect(names(element)).toEqual(['Vitamin C 500mg']);
  });

  it('shows live status chip counts and exactly one selected chip', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const counts = Array.from(element.querySelectorAll('button.chip')).map(button =>
      button.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(counts).toEqual([
      'All 10',
      'In stock 6',
      'Low stock 2',
      'Out of stock 1',
      'Expiring soon 1',
    ]);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    chip(element, 'Low stock').click();
    fixture.detectChanges();
    expect(names(element)).toEqual(['Cetirizine 10mg', 'Metformin 500mg']);
    expect(chip(element, 'Low stock').getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
  });

  it('filters by category and combines it with search and status, with chip counts to match', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = 'Diabetes';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(names(element)).toEqual(['Metformin 500mg']);
    expect(chip(element, 'All').textContent).toContain('1');
    expect(chip(element, 'Low stock').textContent).toContain('1');
    expect(chip(element, 'In stock').textContent).toContain('0');
    chip(element, 'In stock').click();
    fixture.detectChanges();
    expect(element.textContent).toContain('No products match');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(names(element)).toHaveSize(6);
  });

  it('says plainly when nothing matches instead of showing an empty table', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    search(fixture, 'zzz');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No products match');
    expect(element.textContent).toContain('Clear the search');
  });

  it('preselects the status chip from the address and ignores a bad value', async () => {
    const low = await render(UserRole.ADMIN, { status: 'low-stock' });
    expect(chip(low.element, 'Low stock').getAttribute('aria-pressed')).toBe('true');
    expect(names(low.element)).toHaveSize(2);
    TestBed.resetTestingModule();
    const bad = await render(UserRole.ADMIN, { status: '<script>' });
    expect(chip(bad.element, 'All').getAttribute('aria-pressed')).toBe('true');
    expect(names(bad.element)).toHaveSize(10);
  });

  it('lets a Cashier read everything including cost but not add or change products', async () => {
    const { element } = await render(UserRole.CASHIER);
    expect(buttonByText(element, 'Add product')).toBeUndefined();
    expect(element.querySelector('button[aria-label^="Edit"]')).toBeNull();
    expect(element.querySelector('button[aria-label^="View"]')).not.toBeNull();
    expect(rows(element)[0].querySelector('td:nth-child(6)')?.textContent?.trim()).toBe('1.80');
    expect(element.textContent).toContain('you cannot add or change them');
  });

  it('ticks rows and selects all rows on the page without offering a bulk action', async () => {
    const { fixture, element } = await render(UserRole.ADMIN);
    const boxes = () =>
      Array.from(element.querySelectorAll('tbody input[type="checkbox"]')) as HTMLInputElement[];
    boxes()[0].click();
    fixture.detectChanges();
    expect(boxes()[0].checked).toBeTrue();
    (element.querySelector('thead input[type="checkbox"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(boxes().every(box => box.checked)).toBeTrue();
    expect(buttonByText(element, 'Delete')).toBeUndefined();
  });

  it('keeps an inactive product listed and marks it as inactive', async () => {
    const { element } = await render(UserRole.ADMIN, {}, async () => {
      const products = TestBed.inject(ProductDataService);
      const product = (await firstValueFrom(products.getById('prod-004')))!;
      await firstValueFrom(products.save({ ...product, active: false }));
    });
    const row = rows(element).find(candidate => candidate.textContent?.includes('Omeprazole'))!;
    expect(row.textContent).toContain('Inactive');
    expect(names(element)).toHaveSize(10);
  });

  it('paginates at 11 products and returns to the first page when a filter changes', async () => {
    const { fixture, element } = await render(UserRole.ADMIN, {}, async () => {
      const products = TestBed.inject(ProductDataService);
      const template = (await firstValueFrom(products.getById('prod-010')))!;
      await firstValueFrom(
        products.save({ ...template, id: '', sku: 'EXTRA-1', name: 'Extra item' })
      );
    });
    expect(rows(element)).toHaveSize(10);
    expect(element.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
      'Showing 1–10 of 11 products'
    );
    (element.querySelector('button[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(rows(element)).toHaveSize(1);
    search(fixture, '0');
    expect(element.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
      'Showing 1–10 of 11 products'
    );
  });
});
