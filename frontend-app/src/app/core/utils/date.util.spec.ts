import {
  addDays,
  daysBetween,
  formatDate,
  formatDayMonth,
  formatExpiry,
  formatDayOfMonth,
  formatExpiryInput,
  formatTime,
  formatWeekday,
  formatWeekdayLong,
  parseExpiryInput,
} from './date.util';

describe('date.util', () => {
  it('formats dates as day, short month, year', () => {
    expect(formatDate('2026-09-21')).toBe('21 Sep 2026');
    expect(formatDayMonth('2026-09-20')).toBe('20 Sep');
  });

  it('formats expiry as month and year', () => {
    expect(formatExpiry('2027-03-31')).toBe('Mar 2027');
    expect(formatExpiryInput('2028-03-31')).toBe('03/2028');
  });

  it('returns empty text for invalid dates', () => {
    expect(formatDate('not a date')).toBe('');
    expect(formatExpiry('2026-13-01')).toBe('');
  });

  it('parses expiry input to the last day of the month', () => {
    expect(parseExpiryInput('03/2028')).toBe('2028-03-31');
    expect(parseExpiryInput('02/2028')).toBe('2028-02-29');
  });

  it('rejects malformed expiry input', () => {
    for (const text of ['', '3/2028', '13/2028', '03/28', '03-2028', '00/2028', 'ab/cdef']) {
      expect(parseExpiryInput(text)).toBeNull();
    }
  });

  it('computes days between two dates', () => {
    expect(daysBetween('2026-09-21', '2026-11-20')).toBe(60);
    expect(daysBetween('2026-09-21', '2026-09-20')).toBe(-1);
    expect(daysBetween('bad', '2026-09-20')).toBeNaN();
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-09-21', 10)).toBe('2026-10-01');
  });

  it('extracts the time of day', () => {
    expect(formatTime('2026-09-21T09:12:00')).toBe('09:12');
  });

  it('names the day of the week', () => {
    expect(formatWeekday('2026-09-21')).toBe('Mon');
    expect(formatWeekdayLong('2026-09-21')).toBe('Monday');
    expect(formatWeekday('nonsense')).toBe('');
  });

  it('gives the day of the month', () => {
    expect(formatDayOfMonth('2026-09-05')).toBe('5');
  });
});
