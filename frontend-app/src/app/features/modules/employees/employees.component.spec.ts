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
  const staffCodes = (element: HTMLElement) =>
    rows(element).map(row => row.querySelector('td:nth-child(2)')?.textContent?.trim());
  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const tab = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
      item.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  const notification = () => TestBed.inject(NotificationService).current();

  it('shows the heading, how many staff are on shift and one primary Add employee in the list', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Employees');
    expect(element.querySelector('app-page-header')?.textContent).toContain(
      '8 staff · 4 on shift today'
    );
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
    expect(buttonByText(element, 'Export PDF')).toBeDefined();
    expect(buttonByText(element, 'Add employee')?.getAttribute('data-variant')).toBe('primary');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(1);
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
    expect(text(1)).toContain('4');
    expect(text(1)).toContain('Nobody late this morning');
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

  it('lists the whole staff in the Staff tab, matching the tab count', async () => {
    const { element } = await render();
    expect(rows(element)).toHaveSize(8);
    expect(staffCodes(element)[0]).toBe('EMP-008');
    expect(element.querySelector('app-pagination nav')).toBeNull();
  });

  it('shows Inactive staff in the list but not in attendance or on leave', async () => {
    const { fixture, element } = await render();
    const inactive = rows(element).find(row => row.textContent?.includes('EMP-008'))!;
    expect(inactive.querySelector('td:nth-child(9)')?.textContent?.trim()).toBe('Inactive');
    expect(element.querySelector('app-todays-attendance-card')?.textContent).not.toContain(
      'Sanduni Wickrama'
    );
    tab(element, 'Leave').click();
    fixture.detectChanges();
    expect(element.textContent).not.toContain('Sanduni Wickrama');
  });

  it('reloads the tabs, tiles and attendance after an employee is deleted', async () => {
    const { fixture, element } = await render();
    const row = rows(element).find(item => item.textContent?.includes('EMP-005'))!;
    (row.querySelector('button[aria-label="Delete Suresh Kumar"]') as HTMLElement).click();
    fixture.detectChanges();
    buttonByText(element, 'Delete employee')!.click();
    await settle(fixture);
    expect(rows(element)).toHaveSize(7);
    expect(tab(element, 'Staff').textContent).toContain('7');
    expect(element.querySelector('app-stat-card')?.textContent).toContain('7');
    expect(element.querySelectorAll('app-todays-attendance-card li')).toHaveSize(6);
    expect(notification()?.message).toBe('Suresh Kumar was removed.');
  });

  it("shows today's attendance for everyone with words and times, agreeing with the tiles", async () => {
    const { fixture, element } = await render();
    const items = Array.from(element.querySelectorAll('app-todays-attendance-card li')).map(item =>
      item.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(items).toHaveSize(7);
    expect(items).toContain('Dilani FernandoIn 07:52 Present');
    expect(items).toContain('Suresh Kumar Not yet');
    expect(items).toContain('Anura Bandara On leave');
    const present = items.filter(item => item?.endsWith('Present') || item?.endsWith('Late'));
    expect(present).toHaveSize(4);
    expect(items.filter(item => item?.endsWith('On leave'))).toHaveSize(1);
    buttonByText(element, 'Mark attendance')?.click();
    fixture.detectChanges();
    expect(notification()?.message).toContain('Mark attendance');
  });

  it('shows everyone attendance on the Attendance tab, agreeing with the card', async () => {
    const { fixture, element } = await render();
    tab(element, 'Attendance').click();
    fixture.detectChanges();
    expect(rows(element)).toHaveSize(7);
    const text = (index: number) => rows(element)[index].textContent?.replace(/\s+/g, ' ').trim();
    expect(text(2)).toContain('Dilani Fernando');
    expect(text(2)).toContain('Present');
    expect(text(2)).toContain('In 07:52');
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
    expect(buttonByText(element, 'Export CSV')).toBeDefined();
    expect(buttonByText(element, 'Export PDF')).toBeDefined();
    expect(buttonByText(element, 'Add employee')).toBeUndefined();
    expect(buttonByText(element, 'Mark attendance')).toBeUndefined();
    const labels = Array.from(
      rows(element)[rows(element).length - 1].querySelectorAll('button.row-action')
    ).map(button => button.getAttribute('aria-label'));
    expect(labels).toEqual(['View Nimal Perera']);
    expect(element.querySelectorAll('app-stat-card')).toHaveSize(4);
  });
});
