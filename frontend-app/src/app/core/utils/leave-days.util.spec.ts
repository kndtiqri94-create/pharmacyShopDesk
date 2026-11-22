import {
  countLeaveDays,
  datesOverlap,
  isInsideLeaveYear,
  isValidLeaveYear,
  leavePeriodText,
  leaveYearBounds,
  leaveYearChoices,
  yearOfDate,
} from './leave-days.util';

describe('leave-days.util', () => {
  it('counts calendar days inclusively, with one day when From equals To', () => {
    expect(countLeaveDays('2026-05-04', '2026-05-04')).toBe(1);
    expect(countLeaveDays('2026-09-19', '2026-09-24')).toBe(6);
    expect(countLeaveDays('2026-02-27', '2026-03-02')).toBe(4);
  });

  it('returns NaN for dates that are not real', () => {
    expect(countLeaveDays('2026-02-31', '2026-03-02')).toBeNaN();
    expect(countLeaveDays('', '2026-03-02')).toBeNaN();
    expect(countLeaveDays('2026-03-01', 'abc')).toBeNaN();
  });

  it('gives the leave year bounds and the period text', () => {
    expect(leaveYearBounds(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(leavePeriodText(2026)).toBe('01/01/2026 to 31/12/2026');
  });

  it('offers the previous, current and next year', () => {
    expect(leaveYearChoices('2026-09-21')).toEqual([2025, 2026, 2027]);
    expect(leaveYearChoices('nope')).toEqual([]);
  });

  it('tests a date against a leave year and a range against one year', () => {
    expect(yearOfDate('2026-12-31')).toBe(2026);
    expect(yearOfDate('2026-13-01')).toBeNaN();
    expect(isInsideLeaveYear('2026-01-01', 2026)).toBeTrue();
    expect(isInsideLeaveYear('2027-01-01', 2026)).toBeFalse();
  });

  it('accepts only sensible leave years', () => {
    expect(isValidLeaveYear(2026)).toBeTrue();
    expect(isValidLeaveYear(Number.NaN)).toBeFalse();
    expect(isValidLeaveYear(2026.5)).toBeFalse();
    expect(isValidLeaveYear(99999)).toBeFalse();
  });

  it('detects touching and separate ranges', () => {
    expect(datesOverlap('2026-05-01', '2026-05-03', '2026-05-03', '2026-05-05')).toBeTrue();
    expect(datesOverlap('2026-05-01', '2026-05-03', '2026-05-04', '2026-05-05')).toBeFalse();
  });
});
