import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel, testBill } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { QuotationStatus } from '../models/enums/quotation-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PosQuotationService } from './pos-quotation.service';
import { PosSaleService } from './pos-sale.service';

describe('PosQuotationService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosQuotationService);
  const sales = () => firstValueFrom(TestBed.inject(SalesDataService).getSales());
  const stock = async () =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!.batches.map(
      batch => batch.quantity
    );

  it('saves the bill as a quotation with its own number and no stock or sales effect', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await stock();
    const summary = await firstValueFrom(TestBed.inject(SalesDataService).getTodaySummary());
    const result = await service().save(testBill());
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.quotation.quotationNo).toBe('QUO-0001');
    expect(result.quotation.status).toBe(QuotationStatus.OPEN);
    expect(result.quotation.itemCount).toBe(1);
    expect(result.quotation.totalCents).toBe(1000);
    expect(result.quotation.createdByName).toBe('Ruwani Jayawardena');
    expect(result.quotation.bill.payments.cash).toBe('');
    expect(await stock()).toEqual(before);
    expect(await sales()).toHaveSize(0);
    expect(await firstValueFrom(TestBed.inject(SalesDataService).getTodaySummary())).toEqual(
      summary
    );
  });

  it('refuses an empty bill and an unknown customer', async () => {
    await signInAs(UserRole.CASHIER);
    const empty = await service().save(testBill({ lines: [] }));
    expect(!empty.ok && empty.message).toContain('no items');
    const unknown = await service().save(testBill({ customerId: 'cus-999' }));
    expect(unknown.ok).toBeFalse();
    expect(await service().list()).toEqual([]);
  });

  it('lists newest first', async () => {
    await signInAs(UserRole.CASHIER);
    await service().save(testBill());
    await service().save(testBill());
    const list = await service().list();
    expect(list.map(item => item.quotationNo)).toEqual(['QUO-0002', 'QUO-0001']);
  });

  it('deletes an open quotation so it no longer appears', async () => {
    await signInAs(UserRole.CASHIER);
    const saved = await service().save(testBill());
    if (!saved.ok) throw new Error('save failed');
    expect((await service().remove(saved.quotation.id)).ok).toBeTrue();
    expect(await service().list()).toEqual([]);
    expect((await service().remove(saved.quotation.id)).ok).toBeFalse();
  });

  it('is marked converted once the invoice is saved, and cannot be converted again', async () => {
    await signInAs(UserRole.CASHIER);
    const saved = await service().save(testBill());
    if (!saved.ok) throw new Error('save failed');
    const link = { id: saved.quotation.id, quotationNo: saved.quotation.quotationNo };
    const invoice = await TestBed.inject(PosSaleService).save(testBill(), link);
    expect(invoice.ok).toBeTrue();
    if (!invoice.ok) return;
    expect(invoice.sale.convertedFromQuotationNo).toBe('QUO-0001');
    const stored = await service().find(saved.quotation.id);
    expect(stored?.status).toBe(QuotationStatus.CONVERTED);
    expect(stored?.convertedInvoiceNo).toBe(invoice.sale.invoiceNo);
    expect(await stock()).toEqual([1196, 2400]);
    const again = await TestBed.inject(PosSaleService).save(
      testBill({ invoiceNo: 'INV-0002' }),
      link
    );
    expect(again.ok).toBeFalse();
    expect(await sales()).toHaveSize(1);
    expect((await service().remove(saved.quotation.id)).ok).toBeFalse();
  });

  it('stays open when the invoice cannot be saved', async () => {
    await signInAs(UserRole.CASHIER);
    const saved = await service().save(testBill());
    if (!saved.ok) throw new Error('save failed');
    const link = { id: saved.quotation.id, quotationNo: saved.quotation.quotationNo };
    const failed = await TestBed.inject(PosSaleService).save(
      testBill({ payments: { ...testBill().payments, cash: '' } }),
      link
    );
    expect(failed.ok).toBeFalse();
    expect((await service().find(saved.quotation.id))?.status).toBe(QuotationStatus.OPEN);
  });

  it('refuses a user who can only view the till', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    const result = await service().save(testBill());
    expect(!result.ok && result.reason).toBe('denied');
    expect(await service().list()).toEqual([]);
  });
});
