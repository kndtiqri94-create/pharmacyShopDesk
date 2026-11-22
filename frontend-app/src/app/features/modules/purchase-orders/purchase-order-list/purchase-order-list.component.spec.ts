import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../../core/services/notification.service';
import { PurchaseOrderListComponent } from './purchase-order-list.component';

describe('PurchaseOrderListComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(role: UserRole = UserRole.MANAGER, query: Record<string, string> = {}) {
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
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(PurchaseOrderListComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const numbers = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('td:nth-child(1)')?.textContent?.trim());
  const rowOf = (element: HTMLElement, number: string) =>
    rows(element).find(row => row.querySelector('td')?.textContent?.trim() === number) as Element;
  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;
  const action = (element: HTMLElement, label: string) =>
    element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

  function search(fixture: { detectChanges(): void }, element: HTMLElement, text: string): void {
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows the heading, subtitle, Export and one primary New purchase order button', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Purchase orders');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Orders you have sent to suppliers and what is still on the way.'
    );
    expect(buttonByText(element, 'Export')).toBeDefined();
    expect(buttonByText(element, 'New purchase order').getAttribute('data-variant')).toBe(
      'primary'
    );
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('gives a sample-only message from Export and opens the new order form', async () => {
    const { fixture, element, navigate } = await render();
    buttonByText(element, 'Export').click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Export');
    buttonByText(element, 'New purchase order').click();
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'new']);
  });

  it('shows the last 30 days range on the date button', async () => {
    const { element } = await render();
    expect(buttonByText(element, 'Last 30 days · 22 Aug – 21 Sep 2026')).toBeDefined();
  });

  it('shows each order row with contact, expected date, items, total and word status', async () => {
    const { element } = await render();
    expect(numbers(element)).toEqual(['PO-0149', 'PO-0147', 'PO-0148', 'PO-0145', 'PO-0146']);
    const row = rowOf(element, 'PO-0148');
    const text = (selector: string) => row.querySelector(selector)?.textContent?.trim();
    expect(row.querySelector('td.is-mono')?.textContent?.trim()).toBe('PO-0148');
    expect(text('td:nth-child(2)')).toBe('10 Sep 2026');
    expect(text('td:nth-child(3)')).toContain('Lanka Pharma');
    expect(text('td:nth-child(3) .cell-sub')).toBe('Contact: Ashan Gunawardena');
    expect(text('td:nth-child(5)')).toBe('2');
    expect(text('td:nth-child(6)')).toBe('7,000.00');
    expect(text('td:nth-child(7)')).toBe('Sent');
    const headings = Array.from(element.querySelectorAll('thead th')).map(th =>
      th.textContent?.trim()
    );
    expect(headings).toContain('Total (Rs.)');
  });

  it('shows an overdue open order in danger colour with the word overdue, never a closed one', async () => {
    const { element } = await render();
    const overdue = rowOf(element, 'PO-0148').querySelector('td:nth-child(4)');
    expect(overdue?.textContent?.trim()).toBe('20 Sep · overdue');
    expect(overdue?.querySelector('.overdue')).not.toBeNull();
    expect(rowOf(element, 'PO-0145').querySelector('td:nth-child(4)')?.textContent).not.toContain(
      'overdue'
    );
    expect(rowOf(element, 'PO-0146').querySelector('td:nth-child(4)')?.textContent).not.toContain(
      'overdue'
    );
    expect(element.textContent).toContain('1 purchase order overdue');
  });

  it('gives Receive on sent and part received orders, edit on drafts and view otherwise', async () => {
    const { element } = await render();
    expect(action(element, 'Receive PO-0148')).not.toBeNull();
    expect(action(element, 'Receive PO-0147')).not.toBeNull();
    expect(action(element, 'Receive PO-0145')).toBeNull();
    expect(action(element, 'Receive PO-0149')).toBeNull();
    expect(action(element, 'Edit PO-0149')).not.toBeNull();
    expect(action(element, 'View PO-0149')).toBeNull();
    expect(action(element, 'View PO-0145')).not.toBeNull();
    expect(action(element, 'View PO-0146')).not.toBeNull();
    expect(action(element, 'More options for PO-0148')).not.toBeNull();
    expect(action(element, 'Receive PO-0148')?.textContent?.trim()).toBe('Receive');
    expect(action(element, 'Receive PO-0148')?.getAttribute('data-variant')).toBe('soft');
  });

  it('opens a prefilled GRN from Receive, the edit form from a draft and a read-only view otherwise', async () => {
    const { fixture, element, navigate } = await render();
    action(element, 'Receive PO-0148')?.click();
    expect(navigate).toHaveBeenCalledWith(['/grn', 'new'], { queryParams: { po: 'po-004' } });
    action(element, 'Edit PO-0149')?.click();
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'po-005', 'edit']);
    action(element, 'View PO-0145')?.click();
    expect(navigate).toHaveBeenCalledWith(['/purchase-orders', 'po-001']);
    action(element, 'More options for PO-0148')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
  });

  it('narrows by PO number or supplier ignoring case and updates chip counts', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'po-0148');
    expect(numbers(element)).toEqual(['PO-0148']);
    search(fixture, element, 'CITY med');
    expect(numbers(element)).toEqual(['PO-0147', 'PO-0145']);
    expect(chip(element, 'All').textContent).toContain('2');
    expect(chip(element, 'Sent').textContent).toContain('0');
  });

  it('shows live status chip counts, one selected at a time, and filters by status', async () => {
    const { fixture, element } = await render();
    const counts = Array.from(element.querySelectorAll('button.chip')).map(button =>
      button.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(counts).toEqual([
      'All 5',
      'Draft 1',
      'Sent 1',
      'Part received 1',
      'Received 1',
      'Cancelled 1',
    ]);
    chip(element, 'Part received').click();
    fixture.detectChanges();
    expect(numbers(element)).toEqual(['PO-0147']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
  });

  it('preselects a status from the address and ignores a bad one', async () => {
    const sent = await render(UserRole.MANAGER, { status: 'sent' });
    expect(numbers(sent.element)).toEqual(['PO-0148']);
    TestBed.resetTestingModule();
    const bad = await render(UserRole.MANAGER, { status: 'x" onmouseover="y' });
    expect(numbers(bad.element)).toHaveSize(5);
  });

  it('says plainly when nothing matches and shows no pagination at 10 rows or fewer', async () => {
    const { fixture, element } = await render();
    expect(element.querySelector('app-pagination nav')).toBeNull();
    search(fixture, element, 'zzz');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No purchase orders match');
  });

  it('lets a Pharmacist read the list and use Receive but not create or edit', async () => {
    const { element, navigate } = await render(UserRole.PHARMACIST);
    expect(buttonByText(element, 'New purchase order')).toBeUndefined();
    expect(element.textContent).toContain('you cannot add or change them');
    expect(action(element, 'Edit PO-0149')).toBeNull();
    expect(action(element, 'View PO-0149')).not.toBeNull();
    action(element, 'Receive PO-0148')?.click();
    expect(navigate).toHaveBeenCalledWith(['/grn', 'new'], { queryParams: { po: 'po-004' } });
  });
});
