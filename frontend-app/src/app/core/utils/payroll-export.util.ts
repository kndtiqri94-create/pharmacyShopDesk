import type { PayrollRow } from '../services/payroll.service';
import { neutralizeCsvCell } from './employee-export.util';
import { formatRupeesInput } from './money.util';
import {
  PayrollFilters,
  PayrollTab,
  payrollMonthKey,
  payrollMonthLabel,
} from './payroll-list.util';
import { PAYROLL_PAYMENT_STATUS_DISPLAY } from './status-display.util';

export interface PayrollPdfMeta {
  shopName: string;
  madeOn: string;
  filters: readonly string[];
  note: string;
}

export const PAYROLL_SAMPLE_NOTE = 'Sample rates, not payroll law.';

const NOT_APPLICABLE = 'N/A';
const CSV_LINE_END = '\r\n';

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_LEFT = 25;
const FONT_SIZE = 6;
const AVERAGE_CHAR_WIDTH = FONT_SIZE * 0.55;
const ROW_HEIGHT = 12;
const HEADER_LINE_HEIGHT = 8;
const HEADER_LINES = 3;
const HEADER_Y = 503;
const FIRST_ROW_Y = HEADER_Y - HEADER_LINES * HEADER_LINE_HEIGHT - 4;
const ROWS_PER_PAGE = 34;
const CODE_WIDTH = 46;
const NAME_WIDTH = 80;

interface PayrollExportColumn {
  header: string;
  value: (row: PayrollRow) => string;
}

const money = (cents: number): string => formatRupeesInput(cents);
const moneyOrNa = (cents: number | null): string =>
  cents === null ? NOT_APPLICABLE : money(cents);
const countOrNa = (value: number | null): string =>
  value === null ? NOT_APPLICABLE : String(value);

export function payrollExportColumns(tab: PayrollTab): readonly PayrollExportColumn[] {
  const daily = tab === 'daily';
  return [
    { header: 'EMP Code', value: row => row.employee.code },
    { header: 'Name', value: row => row.employee.name },
    {
      header: daily ? 'Daily Rate (Rs.)' : 'Basic Salary (Rs.)',
      value: row => money(row.pay.basicCents),
    },
    ...(daily
      ? [{ header: 'Days Worked', value: (row: PayrollRow) => countOrNa(row.pay.daysWorked) }]
      : []),
    { header: 'Allowance (Rs.)', value: row => money(row.pay.allowanceCents) },
    { header: 'Commission (Rs.)', value: row => money(row.pay.commissionCents) },
    { header: 'Salary Advance (Rs.)', value: row => money(row.pay.salaryAdvanceCents) },
    { header: 'Leaves', value: row => countOrNa(row.pay.leaves) },
    { header: 'Total Nopay (Rs.)', value: row => money(row.pay.totalNopayCents) },
    { header: 'EPF Deductions (Rs.)', value: row => moneyOrNa(row.pay.epfDeductionCents) },
    { header: 'Loan Deduction (Rs.)', value: row => moneyOrNa(row.pay.loanDeductionCents) },
    { header: 'Payee Tax (Rs.)', value: row => money(row.pay.payeeTaxCents) },
    { header: 'Over Time (Rs.)', value: row => money(row.pay.overTimeCents) },
    { header: 'Gross Salary (Rs.)', value: row => money(row.pay.grossCents) },
    { header: 'Net Salary (Rs.)', value: row => money(row.pay.netCents) },
    {
      header: 'Payment Status',
      value: row => PAYROLL_PAYMENT_STATUS_DISPLAY[row.pay.paymentStatus].label,
    },
  ];
}

export function payrollExportHeaders(tab: PayrollTab): string[] {
  return payrollExportColumns(tab).map(column => column.header);
}

export function toPayrollExportRows(rows: readonly PayrollRow[], tab: PayrollTab): string[][] {
  const columns = payrollExportColumns(tab);
  return rows.map(row => columns.map(column => column.value(row)));
}

function quoteCsvCell(value: string): string {
  const safe = neutralizeCsvCell(value);
  return /[",\r\n]/.test(safe) ? `"${safe.split('"').join('""')}"` : safe;
}

export function toPayrollCsv(rows: readonly (readonly string[])[], tab: PayrollTab): string {
  return [payrollExportHeaders(tab), ...rows]
    .map(row => row.map(quoteCsvCell).join(','))
    .join(CSV_LINE_END)
    .concat(CSV_LINE_END);
}

export function describePayrollFilters(tab: PayrollTab, filters: PayrollFilters): string[] {
  const parts = [
    `Tab: ${tab === 'daily' ? 'Daily Pay' : 'Monthly Pay'}`,
    `Year: ${filters.year}`,
    `Month: ${payrollMonthLabel(filters.month)}`,
  ];
  if (filters.keyword.trim() !== '') parts.push(`Keyword: ${filters.keyword.trim()}`);
  if (filters.location !== '') parts.push(`Location: ${filters.location}`);
  return parts;
}

export function payrollExportFileName(
  extension: 'csv' | 'pdf',
  tab: PayrollTab,
  filters: Pick<PayrollFilters, 'year' | 'month'>
): string {
  return `payroll-${tab}-${payrollMonthKey(filters)}.${extension}`;
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

function wrapHeader(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= maxChars) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

function columnWidths(count: number): number[] {
  const rest = (PAGE_WIDTH - MARGIN_LEFT * 2 - CODE_WIDTH - NAME_WIDTH) / (count - 2);
  return [CODE_WIDTH, NAME_WIDTH, ...Array.from({ length: count - 2 }, () => rest)];
}

function charsFor(width: number): number {
  return Math.floor(width / AVERAGE_CHAR_WIDTH) - 1;
}

function pageContent(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  meta: PayrollPdfMeta,
  pageNumber: number,
  pageCount: number
): string {
  const widths = columnWidths(headers.length);
  const filters = meta.filters.length === 0 ? 'None' : meta.filters.join('; ');
  const commands = [
    textCommand(MARGIN_LEFT, 560, 12, `${meta.shopName} - Employees salaries`, 100),
    textCommand(
      MARGIN_LEFT,
      545,
      8,
      `Made on ${meta.madeOn}   Page ${pageNumber} of ${pageCount}`,
      150
    ),
    textCommand(MARGIN_LEFT, 533, 8, `Filters used: ${filters}`, 190),
    textCommand(MARGIN_LEFT, 521, 8, meta.note, 190),
  ];
  let x = MARGIN_LEFT;
  headers.forEach((header, index) => {
    const maxChars = charsFor(widths[index]);
    wrapHeader(header, maxChars)
      .slice(0, HEADER_LINES)
      .forEach((line, lineIndex) =>
        commands.push(
          textCommand(x, HEADER_Y - lineIndex * HEADER_LINE_HEIGHT, FONT_SIZE, line, maxChars)
        )
      );
    x += widths[index];
  });
  rows.forEach((row, rowIndex) => {
    let cellX = MARGIN_LEFT;
    row.forEach((cell, index) => {
      commands.push(
        textCommand(
          cellX,
          FIRST_ROW_Y - rowIndex * ROW_HEIGHT,
          FONT_SIZE,
          cell,
          charsFor(widths[index])
        )
      );
      cellX += widths[index];
    });
  });
  return commands.join('\n');
}

export function toPayrollPdfBytes(
  rows: readonly (readonly string[])[],
  tab: PayrollTab,
  meta: PayrollPdfMeta
): Uint8Array {
  const headers = payrollExportHeaders(tab);
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
    const content = pageContent(headers, chunk, meta, index + 1, pageRows.length);
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
