import { TestBed } from '@angular/core/testing';
import { ATTENDANCE_SEED } from '../../../../core/services/data/in-memory/seed/attendance.seed';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { SAMPLE_TODAY } from '../../../../core/services/clock.service';
import { LEAVE_REQUEST_SEED } from '../../../../core/services/data/in-memory/seed/leave.seed';
import { buildAttendanceRows } from '../../../../core/utils/employee-list-filter.util';
import { AttendanceTableComponent } from './attendance-table.component';

describe('AttendanceTableComponent', () => {
  it('shows each employee with a status word and the time in', () => {
    const fixture = TestBed.createComponent(AttendanceTableComponent);
    fixture.componentRef.setInput(
      'rows',
      buildAttendanceRows(EMPLOYEE_SEED, ATTENDANCE_SEED, LEAVE_REQUEST_SEED, SAMPLE_TODAY)
    );
    fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows).toHaveSize(7);
    expect(rows[0].textContent).toContain('Nimal Perera');
    expect(rows[0].textContent).toContain('Present');
    expect(rows[0].textContent).toContain('In 07:45');
    expect(rows[4].textContent).toContain('Not yet');
    expect(rows[4].textContent).toContain('–');
  });
});
