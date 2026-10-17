import { TestBed } from '@angular/core/testing';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { LEAVE_SEED } from '../../../../core/services/data/in-memory/seed/leave.seed';
import { buildLeaveRows } from '../../../../core/utils/employee-list-filter.util';
import { LeaveTableComponent } from './leave-table.component';

describe('LeaveTableComponent', () => {
  function render(rows = buildLeaveRows(EMPLOYEE_SEED, LEAVE_SEED)) {
    const fixture = TestBed.createComponent(LeaveTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows who is away, their role and when they return', () => {
    const text = render().textContent ?? '';
    expect(text).toContain('Anura Bandara');
    expect(text).toContain('Stock keeper');
    expect(text).toContain('24 Sep 2026');
  });

  it('says plainly when nobody is on leave', () => {
    const element = render([]);
    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent).toContain('Nobody is on leave');
  });
});
