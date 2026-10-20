import { TestBed } from '@angular/core/testing';
import { LeaveBalanceRow } from '../../../../../core/utils/leave-balance.util';
import { LeaveBalanceCardComponent } from './leave-balance-card.component';

describe('LeaveBalanceCardComponent', () => {
  const rows: LeaveBalanceRow[] = [
    {
      leaveTypeId: 'lt-003',
      leaveTypeName: 'Casual Leave',
      entitlement: 7,
      utilized: 2,
      pending: 1.5,
      balance: 3.5,
    },
  ];

  function mount(hasEmployee: boolean) {
    const fixture = TestBed.createComponent(LeaveBalanceCardComponent);
    fixture.componentRef.setInput('rows', hasEmployee ? rows : []);
    fixture.componentRef.setInput('hasEmployee', hasEmployee);
    fixture.componentRef.setInput('year', 2026);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('asks you to choose an employee first when none is chosen', () => {
    const element = mount(false);
    expect(element.textContent).toContain('Choose an employee first');
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows the five columns with days to two decimals', () => {
    const element = mount(true);
    const headers = Array.from(element.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headers).toEqual([
      'Leave Type',
      'Entitlement',
      'Balance',
      'Utilized',
      'Pending Approval',
    ]);
    const cells = Array.from(element.querySelectorAll('tbody td')).map(td =>
      td.textContent?.trim()
    );
    expect(cells).toEqual(['Casual Leave', '7.00', '3.50', '2.00', '1.50']);
    expect(element.textContent).toContain('Leave year 2026');
  });
});
