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
import { GrnListComponent } from './grn-list.component';

describe('GrnListComponent', () => {
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
    const fixture = TestBed.createComponent(GrnListComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const numbers = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('td:nth-child(1)')?.textContent?.trim());
  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement;

  function search(fixture: { detectChanges(): void }, element: HTMLElement, text: string): void {
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows the heading, subtitle, Export and one primary New GRN button', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Goods received notes');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Every delivery you receive, with batches, expiry and what you owe.'
    );
    expect(buttonByText(element, 'Export')).toBeDefined();
    expect(buttonByText(element, 'New GRN').getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('shows the three tiles in order with their notes', async () => {
    const { element } = await render();
    const tiles = Array.from(element.querySelectorAll('app-stat-card'));
    expect(tiles.map(tile => tile.querySelector('.stat__label')?.textContent)).toEqual([
      'Received this month',
      'Waiting to be received',
      'Unpaid to suppliers',
    ]);
    expect(tiles[0].textContent).toContain('Rs. 20,520');
    expect(tiles[0].textContent).toContain('5 GRNs from 3 suppliers');
    expect(tiles[1].textContent).toContain('2 POs');
    expect(tiles[1].textContent).toContain('Expected within 7 days');
    expect(tiles[2].textContent).toContain('Rs. 14,400');
    expect(tiles[2].textContent).toContain('4 invoices · oldest 18 days');
  });

  it('gives a sample-only message from Export and the date button', async () => {
    const { fixture, element } = await render();
    buttonByText(element, 'Export').click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('Export');
    expect(buttonByText(element, 'This month · 1 Sep – 30 Sep 2026')).toBeDefined();
  });

  it('opens an empty New GRN form from the primary button', async () => {
    const { element } = await render();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    buttonByText(element, 'New GRN').click();
    expect(navigate).toHaveBeenCalledWith(['/grn', 'new']);
  });

  it('shows each GRN row with reference, items, total and word badges', async () => {
    const { element } = await render();
    expect(numbers(element)).toEqual([
      'GRN-0211',
      'GRN-0208',
      'GRN-0210',
      'GRN-0209',
      'GRN-0206',
      'GRN-0207',
      'GRN-0205',
    ]);
    const second = rows(element)[1];
    const text = (selector: string) => second.querySelector(selector)?.textContent?.trim();
    expect(second.querySelector('td.is-mono')?.textContent?.trim()).toBe('GRN-0208');
    expect(text('td:nth-child(2)')).toBe('18 Sep 2026');
    expect(text('td:nth-child(3)')).toContain('Lanka Pharma');
    expect(text('td:nth-child(3) .cell-sub')).toBe('Received by Dilani Fernando');
    expect(text('td:nth-child(4)')).toBe('INV-88214 / No PO');
    expect(text('td:nth-child(5)')).toBe('2');
    expect(text('td:nth-child(6)')).toBe('3,300.00');
    expect(text('td:nth-child(7)')).toBe('Unpaid');
    expect(text('td:nth-child(8)')).toBe('Received');
    expect(rows(element)[3].querySelector('td:nth-child(4)')?.textContent?.trim()).toBe(
      'INV-5521 / PO-0145'
    );
    const headings = Array.from(element.querySelectorAll('thead th')).map(th =>
      th.textContent?.trim()
    );
    expect(headings).toContain('Total (Rs.)');
  });

  it('gives open and more actions with accessible names and no pagination under 10 rows', async () => {
    const { fixture, element } = await render();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const labels = Array.from(rows(element)[1].querySelectorAll('button.row-action')).map(button =>
      button.getAttribute('aria-label')
    );
    expect(labels).toEqual(['Open GRN-0208', 'More options for GRN-0208']);
    (element.querySelector('button[aria-label="Open GRN-0208"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/grn', 'grn-001']);
    (
      element.querySelector('button[aria-label="More options for GRN-0208"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(TestBed.inject(NotificationService).current()?.message).toContain('sample only');
    expect(element.querySelector('app-pagination nav, app-pagination .pagination')).toBeNull();
  });

  it('narrows by GRN number, invoice number and supplier ignoring case and updates counts', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'grn-0209');
    expect(numbers(element)).toEqual(['GRN-0209']);
    search(fixture, element, 'inv-88214');
    expect(numbers(element)).toEqual(['GRN-0208']);
    search(fixture, element, 'CITY');
    expect(numbers(element)).toEqual(['GRN-0209']);
    expect(chip(element, 'All').textContent).toContain('1');
    expect(chip(element, 'Draft').textContent).toContain('0');
  });

  it('shows live chip counts with exactly one chip selected and filters by status', async () => {
    const { fixture, element } = await render();
    const counts = Array.from(element.querySelectorAll('button.chip')).map(button =>
      button.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(counts).toEqual(['All 7', 'Draft 1', 'Received 5', 'Cancelled 1']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    chip(element, 'Received').click();
    fixture.detectChanges();
    expect(numbers(element)).toEqual(['GRN-0208', 'GRN-0210', 'GRN-0209', 'GRN-0206', 'GRN-0205']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    chip(element, 'Draft').click();
    fixture.detectChanges();
    expect(numbers(element)).toEqual(['GRN-0211']);
  });

  it('preselects a status from the address and falls back to All for a bad one', async () => {
    const draft = await render(UserRole.MANAGER, { status: 'draft' });
    expect(numbers(draft.element)).toEqual(['GRN-0211']);
    TestBed.resetTestingModule();
    const bad = await render(UserRole.MANAGER, { status: '<script>' });
    expect(numbers(bad.element)).toHaveSize(7);
  });

  it('says plainly when nothing matches', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'zzz');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No GRNs match');
    expect(element.textContent).toContain('Clear the search');
  });

  it('lets a Pharmacist open the list and start a GRN', async () => {
    const { element } = await render(UserRole.PHARMACIST);
    expect(buttonByText(element, 'New GRN')).toBeDefined();
    expect(numbers(element)).toHaveSize(7);
  });
});
