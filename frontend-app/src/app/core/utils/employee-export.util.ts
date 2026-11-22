import { Employee } from '../models/domain/employee.model';
import { formatDate } from './date.util';
import { employeeAddressLine, EmployeeTableCriteria } from './employee-list.util';
import { EMPLOYEE_STATUS_DISPLAY } from './status-display.util';

export const EMPLOYEE_EXPORT_HEADERS: readonly string[] = [
  'EMP Code',
  'Name',
  'Address',
  'Mobile',
  'Email',
  'DOB',
  'Location',
  'Status',
];

export interface EmployeePdfMeta {
  shopName: string;
  madeOn: string;
  filters: readonly string[];
}

const FORMULA_STARTS = ['=', '+', '-', '@', '\t', '\r'];
const CSV_LINE_END = '\r\n';

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_LEFT = 30;
const FONT_SIZE = 7;
const AVERAGE_CHAR_WIDTH = FONT_SIZE * 0.55;
const ROW_HEIGHT = 12;
const FIRST_ROW_Y = 490;
const ROWS_PER_PAGE = 36;
const COLUMN_WIDTHS = [60, 105, 190, 70, 150, 55, 70, 50] as const;

export function neutralizeCsvCell(value: string): string {
  return FORMULA_STARTS.some(start => value.startsWith(start)) ? `'${value}` : value;
}

function quoteCsvCell(value: string): string {
  const safe = neutralizeCsvCell(value);
  return /[",\r\n]/.test(safe) ? `"${safe.split('"').join('""')}"` : safe;
}

export function toExportRows(employees: readonly Employee[]): string[][] {
  return employees.map(employee => [
    employee.code,
    employee.name,
    employeeAddressLine(employee),
    employee.phone,
    employee.email,
    employee.dateOfBirth === null ? '' : formatDate(employee.dateOfBirth),
    employee.location,
    EMPLOYEE_STATUS_DISPLAY[employee.status].label,
  ]);
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return [EMPLOYEE_EXPORT_HEADERS, ...rows]
    .map(row => row.map(quoteCsvCell).join(','))
    .join(CSV_LINE_END)
    .concat(CSV_LINE_END);
}

export function describeEmployeeFilters(criteria: EmployeeTableCriteria): string[] {
  const parts: string[] = [];
  if (criteria.keyword.trim() !== '') parts.push(`Keyword: ${criteria.keyword.trim()}`);
  if (criteria.location !== '') parts.push(`Location: ${criteria.location}`);
  if (criteria.createdFrom !== '') parts.push(`Created from: ${formatDate(criteria.createdFrom)}`);
  if (criteria.createdTo !== '') parts.push(`Created to: ${formatDate(criteria.createdTo)}`);
  if (criteria.status !== 'all') {
    parts.push(`Status: ${criteria.status === 'active' ? 'Active' : 'Inactive'}`);
  }
  return parts;
}

export function employeeExportFileName(extension: 'csv' | 'pdf', today: string): string {
  return `employees-${today}.${extension}`;
}

function toPdfText(value: string, maxChars: number): string {
  const ascii = [...value].map(char => (char >= ' ' && char <= '~' ? char : '?')).join('');
  const clipped =
    ascii.length > maxChars ? `${ascii.slice(0, Math.max(0, maxChars - 3))}...` : ascii;
  return clipped.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
}

function textCommand(x: number, y: number, size: number, value: string, maxChars: number): string {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${toPdfText(value, maxChars)}) Tj ET`;
}

function pageContent(
  rows: readonly (readonly string[])[],
  meta: EmployeePdfMeta,
  pageNumber: number,
  pageCount: number
): string {
  const usable = PAGE_WIDTH - MARGIN_LEFT * 2;
  const filters = meta.filters.length === 0 ? 'None' : meta.filters.join('; ');
  const commands = [
    textCommand(MARGIN_LEFT, 555, 12, `${meta.shopName} - Employees`, 100),
    textCommand(
      MARGIN_LEFT,
      540,
      8,
      `Made on ${meta.madeOn}   Page ${pageNumber} of ${pageCount}`,
      150
    ),
    textCommand(MARGIN_LEFT, 528, 8, `Filters used: ${filters}`, Math.floor(usable / 4.4)),
  ];
  const drawRow = (cells: readonly string[], y: number): void => {
    let x = MARGIN_LEFT;
    cells.forEach((cell, index) => {
      const width = COLUMN_WIDTHS[index];
      commands.push(textCommand(x, y, FONT_SIZE, cell, Math.floor(width / AVERAGE_CHAR_WIDTH) - 1));
      x += width;
    });
  };
  drawRow(EMPLOYEE_EXPORT_HEADERS, 505);
  rows.forEach((row, index) => drawRow(row, FIRST_ROW_Y - index * ROW_HEIGHT));
  return commands.join('\n');
}

export function toPdfBytes(
  rows: readonly (readonly string[])[],
  meta: EmployeePdfMeta
): Uint8Array {
  const pageRows: (readonly string[])[][] = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_PAGE) {
    pageRows.push(rows.slice(start, start + ROWS_PER_PAGE));
  }
  if (pageRows.length === 0) pageRows.push([]);

  const objects: string[] = [];
  const pageObjectIds = pageRows.map((_, index) => 4 + index * 2);
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageRows.length} >>`
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pageRows.forEach((chunk, index) => {
    const content = pageContent(chunk, meta, index + 1, pageRows.length);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageObjectIds[index] + 1} 0 R >>`
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = body.length;
  const xref = offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}` +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}
