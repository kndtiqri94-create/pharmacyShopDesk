import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../../testing/auth-test.util';
import { LeaveReason } from '../../../core/models/enums/leave-reason.enum';
import { UserRole } from '../../../core/models/enums/user-role.enum';
import { LeaveAdminService } from '../../../core/services/leave-admin.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LeaveFormInput } from '../../../core/utils/leave-validation.util';
import { EmployeesComponent } from './employees.component';
import { LeaveApplicationComponent } from './leave-application/leave-application.component';

describe('Leave management: the same leave everywhere', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    clearBrowserStorage();
    TestBed.inject(NotificationService).dismiss();
  });

  const request = (fromDate: string, toDate: string): LeaveFormInput => ({
    employeeId: 'emp-004',
    year: 2026,
    leaveTypeId: 'lt-003',
    fromDate,
    toDate,
    reason: LeaveReason.PERSONAL,
    comments: '',
    attachment: null,
    coveringEmployeeId: '',
    approverEmployeeId: 'emp-002',
  });
  const service = () => TestBed.inject(LeaveAdminService);

  async function start(): Promise<void> {
    const params = convertToParamMap({});
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
    await signInAs(UserRole.ADMIN);
  }

  async function show<T>(component: Type<T>, tab?: string) {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 30));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    if (tab !== undefined) {
      const tabButton = Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
        item.textContent?.trim().startsWith(tab)
      ) as HTMLButtonElement;
      tabButton.click();
      fixture.detectChanges();
    }
    return { fixture, element };
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  const onLeaveTile = async () => {
    const { element } = await show(EmployeesComponent);
    const tile = Array.from(element.querySelectorAll('app-stat-card')).find(item =>
      item.textContent?.includes('On leave')
    );
    return Number(/On leave\s*(\d+)/.exec(text(tile))?.[1]);
  };

  const staffRow = async (code: string) => {
    const { element } = await show(EmployeesComponent);
    const row = Array.from(element.querySelectorAll('app-employee-list tbody tr')).find(item =>
      item.textContent?.includes(code)
    );
    return text(row);
  };

  const leaveTab = async () => {
    const { element } = await show(EmployeesComponent, 'Leave');
    const tab = Array.from(element.querySelectorAll('[role="tab"]')).find(item =>
      item.textContent?.includes('Leave')
    );
    return {
      count: text(tab),
      rows: Array.from(element.querySelectorAll('app-leave-requests tbody tr')).map(text),
    };
  };

  const casualBalance = async () => {
    const { fixture, element } = await show(LeaveApplicationComponent);
    const select = element.querySelector('#leave-employeeId') as HTMLSelectElement;
    select.value = 'emp-004';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const row = Array.from(element.querySelectorAll('app-leave-balance-card tbody tr')).find(item =>
      item.textContent?.includes('Casual Leave')
    )!;
    return Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim() ?? '');
  };

  async function submit(fromDate: string, toDate: string): Promise<string> {
    const applied = await service().apply(request(fromDate, toDate));
    expect(applied.ok).toBeTrue();
    return applied.ok ? applied.request.id : '';
  }

  it('starts with the Leave tab, balances and On leave count agreeing on the sample data (AC-8, AC-52)', async () => {
    await start();
    expect(await onLeaveTile()).toBe(1);
    expect(await staffRow('EMP-007')).toContain('On leave');
    expect(await staffRow('EMP-004')).not.toContain('On leave');
    expect((await leaveTab()).count).toBe('Leave 10');
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '5.00', '2.00', '0.00']);
  });

  it('shows a new request in the Leave tab and the balance but does not count it as On leave (AC-4, AC-7, AC-10, AC-52)', async () => {
    await start();
    await submit('2026-09-21', '2026-09-22');

    const tab = await leaveTab();
    expect(tab.count).toBe('Leave 11');
    expect(tab.rows.some(row => row.includes('EMP-004') && row.includes('Pending'))).toBeTrue();
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '3.00', '2.00', '2.00']);
    expect(await onLeaveTile()).toBe(1);
    expect(await staffRow('EMP-004')).not.toContain('On leave');
  });

  it('counts approved leave covering today as On leave and moves the days to Utilized (AC-5, AC-6, AC-10, AC-42)', async () => {
    await start();
    const id = await submit('2026-09-21', '2026-09-22');
    expect((await service().decide(id, 'APPROVE', '')).ok).toBeTrue();

    expect(await onLeaveTile()).toBe(2);
    expect(await staffRow('EMP-004')).toContain('On leave');
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '3.00', '4.00', '0.00']);
    expect((await leaveTab()).count).toBe('Leave 11');
  });

  it('does not count approved leave that does not include today (AC-7)', async () => {
    await start();
    const id = await submit('2026-10-05', '2026-10-06');
    expect((await service().decide(id, 'APPROVE', '')).ok).toBeTrue();

    expect(await onLeaveTile()).toBe(1);
    expect(await staffRow('EMP-004')).not.toContain('On leave');
    expect(await staffRow('EMP-002')).not.toContain('On leave');
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '3.00', '4.00', '0.00']);
  });

  it('releases the days and keeps the person off On leave after a reject (AC-5, AC-7, AC-10)', async () => {
    await start();
    const id = await submit('2026-09-21', '2026-09-22');
    expect((await service().decide(id, 'REJECT', 'Not possible')).ok).toBeTrue();

    expect(await onLeaveTile()).toBe(1);
    expect(await staffRow('EMP-004')).not.toContain('On leave');
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '5.00', '2.00', '0.00']);
    expect(
      (await leaveTab()).rows.some(row => row.includes('EMP-004') && row.includes('Rejected'))
    ).toBeTrue();
  });

  it('releases the days after a cancel of a pending or a not yet started approved request (AC-5, AC-7, AC-10)', async () => {
    await start();
    const pending = await submit('2026-09-21', '2026-09-22');
    expect((await service().cancel(pending)).ok).toBeTrue();
    const later = await submit('2026-10-05', '2026-10-06');
    expect((await service().decide(later, 'APPROVE', '')).ok).toBeTrue();
    expect((await service().cancel(later)).ok).toBeTrue();

    expect(await onLeaveTile()).toBe(1);
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '5.00', '2.00', '0.00']);
    const tab = await leaveTab();
    expect(tab.count).toBe('Leave 12');
    expect(tab.rows.filter(row => row.includes('EMP-004') && row.includes('Cancelled'))).toHaveSize(
      2
    );
  });

  it('forgets applied and decided leave after a refresh (AC-9)', async () => {
    await start();
    const id = await submit('2026-09-21', '2026-09-22');
    expect((await service().decide(id, 'APPROVE', '')).ok).toBeTrue();
    expect(await onLeaveTile()).toBe(2);

    TestBed.resetTestingModule();
    clearBrowserStorage();
    await start();
    expect(await onLeaveTile()).toBe(1);
    expect((await leaveTab()).count).toBe('Leave 10');
    expect(await casualBalance()).toEqual(['Casual Leave', '7.00', '5.00', '2.00', '0.00']);
  });
});
