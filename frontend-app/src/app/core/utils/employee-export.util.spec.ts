import { Employee } from '../models/domain/employee.model';
import { EMPLOYEE_SEED } from '../services/data/in-memory/seed/employee.seed';
import {
  describeEmployeeFilters,
  employeeExportFileName,
  EMPLOYEE_EXPORT_HEADERS,
  neutralizeCsvCell,
  toCsv,
  toExportRows,
  toPdfBytes,
} from './employee-export.util';
import { defaultEmployeeCriteria } from './employee-list.util';

const META = { shopName: 'ShopDesk', madeOn: '18 Oct 2026', filters: ['Status: Active'] };

function pdfText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('employee export', () => {
  it('neutralises formula starting cells', () => {
    for (const start of ['=1+1', '+94', '-5', '@SUM(A1)', '\tx', '\rx']) {
      expect(neutralizeCsvCell(start)).toBe(`'${start}`);
    }
    expect(neutralizeCsvCell('Nimal =1')).toBe('Nimal =1');
    expect(neutralizeCsvCell('')).toBe('');
  });

  it('writes a header and quotes commas, quotes and line breaks', () => {
    const csv = toCsv([['A,1', 'Say "hi"', 'line\nbreak', '', '', '', '', 'Active']]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(EMPLOYEE_EXPORT_HEADERS.join(','));
    expect(lines[1]).toContain('"A,1","Say ""hi""","line\nbreak"');
    expect(csv.endsWith('\r\n')).toBeTrue();
  });

  it('neutralises before quoting so quoted formulas are still safe', () => {
    const csv = toCsv([['=cmd|"x",y', '', '', '', '', '', '', '']]);
    expect(csv.split('\r\n')[1].startsWith(`"'=cmd|""x"",y"`)).toBeTrue();
  });

  it('uses the list columns and words the status', () => {
    const rows = toExportRows(EMPLOYEE_SEED);
    expect(rows.length).toBe(EMPLOYEE_SEED.length);
    expect(rows[0].length).toBe(EMPLOYEE_EXPORT_HEADERS.length);
    expect(EMPLOYEE_EXPORT_HEADERS).toEqual([
      'EMP Code',
      'Name',
      'Address',
      'Mobile',
      'Email',
      'DOB',
      'Location',
      'Status',
    ]);
    expect(rows[0][0]).toBe('EMP-001');
    expect(rows[0][5]).toBe('14 Mar 1976');
    expect(rows[7][7]).toBe('Inactive');
  });

  it('never exports pay fields', () => {
    const rich: Employee = {
      ...EMPLOYEE_SEED[0],
      basicSalaryCents: 98765432,
      overTimeRateCents: 11122233,
      monthlyTargetCents: 44455566,
      commissionRate: 77.77,
      productDiscountRate: 66.66,
      invoiceDiscountRate: 55.55,
      allowances: [{ id: 'a', name: 'SecretAllowanceName', amountCents: 99900123 }],
    };
    const csv = toCsv(toExportRows([rich]));
    const pdf = pdfText(toPdfBytes(toExportRows([rich]), META));
    for (const secret of [
      '987654',
      '111222',
      '444555',
      '77.77',
      '66.66',
      '55.55',
      'SecretAllowance',
      '999001',
    ]) {
      expect(csv).not.toContain(secret);
      expect(pdf).not.toContain(secret);
    }
  });

  it('builds a readable pdf with shop name, date and filters', () => {
    const text = pdfText(toPdfBytes(toExportRows(EMPLOYEE_SEED), META));
    expect(text.startsWith('%PDF-1.4')).toBeTrue();
    expect(text.trimEnd().endsWith('%%EOF')).toBeTrue();
    expect(text).toContain('ShopDesk - Employees');
    expect(text).toContain('Made on 18 Oct 2026');
    expect(text).toContain('Filters used: Status: Active');
    expect(text).toContain('/Count 1');
    expect(text).toContain('EMP-001');
  });

  it('points the xref at real objects and handles paging', () => {
    const rows = toExportRows(
      Array.from({ length: 80 }, (_, index) => ({ ...EMPLOYEE_SEED[0], code: `C-${index}` }))
    );
    const text = pdfText(toPdfBytes(rows, META));
    expect(text).toContain('/Count 3');
    const startxref = Number(text.split('startxref\n')[1].split('\n')[0]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const offsets = text
      .split('xref\n')[1]
      .split('\n')
      .slice(2)
      .filter(line => line.endsWith(' n '))
      .map(line => Number(line.slice(0, 10)));
    offsets.forEach((offset, index) => {
      expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it('escapes pdf text and replaces non latin characters', () => {
    const text = pdfText(
      toPdfBytes([['(a)\\b', 'Ünï', '', '', '', '', '', '']], {
        ...META,
        shopName: 'Shop (1)',
      })
    );
    expect(text).toContain('\\(a\\)\\\\b');
    expect(text).toContain('?n?');
    expect(text).toContain('Shop \\(1\\) - Employees');
  });

  it('still produces a document for no rows', () => {
    const text = pdfText(toPdfBytes([], { ...META, filters: [] }));
    expect(text).toContain('Filters used: None');
    expect(text).toContain('/Count 1');
  });

  it('describes the filters used and names the file', () => {
    expect(describeEmployeeFilters(defaultEmployeeCriteria())).toEqual([]);
    expect(
      describeEmployeeFilters({
        keyword: ' nimal ',
        location: 'Main Pharmacy',
        createdFrom: '2026-01-05',
        createdTo: '2026-02-03',
        status: 'inactive',
      })
    ).toEqual([
      'Keyword: nimal',
      'Location: Main Pharmacy',
      'Created from: 5 Jan 2026',
      'Created to: 3 Feb 2026',
      'Status: Inactive',
    ]);
    expect(employeeExportFileName('csv', '2026-10-18')).toBe('employees-2026-10-18.csv');
  });
});
