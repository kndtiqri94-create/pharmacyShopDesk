import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { firstValueFrom } from 'rxjs';
import { LeaveStatus } from '../../../../core/models/enums/leave-status.enum';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { LeaveDataService } from '../../../../core/services/data/leave-data.service';
import { PayrollDataService } from '../../../../core/services/data/payroll-data.service';
import { RoleDataService } from '../../../../core/services/data/role-data.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PayrollExportService } from '../../../../core/services/payroll-export.service';
import { PayrollService } from '../../../../core/services/payroll.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PayrollComponent } from './payroll.component';

describe('PayrollComponent', () => {
  beforeEach(() => clearBrowserStorage());
  afterEach(clearBrowserStorage);

  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.configureTestingModule({ providers: [...TEST_PROVIDERS, provideRouter([])] });
    await signInAs(role);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(PayrollComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement, navigate };
  }

  type Rendered = Awaited<ReturnType<typeof render>>;

  const names = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('tbody tr')).map(row =>
      row.querySelector('td')?.textContent?.replace(/\s+/g, ' ').trim()
    );
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const tab = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('[role="tab"]')).find(
      item => item.textContent?.trim() === label
    ) as HTMLButtonElement;
  const control = (element: HTMLElement, id: string) =>
    element.querySelector(`#${id}`) as HTMLInputElement & HTMLSelectElement;

  async function set({ fixture, element }: Rendered, id: string, value: string, event: string) {
    const field = control(element, id);
    field.value = value;
    field.dispatchEvent(new Event(event));
    fixture.detectChanges();
  }

  async function filter(rendered: Rendered): Promise<void> {
    buttonByText(rendered.element, 'Filter')!.click();
    await settle(rendered.fixture);
  }

  it('shows the title, Back, both tabs, the filters, the sample note and one primary button', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Employees salaries');
    expect(buttonByText(element, 'Back to employees')).toBeDefined();
    expect(
      Array.from(element.querySelectorAll('[role="tab"]')).map(item => item.textContent?.trim())
    ).toEqual(['Monthly Pay', 'Daily Pay']);
    expect(tab(element, 'Monthly Pay').getAttribute('aria-selected')).toBe('true');
    for (const label of ['Keyword', 'Location', 'Year', 'Month']) {
      expect(element.querySelector('app-payroll-filters')?.textContent).toContain(label);
    }
    expect(buttonByText(element, 'Reset')).toBeDefined();
    expect(element.querySelector('[data-testid="sample-note"]')?.textContent).toContain(
      'Sample rates, not payroll law'
    );
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
  });

  it('starts on the current month and lists only active Monthly employees', async () => {
    const { element } = await render();
    expect(element.querySelector('app-page-header')?.textContent).toContain('September 2026');
    expect(control(element, 'payroll-filter-year').value).toBe('2026');
    expect(control(element, 'payroll-filter-month').value).toBe('9');
    expect(names(element)).toEqual([
      'Anura Bandara EMP-007',
      'Dilani Fernando EMP-003',
      'Kamal Silva EMP-002',
      'Nimal Perera EMP-001',
      'Ruwani Jayawardena EMP-004',
    ]);
    expect(element.querySelector('[data-testid="entries-text"]')?.textContent?.trim()).toBe(
      'Showing 1 to 5 of 5 entries'
    );
  });

  it('shows the Daily employees with Daily Rate and Days Worked on the Daily tab', async () => {
    const { fixture, element } = await render();
    tab(element, 'Daily Pay').click();
    await settle(fixture);
    expect(names(element)).toEqual(['Suresh Kumar EMP-005', 'Tharindu Silva EMP-006']);
    const headings = Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headings).toContain('Daily Rate (Rs.)');
    expect(headings).toContain('Days Worked');
  });

  it('does not change the table until Filter is chosen, then filters by keyword', async () => {
    const rendered = await render();
    await set(rendered, 'payroll-filter-keyword', 'kamal', 'input');
    expect(names(rendered.element)).toHaveSize(5);
    await filter(rendered);
    expect(names(rendered.element)).toEqual(['Kamal Silva EMP-002']);
  });

  it('filters by month and shows Paid for an earlier sample month', async () => {
    const rendered = await render();
    await set(rendered, 'payroll-filter-month', '8', 'change');
    await filter(rendered);
    const badges = Array.from(rendered.element.querySelectorAll('app-badge')).map(item =>
      item.textContent?.trim()
    );
    expect(badges).toContain('Paid');
    expect(rendered.element.querySelector('app-page-header')?.textContent).toContain('August 2026');
  });

  it('shows the empty state when nothing matches and Reset returns to the current month', async () => {
    const rendered = await render();
    await set(rendered, 'payroll-filter-keyword', 'zzzzzz', 'input');
    await filter(rendered);
    expect(rendered.element.textContent).toContain('No employees match');
    buttonByText(rendered.element, 'Reset filters')!.click();
    await settle(rendered.fixture);
    expect(names(rendered.element)).toHaveSize(5);
    expect(control(rendered.element, 'payroll-filter-keyword').value).toBe('');
  });

  it('Reset on the filters returns Year and Month to the current month', async () => {
    const rendered = await render();
    await set(rendered, 'payroll-filter-month', '2', 'change');
    await filter(rendered);
    buttonByText(rendered.element, 'Reset')!.click();
    await settle(rendered.fixture);
    expect(control(rendered.element, 'payroll-filter-month').value).toBe('9');
    expect(rendered.element.querySelector('app-page-header')?.textContent).toContain(
      'September 2026'
    );
  });

  it('offers the locations from the employees', async () => {
    const { element } = await render();
    const options = Array.from(
      control(element, 'payroll-filter-location').querySelectorAll('option')
    ).map(option => option.textContent?.trim());
    expect(options[0]).toBe('All locations');
    expect(options.length).toBeGreaterThan(1);
  });

  it('goes back to Employees', async () => {
    const { fixture, element, navigate } = await render();
    buttonByText(element, 'Back to employees')!.click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/employees']);
  });

  it('lets a Manager see the page and export, with no row actions', async () => {
    const { element } = await render(UserRole.MANAGER);
    expect(names(element)).toHaveSize(5);
    expect(element.querySelector('app-payroll-row-menu')).toBeNull();
    expect(element.querySelector('[aria-label="Actions"]')).toBeNull();
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
    expect(buttonByText(element, 'Export PDF')).toBeDefined();
  });

  describe('export', () => {
    let created: Blob[];

    beforeEach(() => {
      created = [];
      spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
        created.push(blob as Blob);
        return 'blob:test';
      });
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
    });

    it('offers non-primary Export CSV and Export PDF buttons to an Admin', async () => {
      const { element } = await render();
      for (const label of ['Export CSV', 'Export PDF']) {
        const button = buttonByText(element, label)!;
        expect(button).toBeDefined();
        expect(button.className).not.toContain('primary');
        expect(button.disabled).toBeFalse();
      }
    });

    it('hands every filtered row (all pages) to the export, not the table page slice', async () => {
      const rendered = await render();
      const exportSpy = spyOn(TestBed.inject(PayrollExportService), 'exportCsv').and.resolveTo({
        ok: true,
        fileName: 'x',
      });
      buttonByText(rendered.element, 'Export CSV')!.click();
      const [rows, activeTab] = exportSpy.calls.mostRecent().args;
      expect(rows).toHaveSize(5);
      expect(activeTab).toBe('monthly');
      const all = await firstValueFrom(
        TestBed.inject(PayrollService).getPayrollRows(
          'monthly',
          exportSpy.calls.mostRecent().args[2]
        )
      );
      expect(rows.map(row => row.employee.id)).toEqual(all.map(row => row.employee.id));
    });

    it('exports a real CSV of all rows with money headings', async () => {
      const rendered = await render();
      buttonByText(rendered.element, 'Export CSV')!.click();
      await settle(rendered.fixture);
      const lines = (await created[0].text()).trim().split('\r\n');
      expect(lines).toHaveSize(6);
      expect(lines[0]).toContain('Basic Salary (Rs.)');
    });

    it('exports the active tab with the chosen month in the file name', async () => {
      const rendered = await render();
      tab(rendered.element, 'Daily Pay').click();
      await settle(rendered.fixture);
      buttonByText(rendered.element, 'Export CSV')!.click();
      await settle(rendered.fixture);
      const lines = (await created[0].text()).trim().split('\r\n');
      expect(lines[0]).toContain('Daily Rate (Rs.)');
      expect(lines).toHaveSize(3);
    });
  });

  describe('row actions', () => {
    const headers = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim());
    const rowOf = (element: HTMLElement, code: string) =>
      Array.from(element.querySelectorAll('tbody tr')).find(tr =>
        tr.querySelector('td')?.textContent?.includes(code)
      ) as HTMLTableRowElement;
    const cell = (element: HTMLElement, code: string, header: string) => {
      const index = headers(element).findIndex(text => text?.startsWith(header));
      return rowOf(element, code)
        .querySelectorAll('td')
        [index].textContent?.replace(/\s+/g, ' ')
        .trim();
    };
    const openMenu = async ({ fixture, element }: Rendered, code: string) => {
      (rowOf(element, code).querySelector('.trigger') as HTMLButtonElement).click();
      fixture.detectChanges();
      await settle(fixture);
    };
    const choose = async (rendered: Rendered, code: string, label: string) => {
      await openMenu(rendered, code);
      const item = Array.from(rendered.element.querySelectorAll('[role="menuitem"]')).find(
        node => node.textContent?.trim() === label
      ) as HTMLButtonElement;
      item.click();
      rendered.fixture.detectChanges();
      await settle(rendered.fixture);
    };
    const dialogButton = (element: HTMLElement, text: string) =>
      Array.from(element.querySelectorAll('dialog button')).find(
        node => node.textContent?.trim() === text
      ) as HTMLButtonElement;
    const type = (rendered: Rendered, selector: string, value: string, event = 'input') => {
      const field = rendered.element.querySelector(`dialog ${selector}`) as
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      field.value = value;
      field.dispatchEvent(new Event(event));
      rendered.fixture.detectChanges();
    };
    const message = () => TestBed.inject(NotificationService).current()?.message ?? '';

    it('gives an Admin an Action column and a menu with the three actions', async () => {
      const rendered = await render();
      expect(headers(rendered.element)).toContain('Action');
      expect(rendered.element.querySelectorAll('tbody .trigger')).toHaveSize(5);
      await openMenu(rendered, 'EMP-004');
      expect(
        Array.from(rendered.element.querySelectorAll('[role="menuitem"]')).map(node =>
          node.textContent?.trim()
        )
      ).toEqual(['Add Leave', 'Add Salary Advance', 'Add Nopay Amount']);
      expect(
        rowOf(rendered.element, 'EMP-004').querySelector('.trigger')?.getAttribute('aria-expanded')
      ).toBe('true');
    });

    it('closes the menu with Escape and returns focus to the trigger', async () => {
      const rendered = await render();
      await openMenu(rendered, 'EMP-004');
      const menu = rendered.element.querySelector('[role="menu"]') as HTMLElement;
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      rendered.fixture.detectChanges();
      expect(rendered.element.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(
        rowOf(rendered.element, 'EMP-004').querySelector('.trigger')
      );
    });

    it('shows a Manager no Action column and no menu', async () => {
      const { element } = await render(UserRole.MANAGER);
      expect(headers(element)).not.toContain('Action');
      expect(element.querySelector('.trigger')).toBeNull();
    });

    it('adds and removes the Action column when the matrix changes in the session', async () => {
      const rendered = await render(UserRole.MANAGER);
      const permissions = TestBed.inject(PermissionService);
      const roleData = TestBed.inject(RoleDataService);
      const setLevel = async (level: PermissionLevel) => {
        const matrix = await firstValueFrom(roleData.getMatrix());
        await firstValueFrom(
          roleData.saveMatrix({
            ...matrix,
            [UserRole.MANAGER]: { ...matrix[UserRole.MANAGER], [ModuleKey.PAYROLL]: level },
          })
        );
        await permissions.load();
        rendered.fixture.detectChanges();
      };
      await setLevel(PermissionLevel.FULL);
      expect(headers(rendered.element)).toContain('Action');
      await setLevel(PermissionLevel.VIEW);
      expect(headers(rendered.element)).not.toContain('Action');
    });

    it('adds a salary advance, closes the dialog, names only the employee and recalculates', async () => {
      const rendered = await render();
      const advanceBefore = cell(rendered.element, 'EMP-004', 'Salary Advance');
      const netBefore = cell(rendered.element, 'EMP-004', 'Net Salary');
      await choose(rendered, 'EMP-004', 'Add Salary Advance');
      expect(rendered.element.querySelector('dialog')?.textContent).toContain(
        'Create Salary Advance'
      );
      type(rendered, 'select', 'Counter1', 'change');
      type(rendered, 'input[inputmode="decimal"]', '5000');
      dialogButton(rendered.element, 'Save').click();
      await settle(rendered.fixture);
      expect(rendered.element.querySelector('dialog')).toBeNull();
      expect(message()).toBe('Salary advance added for Ruwani Jayawardena.');
      expect(message()).not.toContain('5000');
      expect(cell(rendered.element, 'EMP-004', 'Salary Advance')).not.toBe(advanceBefore);
      expect(cell(rendered.element, 'EMP-004', 'Net Salary')).not.toBe(netBefore);
    });

    it('adds a nopay amount and updates Total Nopay', async () => {
      const rendered = await render();
      const before = cell(rendered.element, 'EMP-004', 'Total Nopay');
      await choose(rendered, 'EMP-004', 'Add Nopay Amount');
      type(rendered, 'input[inputmode="decimal"]', '1000');
      type(rendered, 'textarea', 'Absent without notice');
      dialogButton(rendered.element, 'Save').click();
      await settle(rendered.fixture);
      expect(rendered.element.querySelector('dialog')).toBeNull();
      expect(message()).toBe('Nopay amount added for Ruwani Jayawardena.');
      expect(message()).not.toContain('Absent');
      expect(cell(rendered.element, 'EMP-004', 'Total Nopay')).not.toBe(before);
    });

    it('adds a one-day leave that shows in the Leaves cell and the Leave tab data', async () => {
      const rendered = await render();
      expect(cell(rendered.element, 'EMP-004', 'Leaves')).toBe('N/A');
      await choose(rendered, 'EMP-004', 'Add Leave');
      dialogButton(rendered.element, 'Save').click();
      await settle(rendered.fixture);
      expect(rendered.element.querySelector('dialog')).toBeNull();
      expect(message()).toBe('Leave added for Ruwani Jayawardena.');
      expect(cell(rendered.element, 'EMP-004', 'Leaves')).toBe('1');
      const requests = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
      const added = requests.filter(
        item => item.employeeId === 'emp-004' && item.fromDate === '2026-09-21'
      );
      expect(added).toHaveSize(1);
      expect(added[0].status).toBe(LeaveStatus.APPROVED);
    });

    it('keeps the dialog open with field errors and focuses the first one', async () => {
      const rendered = await render();
      await choose(rendered, 'EMP-004', 'Add Salary Advance');
      dialogButton(rendered.element, 'Save').click();
      await settle(rendered.fixture);
      const dialog = rendered.element.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).not.toBeNull();
      expect(dialog.textContent).toContain('Choose a counter');
      expect(dialog.textContent).toContain('must be above 0');
      expect(document.activeElement?.tagName).toBe('SELECT');
    });

    it('cancels without saving', async () => {
      const rendered = await render();
      const advances = (await firstValueFrom(TestBed.inject(PayrollDataService).getAdvances()))
        .length;
      await choose(rendered, 'EMP-004', 'Add Salary Advance');
      dialogButton(rendered.element, 'Cancel').click();
      await settle(rendered.fixture);
      expect(rendered.element.querySelector('dialog')).toBeNull();
      expect((await firstValueFrom(TestBed.inject(PayrollDataService).getAdvances())).length).toBe(
        advances
      );
    });

    it('closes with a clear message when access was removed while the dialog was open', async () => {
      const rendered = await render();
      await choose(rendered, 'EMP-004', 'Add Nopay Amount');
      const roleData = TestBed.inject(RoleDataService);
      const matrix = await firstValueFrom(roleData.getMatrix());
      await firstValueFrom(
        roleData.saveMatrix({
          ...matrix,
          [UserRole.ADMIN]: {
            ...matrix[UserRole.ADMIN],
            [ModuleKey.PAYROLL]: PermissionLevel.VIEW,
          },
        })
      );
      await TestBed.inject(PermissionService).load();
      type(rendered, 'input[inputmode="decimal"]', '1000');
      type(rendered, 'textarea', 'Reason');
      dialogButton(rendered.element, 'Save').click();
      await settle(rendered.fixture);
      expect(rendered.element.querySelector('dialog')).toBeNull();
      expect(message()).toBe('You do not have access to change salaries.');
    });
  });

  it('keeps pay data out of browser storage and the address', async () => {
    const { fixture } = await render();
    fixture.detectChanges();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.getItem('payroll')).toBeNull();
    expect(TestBed.inject(Router).url).not.toContain('payroll=');
  });
});
