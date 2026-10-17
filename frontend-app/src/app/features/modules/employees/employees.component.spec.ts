import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { NotificationService } from '../../../core/services/notification.service';
import { EmployeesComponent } from './employees.component';

describe('EmployeesComponent', () => {
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

  async function render(role: UserRole = UserRole.ADMIN) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(EmployeesComponent);
    fixture.detectChanges();
    await settle(fixture);
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const staffNames = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('.employee-cell__name')?.textContent?.trim());
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const tab = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
      item.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const notification = () => TestBed.inject(NotificationService).current();

  function search(fixture: Detectable, element: HTMLElement, text: string): void {
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows the heading, how many staff are on shift, Export and one primary Add employee', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Employees');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      '8 staff · 5 on shift today'
    );
    expect(buttonByText(element, 'Export')).toBeDefined();
    expect(buttonByText(element, 'Add employee')?.getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
  });

  it('gives a sample-only message from Export and Add employee and changes nothing', async () => {
    const { fixture, element } = await render();
    buttonByText(element, 'Export')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Export');
    buttonByText(element, 'Add employee')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Add employee');
    expect(rows(element)).toHaveSize(8);
  });

  it('shows the four tiles in order with their notes', async () => {
    const { element } = await render();
    const tiles = Array.from(element.querySelectorAll('app-stat-card'));
    expect(tiles.map(tile => tile.querySelector('.stat__label')?.textContent)).toEqual([
      'Total staff',
      'On shift today',
      'On leave',
      'Can log in',
    ]);
    const text = (index: number) => tiles[index].textContent ?? '';
    expect(text(0)).toContain('8');
    expect(text(0)).toContain('6 full-time · 2 part-time');
    expect(text(1)).toContain('5');
    expect(text(1)).toContain('1 late this morning');
    expect(text(2)).toContain('Back on 24 Sep');
    expect(text(3)).toContain('4');
    expect(text(3)).toContain('Others have no system access');
  });

  it('shows the tabs with live counts and exactly one selected', async () => {
    const { fixture, element } = await render();
    const labels = Array.from(element.querySelectorAll('[role="tab"]')).map(item =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(labels).toEqual(['Staff 8', 'Attendance', 'Leave 1']);
    expect(element.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveSize(1);
    tab(element, 'Leave').click();
    fixture.detectChanges();
    expect(element.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveSize(1);
    expect(tab(element, 'Leave').getAttribute('aria-selected')).toBe('true');
  });

  it('lists each person with avatar, ID, role, phone, shift, system login and a status word', async () => {
    const { element } = await render();
    expect(rows(element)).toHaveSize(8);
    expect(element.querySelector('app-pagination nav')).toBeNull();
    const first = rows(element)[0];
    expect(first.querySelector('app-avatar')?.textContent?.trim()).toBe('NP');
    expect(first.querySelector('.employee-cell__code')?.textContent).toBe('EMP-001');
    const cell = (row: Element, index: number) =>
      row.querySelector(`td:nth-child(${index})`)?.textContent?.trim();
    expect(cell(first, 2)).toBe('Owner');
    expect(cell(first, 3)).toBe('077 100 0001');
    expect(cell(first, 4)).toBe('Morning');
    expect(cell(first, 5)).toBe('Admin');
    expect(cell(first, 6)).toBe('Active');
    expect(cell(rows(element)[4], 5)).toBe('No login');
    expect(cell(rows(element)[6], 6)).toBe('On leave');
  });

  it('narrows by name, employee ID or phone ignoring case and updates the chip counts', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'SURESH');
    expect(staffNames(element)).toEqual(['Suresh Kumar']);
    search(fixture, element, 'emp-003');
    expect(staffNames(element)).toEqual(['Dilani Fernando']);
    search(fixture, element, '100 0007');
    expect(staffNames(element)).toEqual(['Anura Bandara']);
    expect(chip(element, 'All').textContent).toContain('1');
    expect(chip(element, 'On leave').textContent).toContain('1');
    expect(chip(element, 'Active').textContent).toContain('0');
  });

  it('shows live chip counts, one selected at a time, and filters', async () => {
    const { fixture, element } = await render();
    const counts = () =>
      Array.from(element.querySelectorAll('button.chip')).map(button =>
        button.textContent?.replace(/\s+/g, ' ').trim()
      );
    expect(counts()).toEqual(['All 8', 'Active 7', 'On leave 1']);
    chip(element, 'On leave').click();
    fixture.detectChanges();
    expect(staffNames(element)).toEqual(['Anura Bandara']);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    chip(element, 'Active').click();
    fixture.detectChanges();
    expect(rows(element)).toHaveSize(7);
  });

  it('says plainly when nobody matches', async () => {
    const { fixture, element } = await render();
    search(fixture, element, 'zzz');
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No employees match');
    expect(element.textContent).toContain('Clear the search');
  });

  it('names every row action and gives a sample-only message when pressed', async () => {
    const { fixture, element } = await render();
    const first = rows(element)[0];
    const labels = Array.from(first.querySelectorAll('button.row-action')).map(button =>
      button.getAttribute('aria-label')
    );
    expect(labels).toEqual([
      'View Nimal Perera',
      'Edit Nimal Perera',
      'More options for Nimal Perera',
    ]);
    (first.querySelector('button[aria-label="Edit Nimal Perera"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Edit employee');
  });

  it("shows today's attendance for everyone with words and times, agreeing with the tiles", async () => {
    const { fixture, element } = await render();
    const items = Array.from(element.querySelectorAll('app-todays-attendance-card li')).map(item =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(items).toHaveSize(8);
    expect(items).toContain('Dilani FernandoIn 07:52 Present');
    expect(items).toContain('Sanduni WickramaIn 08:20 Late');
    expect(items).toContain('Suresh Kumar Not yet');
    expect(items).toContain('Anura Bandara On leave');
    const present = items.filter(item => item?.endsWith('Present') || item?.endsWith('Late'));
    expect(present).toHaveSize(5);
    expect(items.filter(item => item?.endsWith('On leave'))).toHaveSize(1);
    buttonByText(element, 'Mark attendance')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Mark attendance');
  });

  it('shows everyone attendance on the Attendance tab, agreeing with the card', async () => {
    const { fixture, element } = await render();
    tab(element, 'Attendance').click();
    fixture.detectChanges();
    expect(rows(element)).toHaveSize(8);
    const text = (index: number) => rows(element)[index].textContent?.replace(/\s+/g, ' ').trim();
    expect(text(2)).toContain('Dilani Fernando');
    expect(text(2)).toContain('Present');
    expect(text(2)).toContain('In 07:52');
    expect(text(7)).toContain('Late');
    expect(element.querySelector('app-todays-attendance-card')).toBeNull();
  });

  it('shows the people on leave with role and return date, matching the tab count and tile', async () => {
    const { fixture, element } = await render();
    tab(element, 'Leave').click();
    fixture.detectChanges();
    expect(rows(element)).toHaveSize(1);
    const text = rows(element)[0].textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toContain('Anura Bandara');
    expect(text).toContain('Stock keeper');
    expect(text).toContain('24 Sep 2026');
  });

  it('lets a Manager read everything but hides Add employee, Mark attendance and edit actions', async () => {
    const { element } = await render(UserRole.MANAGER);
    expect(rows(element)).toHaveSize(8);
    expect(buttonByText(element, 'Export')).toBeDefined();
    expect(buttonByText(element, 'Add employee')).toBeUndefined();
    expect(buttonByText(element, 'Mark attendance')).toBeUndefined();
    const labels = Array.from(rows(element)[0].querySelectorAll('button.row-action')).map(button =>
      button.getAttribute('aria-label')
    );
    expect(labels).toEqual(['View Nimal Perera']);
    expect(element.querySelectorAll('app-stat-card')).toHaveSize(4);
  });
});
