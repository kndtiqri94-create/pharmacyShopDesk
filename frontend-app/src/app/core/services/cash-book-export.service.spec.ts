import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { TEST_TODAY, setPosLevel } from '../../../testing/pos-test.util';
import { CashBookReport } from '../models/domain/cash-book-ledger.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { CashBookExportService } from './cash-book-export.service';
import { NotificationService } from './notification.service';
import { PosCashBookService } from './pos-cash-book.service';

describe('CashBookExportService', () => {
  let created: Blob[];
  let revoked: string[];
  let clicks: HTMLAnchorElement[];
  let report: CashBookReport;

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
    await signInAs(UserRole.CASHIER);
    const result = await TestBed.inject(PosCashBookService).loadRange(TEST_TODAY, TEST_TODAY);
    if (!result.ok) throw new Error(result.message);
    report = result.report;
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(CashBookExportService);
  const notifications = () => TestBed.inject(NotificationService);

  it('lets a view-only style user such as a Cashier download a CSV with a BOM', async () => {
    const result = await service().exportCsv(report);
    expect(result).toEqual({ ok: true, fileName: `cash-book-${TEST_TODAY}-to-${TEST_TODAY}.csv` });
    const head = new Uint8Array(await created[0].slice(0, 3).arrayBuffer());
    expect(Array.from(head)).toEqual([0xef, 0xbb, 0xbf]);
    expect(await created[0].text()).toContain('Opening Balance');
    expect(clicks[0].download).toContain('cash-book-');
    expect(revoked).toEqual(['blob:test-1']);
    expect(notifications().current()?.message).not.toMatch(/\d/);
  });

  it('builds a PDF with the shop name and the sample note', async () => {
    const result = await service().exportPdf(report);
    expect(result.ok).toBeTrue();
    expect(created[0].type).toBe('application/pdf');
    const text = await created[0].text();
    expect(text).toContain('ShopDesk');
    expect(text).toContain('Sample figures');
  });

  it('works for a user who can only view the till', async () => {
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    expect((await service().exportCsv(report)).ok).toBeTrue();
  });

  it('is denied without POS access and creates no file', async () => {
    await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
    expect(await service().exportCsv(report)).toEqual({ ok: false, reason: 'denied' });
    expect(await service().exportPdf(report)).toEqual({ ok: false, reason: 'denied' });
    expect(created).toHaveSize(0);
  });

  it('shows the sample-only message when the file cannot be made, and can retry', async () => {
    (URL.createObjectURL as jasmine.Spy).and.throwError('no blob');
    expect(await service().exportCsv(report)).toEqual({ ok: false, reason: 'failed' });
    expect(notifications().current()?.message).toContain('sample only');
    (URL.createObjectURL as jasmine.Spy).and.callFake(() => 'blob:again');
    expect((await service().exportCsv(report)).ok).toBeTrue();
  });

  it('ignores a second export while one is running', async () => {
    const [first, second] = await Promise.all([
      service().exportPdf(report),
      service().exportPdf(report),
    ]);
    expect([first.ok, second.ok]).toEqual([true, false]);
    expect(second.ok ? '' : second.reason).toBe('busy');
  });
});
