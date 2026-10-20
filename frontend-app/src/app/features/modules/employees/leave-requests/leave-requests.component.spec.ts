import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  clearBrowserStorage,
  signInAs,
  TEST_PROVIDERS,
} from '../../../../../testing/auth-test.util';
import { LeaveRequest } from '../../../../core/models/domain/leave-request.model';
import { LeaveStatus } from '../../../../core/models/enums/leave-status.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import {
  LEAVE_REQUEST_SEED,
  LEAVE_TYPE_SEED,
} from '../../../../core/services/data/in-memory/seed/leave.seed';
import { USER_SEED } from '../../../../core/services/data/in-memory/seed/user.seed';
import { LeaveDataService } from '../../../../core/services/data/leave-data.service';
import { LeaveAdminService } from '../../../../core/services/leave-admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LeaveRequestsComponent } from './leave-requests.component';

function manyRequests(count: number): LeaveRequest[] {
  return Array.from({ length: count }, (_, index) => ({
    ...LEAVE_REQUEST_SEED[0],
    id: `bulk-${index}`,
    fromDate: `2026-03-${String(index + 1).padStart(2, '0')}`,
    toDate: `2026-03-${String(index + 1).padStart(2, '0')}`,
    days: 1,
    status: LeaveStatus.REJECTED,
  }));
}

describe('LeaveRequestsComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  async function render(
    role: UserRole = UserRole.ADMIN,
    requests: readonly LeaveRequest[] = LEAVE_REQUEST_SEED
  ) {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    await signInAs(role);
    const fixture = TestBed.createComponent(LeaveRequestsComponent);
    fixture.componentRef.setInput('requests', requests);
    fixture.componentRef.setInput('employees', EMPLOYEE_SEED);
    fixture.componentRef.setInput('users', USER_SEED);
    fixture.componentRef.setInput('types', LEAVE_TYPE_SEED);
    const changed: number[] = [];
    fixture.componentInstance.changed.subscribe(() => changed.push(1));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, changed };
  }

  type Rendered = Awaited<ReturnType<typeof render>>;

  const rows = (element: HTMLElement) => Array.from(element.querySelectorAll('tbody tr'));
  const cell = (row: Element, index: number) =>
    row.querySelector(`td:nth-child(${index})`)?.textContent?.replace(/\s+/g, ' ').trim();
  const rowOf = (element: HTMLElement, name: string) =>
    rows(element).find(row => cell(row, 1)?.includes(name))!;
  const entries = (element: HTMLElement) =>
    element.querySelector('[data-testid="entries-text"]')?.textContent?.trim();
  const chipLabels = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.chip')).map(chip =>
      chip.textContent?.replace(/\s+/g, ' ').trim()
    );
  const rowButton = (element: HTMLElement, label: string) =>
    element.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
  const dialogButton = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('dialog button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;
  const notification = () => TestBed.inject(NotificationService).current();

  async function settle({ fixture }: Rendered): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
  }

  function click(rendered: Rendered, button: HTMLElement | null | undefined): void {
    button!.click();
    rendered.fixture.detectChanges();
  }

  function chip(rendered: Rendered, prefix: string): void {
    const found = Array.from(rendered.element.querySelectorAll('.chip')).find(item =>
      item.textContent?.trim().startsWith(prefix)
    ) as HTMLElement;
    click(rendered, found);
  }

  it('shows the nine columns, newest From first, with no primary button', async () => {
    const { element } = await render();
    const headers = Array.from(element.querySelectorAll('thead th')).map(item =>
      item.textContent?.trim()
    );
    expect(headers).toEqual([
      'Employee',
      'Leave Type',
      'From',
      'To',
      'Days',
      'Reason',
      'Approver',
      'Status',
      'Action',
    ]);
    expect(rows(element)).toHaveSize(10);
    const froms = rows(element).map(row => cell(row, 3));
    expect(froms[0]).toBe('11 Jan 2027');
    expect(froms[1]).toBe('24 Dec 2026');
    expect(froms[9]).toBe('10 Mar 2025');
    expect(element.querySelectorAll('button[data-variant="primary"]')).toHaveSize(0);
  });

  it('shows employee name with code, days with two decimals, approver and status word', async () => {
    const { element } = await render();
    const anura = rowOf(element, 'Anura Bandara');
    expect(cell(anura, 1)).toBe('Anura Bandara EMP-007');
    expect(cell(anura, 2)).toBe('Medical Leave');
    expect(cell(anura, 3)).toBe('19 Sep 2026');
    expect(cell(anura, 4)).toBe('24 Sep 2026');
    expect(cell(anura, 5)).toBe('6.00');
    expect(cell(anura, 6)).toBe('Medical');
    expect(cell(anura, 7)).toBe('Kamal Silva');
    expect(cell(anura, 8)).toBe('Approved');
    expect(cell(rowOf(element, 'Dilani Fernando'), 8)).toBe('Pending');
    expect(cell(rowOf(element, 'Suresh Kumar'), 8)).toBe('Rejected');
    expect(cell(rowOf(element, 'Tharindu Silva'), 8)).toContain('Pending');
  });

  it('shows status chips with live counts and filters by each', async () => {
    const rendered = await render();
    const { element } = rendered;
    expect(chipLabels(element)).toEqual([
      'All 10',
      'Pending 2',
      'Approved 5',
      'Rejected 1',
      'Cancelled 2',
    ]);
    chip(rendered, 'Pending');
    expect(rows(element)).toHaveSize(2);
    expect(entries(element)).toBe('Showing 1 to 2 of 2 entries');
    chip(rendered, 'Approved');
    expect(rows(element)).toHaveSize(5);
    chip(rendered, 'Rejected');
    expect(rows(element)).toHaveSize(1);
    chip(rendered, 'Cancelled');
    expect(rows(element)).toHaveSize(2);
    chip(rendered, 'All');
    expect(rows(element)).toHaveSize(10);
  });

  it('pages 10, 25 and 50 with the entries text and resets to page one on a new size', async () => {
    const rendered = await render(UserRole.ADMIN, manyRequests(30));
    const { element } = rendered;
    expect(rows(element)).toHaveSize(10);
    expect(entries(element)).toBe('Showing 1 to 10 of 30 entries');
    const next = Array.from(element.querySelectorAll('app-pagination button')).find(button =>
      /next/i.test(button.getAttribute('aria-label') ?? button.textContent ?? '')
    ) as HTMLElement;
    click(rendered, next);
    expect(entries(element)).toBe('Showing 11 to 20 of 30 entries');
    const size = element.querySelector('#leave-page-size') as HTMLSelectElement;
    size.value = '25';
    size.dispatchEvent(new Event('change'));
    rendered.fixture.detectChanges();
    expect(rows(element)).toHaveSize(25);
    expect(entries(element)).toBe('Showing 1 to 25 of 30 entries');
    size.value = '50';
    size.dispatchEvent(new Event('change'));
    rendered.fixture.detectChanges();
    expect(rows(element)).toHaveSize(30);
    expect(entries(element)).toBe('Showing 1 to 30 of 30 entries');
  });

  it('shows an empty state when there are no requests', async () => {
    const { element } = await render(UserRole.ADMIN, []);
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('No leave requests yet');
    expect(entries(element)).toBe('Showing 0 to 0 of 0 entries');
  });

  it('shows an empty state for a status with no requests and lets the user show all', async () => {
    const rendered = await render(UserRole.ADMIN, [LEAVE_REQUEST_SEED[1]]);
    chip(rendered, 'Approved');
    expect(rendered.element.textContent).toContain('No leave requests match');
    click(rendered, buttonByText(rendered.element, 'Reset filters'));
    expect(rows(rendered.element)).toHaveSize(1);
  });

  const buttonByText = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      button => button.textContent?.trim() === text
    ) as HTMLButtonElement | undefined;

  function search(rendered: Rendered, value: string): void {
    const box = rendered.element.querySelector('#leave-search') as HTMLInputElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    rendered.fixture.detectChanges();
  }

  it('searches by employee name or code, case-insensitively, and the entries text follows', async () => {
    const rendered = await render();
    const { element } = rendered;
    const box = element.querySelector('#leave-search') as HTMLInputElement;
    expect(box.getAttribute('maxlength')).toBe('100');
    search(rendered, 'kamal');
    expect(rows(element).length).toBeGreaterThan(0);
    expect(rows(element).every(row => cell(row, 1)?.includes('Kamal Silva'))).toBeTrue();
    expect(entries(element)).toBe(
      `Showing 1 to ${rows(element).length} of ${rows(element).length} entries`
    );
    search(rendered, 'EMP-007');
    expect(rows(element)).toHaveSize(1);
    expect(cell(rows(element)[0], 1)).toBe('Anura Bandara EMP-007');
    expect(entries(element)).toBe('Showing 1 to 1 of 1 entries');
  });

  it('combines search with a status chip and keeps chip counts', async () => {
    const rendered = await render();
    const { element } = rendered;
    chip(rendered, 'Pending');
    search(rendered, 'dilani');
    expect(rows(element)).toHaveSize(1);
    expect(chipLabels(element)[0]).toBe('All 10');
    search(rendered, 'anura');
    expect(element.textContent).toContain('No leave requests match');
    expect(entries(element)).toBe('Showing 0 to 0 of 0 entries');
  });

  it('resets both search and status from the no-match state', async () => {
    const rendered = await render();
    const { element } = rendered;
    chip(rendered, 'Pending');
    search(rendered, 'anura');
    click(rendered, buttonByText(element, 'Reset filters'));
    expect((element.querySelector('#leave-search') as HTMLInputElement).value).toBe('');
    expect(rows(element)).toHaveSize(10);
    expect(chipLabels(element)[0]).toBe('All 10');
    expect(entries(element)).toBe('Showing 1 to 10 of 10 entries');
  });

  it('returns to page one when the search changes', async () => {
    const rendered = await render(UserRole.ADMIN, manyRequests(30));
    const { element } = rendered;
    const next = Array.from(element.querySelectorAll('app-pagination button')).find(button =>
      /next/i.test(button.getAttribute('aria-label') ?? button.textContent ?? '')
    ) as HTMLElement;
    click(rendered, next);
    expect(entries(element)).toBe('Showing 11 to 20 of 30 entries');
    search(rendered, 'EMP-');
    expect(entries(element)).toContain('Showing 1 to');
  });

  function openDetails(rendered: Rendered, name: string): HTMLElement {
    click(rendered, rowButton(rendered.element, `View details of leave for ${name}`));
    return rendered.element.querySelector('app-leave-details-dialog') as HTMLElement;
  }

  const detail = (dialog: HTMLElement, label: string) =>
    Array.from(dialog.querySelectorAll('.details__line'))
      .find(line => line.querySelector('dt')?.textContent?.trim() === label)
      ?.querySelector('dd')
      ?.textContent?.trim();

  it('shows approver, decision comment, decided date and status of an approved request read-only', async () => {
    const rendered = await render();
    const dialog = openDetails(rendered, 'Anura Bandara');
    expect(dialog.textContent).toContain('Leave details for Anura Bandara');
    expect(detail(dialog, 'Employee')).toBe('Anura Bandara (EMP-007)');
    expect(detail(dialog, 'Leave type')).toBe('Medical Leave');
    expect(detail(dialog, 'From')).toBe('19 Sep 2026');
    expect(detail(dialog, 'To')).toBe('24 Sep 2026');
    expect(detail(dialog, 'Days')).toBe('6.00');
    expect(detail(dialog, 'Reason')).toBe('Medical');
    expect(detail(dialog, 'Approver')).toBe('Kamal Silva');
    expect(detail(dialog, 'Status')).toBe('Approved');
    expect(detail(dialog, 'Decided on')).toBe('16 Sep 2026');
    expect(detail(dialog, 'Covering employee')).toBeDefined();
    expect(detail(dialog, 'Attachment')).toBeDefined();
    expect(detail(dialog, 'Comments')).toBeDefined();
    expect(dialog.querySelectorAll('input, textarea, select')).toHaveSize(0);
  });

  it('shows the comment kept after a rejection, and never in the notification', async () => {
    const rendered = await render();
    const { element } = rendered;
    click(rendered, rowButton(element, 'Reject leave for Dilani Fernando'));
    const box = element.querySelector('app-leave-decision-dialog textarea') as HTMLTextAreaElement;
    box.value = 'Short staffed that week';
    box.dispatchEvent(new Event('input'));
    rendered.fixture.detectChanges();
    click(rendered, dialogButton(element, 'Reject'));
    await settle(rendered);
    rendered.fixture.componentRef.setInput(
      'requests',
      await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())
    );
    rendered.fixture.detectChanges();
    expect(notification()?.message).not.toContain('Short staffed');
    const dialog = openDetails(rendered, 'Dilani Fernando');
    expect(detail(dialog, 'Status')).toBe('Rejected');
    expect(detail(dialog, 'Decision comment')).toBe('Short staffed that week');
    expect(detail(dialog, 'Decided on')).not.toBe('–');
  });

  it('shows a dash for a pending request with no decision, and closes with the Close button', async () => {
    const rendered = await render();
    const dialog = openDetails(rendered, 'Dilani Fernando');
    expect(detail(dialog, 'Status')).toBe('Pending');
    expect(detail(dialog, 'Decision comment')).toBe('–');
    expect(detail(dialog, 'Decided on')).toBe('–');
    click(rendered, buttonByText(dialog, 'Close'));
    expect(rendered.element.querySelector('app-leave-details-dialog')).toBeNull();
  });

  it('lets a view-only Manager who is not the approver open the details', async () => {
    const reassigned = LEAVE_REQUEST_SEED.map(request => ({
      ...request,
      approverEmployeeId: 'emp-001',
    }));
    const rendered = await render(UserRole.MANAGER, reassigned);
    const dialog = openDetails(rendered, 'Anura Bandara');
    expect(detail(dialog, 'Approver')).toBe('Nimal Perera');
    expect(detail(dialog, 'Status')).toBe('Approved');
  });

  it('gives an Admin approve and reject on pending requests and cancel on pending and upcoming approved ones', async () => {
    const { element } = await render();
    expect(rowButton(element, 'Approve leave for Dilani Fernando')).not.toBeNull();
    expect(rowButton(element, 'Reject leave for Dilani Fernando')).not.toBeNull();
    expect(rowButton(element, 'Cancel leave for Dilani Fernando')).not.toBeNull();
    expect(rowButton(element, 'Approve leave for Tharindu Silva')).not.toBeNull();
    expect(rowButton(element, 'Cancel leave for Kamal Silva')).not.toBeNull();
    expect(rowButton(element, 'Approve leave for Kamal Silva')).toBeNull();
    expect(rowButton(element, 'Cancel leave for Anura Bandara')).toBeNull();
    expect(rowButton(element, 'Cancel leave for Suresh Kumar')).toBeNull();
    expect(element.querySelectorAll('button[aria-label^="Approve leave"]')).toHaveSize(2);
  });

  it('lets a linked-user approver Manager approve and reject but never cancel', async () => {
    const { element } = await render(UserRole.MANAGER);
    expect(rowButton(element, 'Approve leave for Dilani Fernando')).not.toBeNull();
    expect(rowButton(element, 'Reject leave for Tharindu Silva')).not.toBeNull();
    expect(element.querySelectorAll('button[aria-label^="Cancel leave"]')).toHaveSize(0);
  });

  it('leaves a Manager who is not the approver read-only with no write actions', async () => {
    const reassigned = LEAVE_REQUEST_SEED.map(request => ({
      ...request,
      approverEmployeeId: 'emp-001',
    }));
    const { element } = await render(UserRole.MANAGER, reassigned);
    expect(rows(element)).toHaveSize(10);
    expect(element.querySelectorAll('tbody button')).toHaveSize(10);
    expect(element.querySelectorAll('tbody button[aria-label^="View details"]')).toHaveSize(10);
  });

  it('never offers approve or reject on the signed-in person own request', async () => {
    const own: LeaveRequest = {
      ...LEAVE_REQUEST_SEED[1],
      id: 'own-1',
      employeeId: 'emp-001',
      approverEmployeeId: 'emp-002',
    };
    const { element } = await render(UserRole.ADMIN, [own]);
    expect(rowButton(element, 'Approve leave for Nimal Perera')).toBeNull();
    expect(rowButton(element, 'Reject leave for Nimal Perera')).toBeNull();
    expect(rowButton(element, 'Cancel leave for Nimal Perera')).not.toBeNull();
  });

  it('asks for confirmation naming the employee and outcome, with a comment that is optional', async () => {
    const rendered = await render();
    const { element } = rendered;
    expect(element.querySelector('app-leave-decision-dialog')).toBeNull();
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    const dialog = element.querySelector('app-leave-decision-dialog')!;
    expect(dialog.textContent).toContain('Approve leave for Dilani Fernando?');
    expect(dialog.textContent).toContain("approve Dilani Fernando's Annual Leave");
    expect(dialog.textContent).toContain('12 Oct 2026 to 14 Oct 2026');
    expect(dialog.textContent).toContain('Comment (optional)');
    expect(dialog.querySelector('textarea')?.getAttribute('maxlength')).toBe('250');
  });

  it('approves with no comment, announces the outcome without leave details and reloads', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    click(rendered, dialogButton(element, 'Approve'));
    await settle(rendered);
    const saved = (await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())).find(
      request => request.id === 'leave-002'
    );
    expect(saved?.status).toBe(LeaveStatus.APPROVED);
    expect(saved?.approverComment).toBe('');
    expect(notification()?.message).toBe("Dilani Fernando's leave was approved.");
    expect(changed).toHaveSize(1);
    expect(element.querySelector('app-leave-decision-dialog')).toBeNull();
  });

  it('rejects with a comment that is saved but never shown in the notification', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Reject leave for Dilani Fernando'));
    const box = element.querySelector('app-leave-decision-dialog textarea') as HTMLTextAreaElement;
    box.value = '  Short staffed that week  ';
    box.dispatchEvent(new Event('input'));
    rendered.fixture.detectChanges();
    click(rendered, dialogButton(element, 'Reject'));
    await settle(rendered);
    const saved = (await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())).find(
      request => request.id === 'leave-002'
    );
    expect(saved?.status).toBe(LeaveStatus.REJECTED);
    expect(saved?.approverComment).toBe('Short staffed that week');
    expect(notification()?.message).toBe("Dilani Fernando's leave was rejected.");
    expect(notification()?.message).not.toContain('Short staffed');
    expect(changed).toHaveSize(1);
  });

  it('closes the decision dialog on Cancel without saving or reloading', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    click(rendered, dialogButton(element, 'Cancel'));
    expect(element.querySelector('app-leave-decision-dialog')).toBeNull();
    const saved = (await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())).find(
      request => request.id === 'leave-002'
    );
    expect(saved?.status).toBe(LeaveStatus.PENDING);
    expect(changed).toHaveSize(0);
    expect(notification()).toBeNull();
  });

  it('says plainly when a request was already decided elsewhere and reloads', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    const dataService = TestBed.inject(LeaveDataService);
    const current = (await firstValueFrom(dataService.getRequests())).find(
      request => request.id === 'leave-002'
    )!;
    await firstValueFrom(dataService.saveRequest({ ...current, status: LeaveStatus.REJECTED }));
    click(rendered, dialogButton(element, 'Approve'));
    await settle(rendered);
    expect(notification()?.message).toBe(
      "Dilani Fernando's leave request cannot be changed by you any more."
    );
    expect(changed).toHaveSize(1);
  });

  it('says plainly when the request is no longer there', async () => {
    const rendered = await render();
    const { element } = rendered;
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    spyOn(TestBed.inject(LeaveAdminService), 'decide').and.resolveTo({
      ok: false,
      reason: 'not-found',
      errors: {},
      firstErrorField: null,
    });
    click(rendered, dialogButton(element, 'Approve'));
    await settle(rendered);
    expect(notification()?.message).toBe(
      "Dilani Fernando's leave request is no longer in the list."
    );
  });

  it('shows a clear message for denied and busy results', async () => {
    const rendered = await render();
    const { element } = rendered;
    const decide = spyOn(TestBed.inject(LeaveAdminService), 'decide');
    decide.and.resolveTo({ ok: false, reason: 'denied', errors: {}, firstErrorField: null });
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    click(rendered, dialogButton(element, 'Approve'));
    await settle(rendered);
    expect(notification()?.message).toBe('You do not have access to change leave requests.');
    decide.and.resolveTo({ ok: false, reason: 'busy', errors: {}, firstErrorField: null });
    click(rendered, rowButton(element, 'Approve leave for Dilani Fernando'));
    click(rendered, dialogButton(element, 'Approve'));
    await settle(rendered);
    expect(notification()?.message).toBe('Another change is still saving. Try again.');
  });

  it('asks before cancelling, names the employee, and cancels on confirm', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Cancel leave for Kamal Silva'));
    const dialog = element.querySelector('dialog[open]')!;
    expect(dialog.textContent).toContain('Cancel leave for Kamal Silva?');
    expect(dialog.textContent).toContain("Kamal Silva's Annual Leave");
    click(rendered, dialogButton(element, 'Cancel request'));
    await settle(rendered);
    const saved = (await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())).find(
      request => request.id === 'leave-009'
    );
    expect(saved?.status).toBe(LeaveStatus.CANCELLED);
    expect(notification()?.message).toBe("Kamal Silva's leave was cancelled.");
    expect(changed).toHaveSize(1);
  });

  it('keeps the request when the cancel confirmation is declined', async () => {
    const rendered = await render();
    const { element, changed } = rendered;
    click(rendered, rowButton(element, 'Cancel leave for Kamal Silva'));
    click(rendered, dialogButton(element, 'Keep request'));
    const saved = (await firstValueFrom(TestBed.inject(LeaveDataService).getRequests())).find(
      request => request.id === 'leave-009'
    );
    expect(saved?.status).toBe(LeaveStatus.APPROVED);
    expect(changed).toHaveSize(0);
  });
});
