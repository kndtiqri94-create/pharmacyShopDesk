const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_LONG_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MILLISECONDS_PER_DAY = 86_400_000;
const MIN_EXPIRY_YEAR = 2000;
const MAX_EXPIRY_YEAR = 2999;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(iso: string): DateParts | null {
  const datePart = iso.split('T')[0] ?? '';
  const pieces = datePart.split('-');
  if (pieces.length !== 3) return null;
  const [year, month, day] = pieces.map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function toUtcMillis(iso: string): number | null {
  const parts = parseIsoDate(iso);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

export function formatDate(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? `${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}` : '';
}

export function formatDayMonth(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? `${parts.day} ${MONTH_NAMES[parts.month - 1]}` : '';
}

export function formatExpiry(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? `${MONTH_NAMES[parts.month - 1]} ${parts.year}` : '';
}

export function formatExpiryInput(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? `${pad(parts.month)}/${parts.year}` : '';
}

export function parseExpiryInput(text: string): string | null {
  const pieces = text.trim().split('/');
  if (pieces.length !== 2 || pieces[0].length !== 2 || pieces[1].length !== 4) return null;
  const month = Number(pieces[0]);
  const year = Number(pieces[1]);
  if (!Number.isInteger(month) || !Number.isInteger(year)) return null;
  if (month < 1 || month > 12 || year < MIN_EXPIRY_YEAR || year > MAX_EXPIRY_YEAR) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(lastDay)}`;
}

export function formatTime(isoDateTime: string): string {
  const timePart = isoDateTime.split('T')[1] ?? '';
  return timePart.slice(0, 5);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = toUtcMillis(fromIso);
  const to = toUtcMillis(toIso);
  if (from === null || to === null) return Number.NaN;
  return Math.round((to - from) / MILLISECONDS_PER_DAY);
}

export function addDays(iso: string, days: number): string {
  const millis = toUtcMillis(iso);
  if (millis === null) return '';
  return new Date(millis + days * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
}

export function formatWeekday(iso: string): string {
  const millis = toUtcMillis(iso);
  return millis === null ? '' : WEEKDAY_NAMES[new Date(millis).getUTCDay()];
}

export function formatDayOfMonth(iso: string): string {
  const parts = parseIsoDate(iso);
  return parts ? String(parts.day) : '';
}

export function formatWeekdayLong(iso: string): string {
  const millis = toUtcMillis(iso);
  return millis === null ? '' : WEEKDAY_LONG_NAMES[new Date(millis).getUTCDay()];
}
