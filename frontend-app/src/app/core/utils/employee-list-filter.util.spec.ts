import { AppUser } from '../models/domain/app-user.model';
import { AttendanceStatus } from '../models/enums/attendance-status.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { ATTENDANCE_SEED } from '../services/data/in-memory/seed/attendance.seed';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import { LEAVE_SEED } from '../services/data/in-memory/seed/leave.seed';
import { USER_SEED } from '../services/data/in-memory/seed/user.seed';
import {
  buildAttendanceRows,
  buildLeaveRows,
  countEmployeeFilters,
  employeeLogin,
  filterEmployeeItems,
  formatEmployeeSubtitle,
  formatLateNote,
  formatLoginBadge,
  formatLeaveNote,
  formatLoginNote,
  formatTimeIn,
  parseEmployeeFilter,
  summarizeEmployees,
  toEmployeeListItems,
} from './employee-list-filter.util';

describe('employee-list-filter.util', () => {
  const items = toEmployeeListItems(EMPLOYEE_SEED, USER_SEED);
  const attendance = buildAttendanceRows(EMPLOYEE_SEED, ATTENDANCE_SEED);
  const leave = buildLeaveRows(EMPLOYEE_SEED, LEAVE_SEED);

  it('shows the role as the system login, or No login', () => {
    expect(employeeLogin(EMPLOYEE_SEED[1], USER_SEED)).toEqual({
      role: 'MANAGER',
      label: 'Manager',
      disabled: false,
    });
    expect(employeeLogin(EMPLOYEE_SEED[4], USER_SEED).label).toBe('No login');
  });

  it('keeps the role for a disabled user and marks it disabled', () => {
    const disabled: AppUser[] = USER_SEED.map(user =>
      user.id === 'usr-002' ? { ...user, status: UserStatus.DISABLED } : user
    );
    expect(employeeLogin(EMPLOYEE_SEED[1], disabled)).toEqual({
      role: 'MANAGER',
      label: 'Manager',
      disabled: true,
    });
  });

  it('searches name, employee ID and phone ignoring case and spaces around', () => {
    const search = (text: string) =>
      filterEmployeeItems(items, { search: text, filter: 'all' }).map(item => item.employee.code);
    expect(search(' suresh ')).toEqual(['EMP-005']);
    expect(search('emp-003')).toEqual(['EMP-003']);
    expect(search('100 0007')).toEqual(['EMP-007']);
    expect(search('nobody')).toEqual([]);
    expect(search('x'.repeat(300))).toEqual([]);
  });

  it('filters by Active and On leave and counts chips live', () => {
    expect(countEmployeeFilters(items, '')).toEqual({ all: 8, active: 7, 'on-leave': 1 });
    expect(countEmployeeFilters(items, 'silva')).toEqual({ all: 2, active: 2, 'on-leave': 0 });
    expect(
      filterEmployeeItems(items, { search: '', filter: 'on-leave' }).map(item => item.employee.code)
    ).toEqual(['EMP-007']);
  });

  it('works out the tile figures', () => {
    const summary = summarizeEmployees(EMPLOYEE_SEED, USER_SEED, attendance, leave);
    expect(summary).toEqual({
      total: 8,
      fullTime: 6,
      partTime: 2,
      onShift: 5,
      late: 1,
      onLeave: 1,
      earliestReturn: '2026-09-24',
      canLogIn: 4,
    });
    expect(formatEmployeeSubtitle(summary)).toBe('8 staff · 5 on shift today');
    expect(formatLateNote(1)).toBe('1 late this morning');
    expect(formatLateNote(0)).toBe('Nobody late this morning');
    expect(formatLeaveNote(summary)).toBe('Back on 24 Sep');
    expect(formatLoginNote(summary)).toBe('Others have no system access');
  });

  it('counts Late people as on shift', () => {
    const summary = summarizeEmployees(EMPLOYEE_SEED, USER_SEED, attendance, leave);
    const late = attendance.filter(row => row.status === AttendanceStatus.LATE).length;
    const present = attendance.filter(row => row.status === AttendanceStatus.PRESENT).length;
    expect(summary.onShift).toBe(present + late);
  });

  it('does not count a disabled user in Can log in', () => {
    const disabled = USER_SEED.map(user =>
      user.id === 'usr-004' ? { ...user, status: UserStatus.DISABLED } : user
    );
    expect(summarizeEmployees(EMPLOYEE_SEED, disabled, attendance, leave).canLogIn).toBe(3);
  });

  it('has an attendance row for every employee and falls back sensibly with no record', () => {
    expect(attendance).toHaveSize(8);
    const rows = buildAttendanceRows(EMPLOYEE_SEED, []);
    expect(rows.find(row => row.employee.id === 'emp-007')?.status).toBe(AttendanceStatus.ON_LEAVE);
    expect(rows.find(row => row.employee.id === 'emp-001')?.status).toBe(AttendanceStatus.NOT_YET);
  });

  it('lists the people on leave with their return date, matching the tile count', () => {
    expect(leave).toHaveSize(1);
    expect(leave[0].returnDate).toBe('2026-09-24');
    expect(buildLeaveRows(EMPLOYEE_SEED, [])[0].returnDate).toBeNull();
  });

  it('describes nobody on leave and everybody with access', () => {
    const summary = summarizeEmployees([], [], [], []);
    expect(formatLeaveNote(summary)).toBe('Everyone is in');
    expect(formatLoginNote({ ...summary, total: 3, canLogIn: 3 })).toBe(
      'Everyone has system access'
    );
  });

  it('words the time in and the login badge', () => {
    expect(formatTimeIn('07:52')).toBe('In 07:52');
    expect(formatTimeIn(null)).toBe('–');
    expect(formatLoginBadge({ role: 'MANAGER', label: 'Manager', disabled: false })).toBe(
      'Manager'
    );
    expect(formatLoginBadge({ role: 'MANAGER', label: 'Manager', disabled: true })).toBe(
      'Manager · Disabled'
    );
  });

  it('falls back to All for an unknown filter', () => {
    expect(parseEmployeeFilter('on-leave')).toBe('on-leave');
    expect(parseEmployeeFilter('???')).toBe('all');
  });
});
