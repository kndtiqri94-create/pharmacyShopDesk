import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { UserRole } from '../models/enums/user-role.enum';
import { defaultPayrollFilters } from '../utils/payroll-list.util';
import { NotificationService } from './notification.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollRow, PayrollService } from './payroll.service';

const FILTERS = defaultPayrollFilters('2026-09-21');

describe('PayrollExportService', () => {
  let created: Blob[];
  let revoked: string[];
  let clicks: HTMLAnchorElement[];
  let rows: PayrollRow[];

  beforeEach(async () => {
    clearBrowserStorage();
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
    await signInAs(UserRole.ADMIN);
    rows = await firstValueFrom(TestBed.inject(PayrollService).getPayrollRows('monthly', FILTERS));
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PayrollExportService);
  const notifications = () => TestBed.inject(NotificationService);

  it('downloads a CSV with a BOM and every row, then revokes the URL', async () => {
    const result = await service().exportCsv(rows, 'monthly', FILTERS);
    expect(result).toEqual({ ok: true, fileName: 'payroll-monthly-2026-09.csv' });
    const text = await created[0].text();
    const head = new Uint8Array(await created[0].slice(0, 3).arrayBuffer());
    expect(Array.from(head)).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain('EMP Code,Name,Basic Salary (Rs.)');
    expect(text.trim().split('\r\n')).toHaveSize(rows.length + 1);
    expect(clicks[0].download).toBe('payroll-monthly-2026-09.csv');
    expect(revoked).toEqual(['blob:test-1']);
    expect(notifications().current()).toBeNull();
  });

  it('builds a PDF with the shop name, filters and sample note', async () => {
    const result = await service().exportPdf(rows, 'monthly', FILTERS);
    expect(result).toEqual({ ok: true, fileName: 'payroll-monthly-2026-09.pdf' });
    expect(created[0].type).toBe('application/pdf');
    const text = await created[0].text();
    expect(text).toContain('ShopDesk');
    expect(text).toContain('Month: September');
    expect(text).toContain('Sample rates, not payroll law.');
    expect(revoked).toHaveSize(1);
  });

  it('shows nothing to export and creates no file for an empty list', async () => {
    expect(await service().exportCsv([], 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(await service().exportPdf([], 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(created).toHaveSize(0);
    expect(notifications().current()?.message).toContain('nothing to export');
  });

  it('shows the sample-only message, without amounts, when the file cannot be created', async () => {
    (URL.createObjectURL as jasmine.Spy).and.throwError('no blob');
    expect(await service().exportCsv(rows, 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'failed',
    });
    const message = notifications().current()?.message ?? '';
    expect(message).toContain('sample only');
    expect(message).not.toMatch(/\d/);
    expect(clicks).toHaveSize(0);
  });

  it('revokes the URL even when the click fails', async () => {
    (HTMLAnchorElement.prototype.click as jasmine.Spy).and.throwError('blocked');
    expect(await service().exportCsv(rows, 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(revoked).toEqual(['blob:test-1']);
  });

  it('refuses without Payroll access and makes no file', async () => {
    await signInAs(UserRole.CASHIER);
    expect(await service().exportCsv(rows, 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'denied',
    });
    expect(await service().exportPdf(rows, 'monthly', FILTERS)).toEqual({
      ok: false,
      reason: 'denied',
    });
    expect(created).toHaveSize(0);
  });

  it('lets a Manager (view only) export', async () => {
    await signInAs(UserRole.MANAGER);
    expect((await service().exportCsv(rows, 'monthly', FILTERS)).ok).toBeTrue();
  });
});
