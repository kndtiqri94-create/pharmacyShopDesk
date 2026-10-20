import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { Employee } from '../../../../core/models/domain/employee.model';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { EmployeeDataService } from '../../../../core/services/data/employee-data.service';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { USER_SEED } from '../../../../core/services/data/in-memory/seed/user.seed';
import { EmployeeExportService } from '../../../../core/services/employee-export.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeListComponent } from './employee-list.component';

function manyEmployees(count: number): Employee[] {
  return Array.from({ length: count }, (_, index) => ({
    ...EMPLOYEE_SEED[0],
    id: `x-${index}`,
    code: `X-${String(index).padStart(2, '0')}`,
    name: `Person ${index}`,
    createdAt: `2026-08-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
  }));
}

describe('EmployeeListComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(
    role: UserRole = UserRole.ADMIN,
    employees: readonly Employee[] = EMPLOYEE_SEED
  ) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(EmployeeListComponent);
    fixture.componentRef.setInput('employees', employees);
    fixture.componentRef.setInput('users', USER_SEED);
    fixture.componentRef.setInput('onLeaveIds', new Set(['emp-007']));
    const changed: number[] = [];
    fixture.componentInstance.changed.subscribe(() => changed.push(1));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate, changed };
  }

  type Rendered = Awaited<ReturnType<typeof render>>;

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const codes = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('td:nth-child(2)')?.textContent?.trim());
  const entries = (element: HTMLElement) =>
    element.querySelector('[data-testid="entries-text"]')?.textContent?.trim();
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const control = (element: HTMLElement, id: string) =>
    element.querySelector(`#${id}`) as HTMLInputElement & HTMLSelectElement;
  const rowOf = (element: HTMLElement, code: string) =>
    rows(element).find(row => row.textContent?.includes(code))!;
  const notification = () => TestBed.inject(NotificationService).current();

  function type({ fixture, element }: Rendered, id: string, value: string, event = 'input'): void {
    const field = control(element, id);
    field.value = value;
    field.dispatchEvent(new Event(event));
    fixture.detectChanges();
  }

  function filter(rendered: Rendered): void {
    buttonByText(rendered.element, 'Filter')!.click();
    rendered.fixture.detectChanges();
  }

  function reset(rendered: Rendered): void {
    buttonByText(rendered.element, 'Reset')!.click();
    rendered.fixture.detectChanges();
  }

  async function settle({ fixture }: Rendered): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  it('shows the filters, export buttons, one primary Add employee and the ten columns', async () => {
    const { element } = await render();
    for (const label of ['Keyword', 'Location', 'Created from', 'Created to', 'Status']) {
      expect(element.textContent).toContain(label);
    }
    expect(buttonByText(element, 'Filter')).toBeDefined();
    expect(buttonByText(element, 'Reset')).toBeDefined();
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
    expect(buttonByText(element, 'Export PDF')).toBeDefined();
    expect(buttonByText(element, 'Add employee')?.getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
    const headers = Array.from(element.querySelectorAll('thead th')).map(item =>
      item.textContent?.trim()
    );
    expect(headers).toEqual([
      'Image',
      'EMP Code',
      'Name',
      'Address',
      'Mobile',
      'Email',
      'DOB',
      'Location',
      'Status',
      'Actions',
    ]);
  });

  it('lists everyone newest first with a status word and a placeholder in place of the photo', async () => {
    const { element } = await render();
    expect(codes(element)).toEqual([
      'EMP-008',
      'EMP-007',
      'EMP-006',
      'EMP-005',
      'EMP-004',
      'EMP-003',
      'EMP-002',
      'EMP-001',
    ]);
    const first = rows(element)[0];
    const cell = (index: number) =>
      first.querySelector(`td:nth-child(${index})`)?.textContent?.trim();
    expect(first.querySelector('app-avatar')).not.toBeNull();
    expect(first.querySelector('img')).toBeNull();
    expect(cell(3)).toBe('Sanduni Wickrama');
    expect(cell(4)).toBe('5 Church Road, Moratuwa, Western, Sri Lanka, 10100');
    expect(cell(5)).toBe('77 100 0008');
    expect(cell(6)).toBe('sanduni.w@example.com');
    expect(cell(7)).toBe('25 Apr 1992');
    expect(cell(8)).toBe('Main Pharmacy');
    expect(cell(9)).toBe('Inactive');
    expect(rowOf(element, 'EMP-007').querySelector('td:nth-child(9)')?.textContent?.trim()).toBe(
      'On leave'
    );
    expect(entries(element)).toBe('Showing 1 to 8 of 8 entries');
  });

  it('shows On leave only for someone away today and treats the stored status as Active otherwise', async () => {
    const away = await render();
    expect(
      rowOf(away.element, 'EMP-007').querySelector('td:nth-child(9)')?.textContent?.trim()
    ).toBe('On leave');
    expect(
      rowOf(away.element, 'EMP-001').querySelector('td:nth-child(9)')?.textContent?.trim()
    ).toBe('Active');
    away.fixture.componentRef.setInput('onLeaveIds', new Set<string>());
    away.fixture.detectChanges();
    expect(
      rowOf(away.element, 'EMP-007').querySelector('td:nth-child(9)')?.textContent?.trim()
    ).toBe('Active');
  });

  it('keeps someone on leave in the Active filter', async () => {
    const rendered = await render();
    type(rendered, 'employee-filter-status', 'active', 'change');
    filter(rendered);
    expect(codes(rendered.element)).toContain('EMP-007');
    expect(codes(rendered.element)).not.toContain('EMP-008');
  });

  it('shows the photo when an employee has one', async () => {
    const withPhoto = { ...EMPLOYEE_SEED[0], photoDataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
    const { element } = await render(UserRole.ADMIN, [withPhoto]);
    const image = element.querySelector('tbody img') as HTMLImageElement;
    expect(image.getAttribute('alt')).toBe('');
    expect(element.querySelector('tbody app-avatar')).toBeNull();
  });

  it('applies the keyword only when Filter is chosen, ignoring capital letters', async () => {
    const rendered = await render();
    type(rendered, 'employee-filter-keyword', 'SURESH');
    expect(rows(rendered.element)).toHaveSize(8);
    filter(rendered);
    expect(codes(rendered.element)).toEqual(['EMP-005']);
    type(rendered, 'employee-filter-keyword', 'emp-003');
    filter(rendered);
    expect(codes(rendered.element)).toEqual(['EMP-003']);
    type(rendered, 'employee-filter-keyword', 'ruwani.j@');
    filter(rendered);
    expect(codes(rendered.element)).toEqual(['EMP-004']);
  });

  it('filters by status, created at and location together, and Reset clears them all', async () => {
    const rendered = await render();
    const { element } = rendered;
    type(rendered, 'employee-filter-status', 'inactive', 'change');
    filter(rendered);
    expect(codes(element)).toEqual(['EMP-008']);
    type(rendered, 'employee-filter-status', 'active', 'change');
    type(rendered, 'employee-filter-created-from', '2026-03-01');
    type(rendered, 'employee-filter-created-to', '2026-05-31');
    filter(rendered);
    expect(codes(element)).toEqual(['EMP-006', 'EMP-005', 'EMP-004']);
    type(rendered, 'employee-filter-location', 'Main Pharmacy', 'change');
    type(rendered, 'employee-filter-keyword', 'silva');
    filter(rendered);
    expect(codes(element)).toEqual(['EMP-006']);
    expect(entries(element)).toBe('Showing 1 to 1 of 1 entries');
    reset(rendered);
    expect(rows(element)).toHaveSize(8);
    expect(control(element, 'employee-filter-keyword').value).toBe('');
    expect(control(element, 'employee-filter-status').value).toBe('all');
    expect(control(element, 'employee-filter-created-from').value).toBe('');
  });

  it('ignores an unknown location, status or date typed into the controls', async () => {
    const rendered = await render();
    type(rendered, 'employee-filter-created-from', 'not a date');
    filter(rendered);
    expect(rows(rendered.element)).toHaveSize(8);
  });

  it('says plainly when nobody matches, counts 0 to 0 of 0 and offers Reset', async () => {
    const rendered = await render();
    type(rendered, 'employee-filter-keyword', 'zzz');
    filter(rendered);
    const { element } = rendered;
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No employees match');
    expect(entries(element)).toBe('Showing 0 to 0 of 0 entries');
    buttonByText(element, 'Reset filters')!.click();
    rendered.fixture.detectChanges();
    expect(rows(element)).toHaveSize(8);
  });

  it('says what to do when there are no employees at all', async () => {
    const { element } = await render(UserRole.ADMIN, []);
    expect(element.textContent).toContain('No employees yet');
    expect(buttonByText(element, 'Reset filters')).toBeUndefined();
  });

  it('pages by ten, moves between pages and returns to page one when the page size changes', async () => {
    const rendered = await render(UserRole.ADMIN, manyEmployees(25));
    const { fixture, element } = rendered;
    expect(rows(element)).toHaveSize(10);
    expect(entries(element)).toBe('Showing 1 to 10 of 25 entries');
    (element.querySelector('button[aria-label="Next page"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(entries(element)).toBe('Showing 11 to 20 of 25 entries');
    expect(codes(element)[0]).toBe('X-14');
    type(rendered, 'employee-page-size', '25', 'change');
    expect(rows(element)).toHaveSize(25);
    expect(entries(element)).toBe('Showing 1 to 25 of 25 entries');
    expect(element.querySelector('app-data-table app-pagination')).toBeNull();
    type(rendered, 'employee-page-size', '1000', 'change');
    expect(rows(element)).toHaveSize(10);
  });

  it('offers view, edit and delete to an Admin, each named for the person', async () => {
    const { element } = await render();
    const labels = Array.from(rowOf(element, 'EMP-001').querySelectorAll('button.row-action')).map(
      button => button.getAttribute('aria-label')
    );
    expect(labels).toEqual(['View Nimal Perera', 'Edit Nimal Perera', 'Delete Nimal Perera']);
  });

  it('lets a Manager look and export but hides Add employee, edit and delete', async () => {
    const { element } = await render(UserRole.MANAGER);
    expect(rows(element)).toHaveSize(8);
    expect(buttonByText(element, 'Add employee')).toBeUndefined();
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
    expect(buttonByText(element, 'Export PDF')).toBeDefined();
    const labels = Array.from(rowOf(element, 'EMP-001').querySelectorAll('button.row-action')).map(
      button => button.getAttribute('aria-label')
    );
    expect(labels).toEqual(['View Nimal Perera']);
  });

  it('opens the new, view and edit routes', async () => {
    const { fixture, element, navigate } = await render();
    buttonByText(element, 'Add employee')!.click();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'new']);
    const row = rowOf(element, 'EMP-002');
    (row.querySelector('button[aria-label="View Kamal Silva"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'emp-002']);
    (row.querySelector('button[aria-label="Edit Kamal Silva"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/employees', 'emp-002', 'edit']);
    fixture.detectChanges();
  });

  it('exports every filtered row, not only the current page, and the filters used', async () => {
    const rendered = await render(UserRole.ADMIN, manyEmployees(25));
    const exportService = TestBed.inject(EmployeeExportService);
    const csv = spyOn(exportService, 'exportCsv').and.resolveTo({ ok: true, fileName: 'a.csv' });
    const pdf = spyOn(exportService, 'exportPdf').and.resolveTo({ ok: true, fileName: 'a.pdf' });
    type(rendered, 'employee-filter-keyword', 'person');
    filter(rendered);
    buttonByText(rendered.element, 'Export CSV')!.click();
    expect(csv.calls.mostRecent().args[0]).toHaveSize(25);
    await settle(rendered);
    buttonByText(rendered.element, 'Export PDF')!.click();
    const [exported, criteria] = pdf.calls.mostRecent().args;
    expect(exported).toHaveSize(25);
    expect(criteria.keyword).toBe('person');
    await settle(rendered);
  });

  it('tells the person there is nothing to export when no row matches', async () => {
    const rendered = await render();
    type(rendered, 'employee-filter-keyword', 'zzz');
    filter(rendered);
    buttonByText(rendered.element, 'Export CSV')!.click();
    await settle(rendered);
    expect(notification()?.message).toBe('There is nothing to export.');
  });

  it('does not start a second export while one is running', async () => {
    const rendered = await render();
    let release: () => void = () => undefined;
    const csv = spyOn(TestBed.inject(EmployeeExportService), 'exportCsv').and.returnValue(
      new Promise(resolve => {
        release = () => resolve({ ok: true, fileName: 'a.csv' });
      })
    );
    buttonByText(rendered.element, 'Export CSV')!.click();
    rendered.fixture.detectChanges();
    expect(buttonByText(rendered.element, 'Export CSV')!.disabled).toBeTrue();
    expect(buttonByText(rendered.element, 'Export PDF')!.disabled).toBeTrue();
    buttonByText(rendered.element, 'Export CSV')!.click();
    expect(csv).toHaveBeenCalledTimes(1);
    release();
    await settle(rendered);
    expect(buttonByText(rendered.element, 'Export CSV')!.disabled).toBeFalse();
  });

  describe('delete', () => {
    const deleteButton = (element: HTMLElement, code: string, name: string) =>
      rowOf(element, code).querySelector(`button[aria-label="Delete ${name}"]`) as HTMLElement;
    const dialog = (element: HTMLElement) => element.querySelector('dialog') as HTMLDialogElement;
    const stored = () => firstValueFrom(TestBed.inject(EmployeeDataService).getAll());

    it('names the employee and what will happen, and changes nothing when cancelled', async () => {
      const rendered = await render();
      const { fixture, element, changed } = rendered;
      deleteButton(element, 'EMP-005', 'Suresh Kumar').click();
      fixture.detectChanges();
      expect(dialog(element).open).toBeTrue();
      expect(dialog(element).textContent).toContain('Delete Suresh Kumar?');
      expect(dialog(element).textContent).toContain('will be removed from the list');
      buttonByText(element, 'Cancel')!.click();
      fixture.detectChanges();
      expect(dialog(element).open).toBeFalse();
      expect((await stored()).map(item => item.id)).toContain('emp-005');
      expect(changed).toHaveSize(0);
    });

    it('says the record will be kept when the employee has a sign-in', async () => {
      const { fixture, element } = await render();
      deleteButton(element, 'EMP-002', 'Kamal Silva').click();
      fixture.detectChanges();
      expect(dialog(element).textContent).toContain('has a sign-in, so the record will be kept');
    });

    it('removes an employee with no history and tells the page to reload', async () => {
      const rendered = await render();
      deleteButton(rendered.element, 'EMP-005', 'Suresh Kumar').click();
      rendered.fixture.detectChanges();
      buttonByText(rendered.element, 'Delete employee')!.click();
      await settle(rendered);
      expect(notification()?.message).toBe('Suresh Kumar was removed.');
      expect((await stored()).map(item => item.id)).not.toContain('emp-005');
      expect(rendered.changed).toHaveSize(1);
      expect(dialog(rendered.element).open).toBeFalse();
    });

    it('keeps an employee with a sign-in as Inactive and says why', async () => {
      const rendered = await render();
      deleteButton(rendered.element, 'EMP-002', 'Kamal Silva').click();
      rendered.fixture.detectChanges();
      buttonByText(rendered.element, 'Delete employee')!.click();
      await settle(rendered);
      expect(notification()?.message).toBe(
        'Kamal Silva was kept and marked Inactive because they have history.'
      );
      const kept = (await stored()).find(item => item.id === 'emp-002');
      expect(kept?.status).toBe('INACTIVE');
      expect(rendered.changed).toHaveSize(1);
    });

    it('refuses when the role lost write access before the confirmation', async () => {
      const rendered = await render();
      deleteButton(rendered.element, 'EMP-005', 'Suresh Kumar').click();
      rendered.fixture.detectChanges();
      await signInAs(UserRole.MANAGER);
      buttonByText(rendered.element, 'Delete employee')!.click();
      await settle(rendered);
      expect(notification()?.message).toBe('You do not have access to delete employees.');
      expect((await stored()).map(item => item.id)).toContain('emp-005');
    });
  });
});
