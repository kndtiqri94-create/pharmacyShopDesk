import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import { differenceStatus } from './cash-book-ledger.util';
import { formatDate } from './date.util';
import { neutralizeCsvCell } from './employee-export.util';
import { formatRupeesInput } from './money.util';

export interface CashBookExportTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface CashBookPdfMeta {
  shopName: string;
  madeOn: string;
  note: string;
}

export const CASH_BOOK_SAMPLE_NOTE = 'Sample figures, not an official report.';
export const NOT_ENTERED = 'Not entered yet';
export const NOT_AVAILABLE = 'Not available';

const CSV_LINE_END = '\r\n';
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 40;
const TOP_Y = 800;
const LINE_HEIGHT = 14;
const LINES_PER_PAGE = 50;
const COLUMN_STARTS = [MARGIN_LEFT, 270, 340, 410, 480];
const COLUMN_CHARS = [38, 12, 12, 12, 12];

const money = (cents: number): string => formatRupeesInput(cents);

function ledgerTable(report: CashBookReport): CashBookExportTable {
  const { ledger } = report;
  const rows = ledger.rows.map(row => [
    row.isMock ? `${row.description} (Sample)` : row.description,
    money(row.creditCents),
    money(row.debitCents),
    money(row.balanceCents),
  ]);
  const difference =
    ledger.differenceCents === null
      ? NOT_AVAILABLE
      : `${money(ledger.differenceCents)} (${differenceStatus(ledger.differenceCents)})`;
  return {
    title: 'Cash ledger',
    headers: ['Description', 'Credit (Rs.)', 'Debit (Rs.)', 'Balance (Rs.)'],
    rows: [
      ...rows,
      [
        'Balance',
        money(ledger.totalCreditCents),
        money(ledger.totalDebitCents),
        money(ledger.balanceCents),
      ],
      [
        'Actual Balance',
        '',
        '',
        ledger.actualBalanceCents === null ? NOT_ENTERED : money(ledger.actualBalanceCents),
      ],
      ['Difference', '', '', difference],
    ],
  };
}

export function toCashBookTables(report: CashBookReport): CashBookExportTable[] {
  return [
    ledgerTable(report),
    {
      title: 'Other Payment Invoices',
      headers: ['Method', 'Invoices', 'Amount (Rs.)'],
      rows: report.paymentInvoices.map(line => [
        line.method,
        String(line.invoiceCount),
        money(line.amountCents),
      ]),
    },
    {
      title: 'Daily Sales Summary',
      headers: ['Item', 'Count', 'Amount (Rs.)'],
      rows: report.dailySales.map(line => [
        line.label,
        line.count === null ? '' : String(line.count),
        money(line.amountCents),
      ]),
    },
  ];
}

export function describeCashBookRange(report: Pick<CashBookReport, 'from' | 'to'>): string {
  return report.from === report.to
    ? formatDate(report.from)
    : `${formatDate(report.from)} to ${formatDate(report.to)}`;
}

function isPlainNumber(value: string): boolean {
  const unsigned = value.startsWith('-') ? value.slice(1) : value;
  const [whole, fraction, ...rest] = unsigned.split('.');
  const digits = [...whole, ...(fraction ?? '')];
  return (
    rest.length === 0 &&
    whole.length > 0 &&
    fraction !== '' &&
    digits.every(char => char >= '0' && char <= '9')
  );
}

export function csvSafeCell(value: string): string {
  const safe = isPlainNumber(value) ? value : neutralizeCsvCell(value);
  return /[",\r\n]/.test(safe) ? `"${safe.split('"').join('""')}"` : safe;
}

export function toCashBookCsv(report: CashBookReport): string {
  const lines: string[][] = [
    ['Cash Book'],
    ['Created at', describeCashBookRange(report)],
    [CASH_BOOK_SAMPLE_NOTE],
  ];
  for (const table of toCashBookTables(report)) {
    lines.push([], [table.title], table.headers, ...table.rows);
  }
  return lines.map(line => line.map(csvSafeCell).join(',')).join(CSV_LINE_END) + CSV_LINE_END;
}

export function cashBookExportFileName(
  extension: 'csv' | 'pdf',
  report: Pick<CashBookReport, 'from' | 'to'>
): string {
  return `cash-book-${report.from}-to-${report.to}.${extension}`;
}

interface PdfLine {
  cells: string[];
  size: number;
}

function toPdfText(value: string, maxChars: number): string {
  const ascii = [...value].map(char => (char >= ' ' && char <= '~' ? char : '?')).join('');
  const clipped =
    ascii.length > maxChars ? `${ascii.slice(0, Math.max(0, maxChars - 3))}...` : ascii;
  return clipped.split('\\').join('\\\\').split('(').join('\\(').split(')').join('\\)');
}

function pdfLines(report: CashBookReport, meta: CashBookPdfMeta): PdfLine[] {
  const lines: PdfLine[] = [
    { cells: [`${meta.shopName} - Cash Book`], size: 13 },
    { cells: [`Created at: ${describeCashBookRange(report)}`], size: 9 },
    { cells: [`Made on ${meta.madeOn}`], size: 9 },
    { cells: [meta.note], size: 9 },
  ];
  for (const table of toCashBookTables(report)) {
    lines.push({ cells: [''], size: 9 }, { cells: [table.title], size: 11 });
    lines.push({ cells: table.headers, size: 8 }, ...table.rows.map(cells => ({ cells, size: 8 })));
  }
  return lines;
}

function pageStream(lines: readonly PdfLine[]): string {
  return lines
    .flatMap((line, index) =>
      line.cells.map((cell, column) => {
        const maxChars = line.cells.length === 1 ? 90 : COLUMN_CHARS[column];
        const text = toPdfText(cell, maxChars);
        const x = COLUMN_STARTS[column];
        return `BT /F1 ${line.size} Tf ${x} ${TOP_Y - index * LINE_HEIGHT} Td (${text}) Tj ET`;
      })
    )
    .join('\n');
}

export function toCashBookPdfBytes(report: CashBookReport, meta: CashBookPdfMeta): Uint8Array {
  const lines = pdfLines(report, meta);
  const pages: PdfLine[][] = [];
  for (let start = 0; start < lines.length; start += LINES_PER_PAGE) {
    pages.push(lines.slice(start, start + LINES_PER_PAGE));
  }
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  pages.forEach((chunk, index) => {
    const content = pageStream(chunk);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );
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
