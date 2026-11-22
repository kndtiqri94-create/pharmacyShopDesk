import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '../../../../../testing/auth-test.util';
import { ATTENDANCE_SEED } from '../../../../core/services/data/in-memory/seed/attendance.seed';
import { EMPLOYEE_SEED } from '../../../../core/services/data/in-memory/seed/employee.seed';
import { SAMPLE_TODAY } from '../../../../core/services/clock.service';
import { LEAVE_REQUEST_SEED } from '../../../../core/services/data/in-memory/seed/leave.seed';
import { buildAttendanceRows } from '../../../../core/utils/employee-list-filter.util';
import { TodaysAttendanceCardComponent } from './todays-attendance-card.component';

describe('TodaysAttendanceCardComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: TEST_PROVIDERS }));

  it('lists everyone with a status word and the time in only for those who arrived', () => {
    const fixture = TestBed.createComponent(TodaysAttendanceCardComponent);
    fixture.componentRef.setInput(
      'rows',
      buildAttendanceRows(EMPLOYEE_SEED, ATTENDANCE_SEED, LEAVE_REQUEST_SEED, SAMPLE_TODAY)
    );
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const items = Array.from(element.querySelectorAll('li'));
    expect(items).toHaveSize(7);
    expect(items[0].textContent).toContain('In 07:45');
    expect(items[4].textContent).not.toContain('In ');
    expect(items[4].querySelector('app-badge')?.textContent).toContain('Not yet');
    expect(element.querySelector('h2')?.textContent).toBe("Today's attendance");
  });

  it('hides Mark attendance for someone who cannot write', () => {
    const fixture = TestBed.createComponent(TodaysAttendanceCardComponent);
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
