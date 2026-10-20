import { daysBetween, isIsoDate } from './date.util';

const LEAVE_YEAR_SPAN = 1;
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

export interface LeaveYearBounds {
  start: string;
  end: string;
}

export function yearOfDate(iso: string): number {
  return isIsoDate(iso) ? Number(iso.slice(0, 4)) : Number.NaN;
}

export function countLeaveDays(fromDate: string, toDate: string): number {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) return Number.NaN;
  return daysBetween(fromDate, toDate) + 1;
}

export function leaveYearBounds(year: number): LeaveYearBounds {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function isValidLeaveYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

export function leavePeriodText(year: number): string {
  return `01/01/${year} to 31/12/${year}`;
}

export function leaveYearChoices(today: string): number[] {
  const current = yearOfDate(today);
  if (Number.isNaN(current)) return [];
  return [current - LEAVE_YEAR_SPAN, current, current + LEAVE_YEAR_SPAN];
}

export function isInsideLeaveYear(date: string, year: number): boolean {
  return yearOfDate(date) === year;
}

export function datesCoverDay(fromDate: string, toDate: string, day: string): boolean {
  return fromDate <= day && day <= toDate;
}

export function datesOverlap(
  firstFrom: string,
  firstTo: string,
  secondFrom: string,
  secondTo: string
): boolean {
  return firstFrom <= secondTo && secondFrom <= firstTo;
}
