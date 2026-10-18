import { TestBed } from '@angular/core/testing';
import { EMPLOYEE_SEED } from './data/in-memory/seed/employee.seed';
import { defaultEmployeeCriteria } from '../utils/employee-list.util';
import { EmployeeExportService } from './employee-export.service';
import { NotificationService } from './notification.service';
import { TEST_PROVIDERS } from '../../../testing/auth-test.util';

describe('EmployeeExportService', () => {
  let created: Blob[];
  let revoked: string[];
  let clicks: HTMLAnchorElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    created = [];
    revoked = [];
    clicks = [];
    spyOn(URL, 'createObjectURL').and.callFake((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return `blob:test-${created.length}`;
    });
    spyOn(URL, 'revokeObjectURL').and.callFake((url: string) => {
      revoked.push(url);
    });
    spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
  });

  const service = () => TestBed.inject(EmployeeExportService);
  const notifications = () => TestBed.inject(NotificationService);

  it('downloads a CSV with a BOM, the list columns and no pay fields, then revokes the URL', async () => {
    const result = await service().exportCsv(EMPLOYEE_SEED);
    expect(result).toEqual({ ok: true, fileName: 'employees-2026-09-21.csv' });
    const text = await created[0].text();
    const head = new Uint8Array(await created[0].slice(0, 3).arrayBuffer());
    expect(Array.from(head)).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain('EMP Code,Name,Address,Mobile,Email,DOB,Location,Status');
    expect(text.toLowerCase()).not.toContain('salary');
    expect(text).not.toContain('250000');
    expect(clicks[0].download).toBe('employees-2026-09-21.csv');
    expect(revoked).toEqual(['blob:test-1']);
  });

  it('builds a PDF with the shop name, date and filters used', async () => {
    const result = await service().exportPdf(EMPLOYEE_SEED, {
      ...defaultEmployeeCriteria(),
      keyword: 'nimal',
    });
    expect(result).toEqual({ ok: true, fileName: 'employees-2026-09-21.pdf' });
    expect(created[0].type).toBe('application/pdf');
    const text = await created[0].text();
    expect(text.startsWith('%PDF')).toBeTrue();
    expect(text).toContain('ShopDesk');
    expect(text).toContain('Keyword: nimal');
    expect(text.toLowerCase()).not.toContain('salary');
    expect(revoked).toHaveSize(1);
  });

  it('shows nothing to export and creates no file for an empty list', async () => {
    expect(await service().exportCsv([])).toEqual({ ok: false, reason: 'empty' });
    expect(await service().exportPdf([], defaultEmployeeCriteria())).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(created).toHaveSize(0);
    expect(notifications().current()?.message).toContain('nothing to export');
  });

  it('shows the sample-only message when the file cannot be created', async () => {
    (URL.createObjectURL as jasmine.Spy).and.throwError('no blob');
    expect(await service().exportCsv(EMPLOYEE_SEED)).toEqual({ ok: false, reason: 'failed' });
    expect(notifications().current()?.message).toContain('sample only');
    expect(clicks).toHaveSize(0);
  });

  it('revokes the URL even when the click fails', async () => {
    (HTMLAnchorElement.prototype.click as jasmine.Spy).and.throwError('blocked');
    expect(await service().exportCsv(EMPLOYEE_SEED)).toEqual({ ok: false, reason: 'failed' });
    expect(revoked).toEqual(['blob:test-1']);
  });
});
