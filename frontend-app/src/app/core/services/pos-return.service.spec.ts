import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel, testBill } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PosReturnService } from './pos-return.service';
import { PosSaleService } from './pos-sale.service';

describe('PosReturnService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosReturnService);
  const returns = () => firstValueFrom(TestBed.inject(SalesDataService).getReturns());
  const batchQuantities = async () =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!.batches.map(
      batch => [batch.id, batch.quantity]
    );

  async function sell(customerId = 'cus-001'): Promise<void> {
    const result = await TestBed.inject(PosSaleService).save(testBill({ customerId }));
    expect(result.ok).toBeTrue();
  }

  async function prepare(quantity: string, customerId = 'cus-001'): Promise<void> {
    await signInAs(UserRole.CASHIER);
    await sell(customerId);
    expect((await service().findInvoice('inv-0001')).ok).toBeTrue();
    service().setQuantity('prod-001', quantity);
  }

  it('finds a sale by its invoice number whatever the case and spacing', async () => {
    await signInAs(UserRole.CASHIER);
    await sell();
    expect((await service().findInvoice('  inv-0001 ')).ok).toBeTrue();
    expect(service().sale()?.invoiceNo).toBe('INV-0001');
    expect(service().lines()[0].returnableQuantity).toBe(4);
  });

  it('says no sale was found and adds nothing to the return', async () => {
    await signInAs(UserRole.CASHIER);
    await sell();
    const result = await service().findInvoice('INV-9999');
    expect(result.ok).toBeFalse();
    expect(!result.ok && result.message).toContain('No sale found');
    expect(service().sale()).toBeNull();
    expect((await service().findInvoice('   ')).ok).toBeFalse();
  });

  it('puts the stock back into the batch it came from and records the return', async () => {
    await prepare('2');
    const result = await service().complete();
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.saleReturn.returnNo).toBe('RET-0001');
    expect(result.saleReturn.originalInvoiceNo).toBe('INV-0001');
    expect(result.saleReturn.totalCents).toBe(500);
    expect(result.saleReturn.settlement).toBe(ReturnSettlement.CASH_REFUND);
    expect(await batchQuantities()).toEqual([
      ['bat-001', 1198],
      ['bat-002', 2400],
    ]);
    expect(await returns()).toHaveSize(1);
    expect(service().sale()).toBeNull();
  });

  it('takes the processing user from the session', async () => {
    await prepare('1');
    const result = await service().complete();
    expect(result.ok && result.saleReturn.processedByName).toBe('Ruwani Jayawardena');
    expect(result.ok && result.saleReturn.processedByUserId).toBe('usr-004');
  });

  it('refuses an empty selection and changes nothing', async () => {
    await prepare('');
    const result = await service().complete();
    expect(result.ok).toBeFalse();
    expect(!result.ok && result.message).toContain('Nothing is selected');
    expect(await returns()).toHaveSize(0);
  });

  it('refuses more than was sold and not yet returned, using fresh returns', async () => {
    await prepare('3');
    expect((await service().complete()).ok).toBeTrue();
    await service().findInvoice('INV-0001');
    service().setQuantity('prod-001', '2');
    const result = await service().complete();
    expect(result.ok).toBeFalse();
    expect(!result.ok && result.message).toContain('Only 1');
    expect(await batchQuantities()).toEqual([
      ['bat-001', 1199],
      ['bat-002', 2400],
    ]);
  });

  it('refuses a quantity that is not a whole number', async () => {
    for (const bad of ['-1', '1.5', 'abc', '99999999']) {
      await prepare(bad);
      expect((await service().complete()).ok)
        .withContext(bad)
        .toBeFalse();
    }
    expect(await returns()).toHaveSize(0);
  });

  it('lets a second call through only once at a time', async () => {
    await prepare('1');
    const first = service().complete();
    const second = service().complete();
    const [one, two] = await Promise.all([first, second]);
    expect(one.ok).toBeTrue();
    expect(!two.ok && two.reason).toBe('busy');
    expect(await returns()).toHaveSize(1);
  });

  it('offers cash only for the Walk-in Customer and refuses credit', async () => {
    await prepare('1');
    expect(service().options()).toEqual([ReturnSettlement.CASH_REFUND]);
    service().setSettlement(ReturnSettlement.CUSTOMER_CREDIT);
    expect(service().settlement()).toBe(ReturnSettlement.CASH_REFUND);
  });

  it('records credit for a named customer', async () => {
    await prepare('1', 'cus-003');
    expect(service().options()).toContain(ReturnSettlement.CUSTOMER_CREDIT);
    service().setSettlement(ReturnSettlement.CUSTOMER_CREDIT);
    const result = await service().complete();
    expect(result.ok && result.saleReturn.settlement).toBe(ReturnSettlement.CUSTOMER_CREDIT);
    expect(result.ok && result.saleReturn.customerName).toBe('Anusha Wickramasinghe');
  });

  it('finds an earlier return for viewing, and it cannot be returned again', async () => {
    await prepare('1');
    await service().complete();
    const found = await service().findReturn('ret-0001');
    expect(found.ok).toBeTrue();
    expect(service().viewedReturn()?.returnNo).toBe('RET-0001');
    expect(service().sale()).toBeNull();
    expect((await service().findReturn('RET-0099')).ok).toBeFalse();
  });

  it('is not in progress until something is entered, and reset clears it', async () => {
    await prepare('');
    expect(service().inProgress()).toBeFalse();
    service().setQuantity('prod-001', '2');
    expect(service().inProgress()).toBeTrue();
    service().reset();
    expect(service().inProgress()).toBeFalse();
    expect(service().sale()).toBeNull();
  });

  it('refuses a user who can only view the till', async () => {
    await prepare('1');
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    const result = await service().complete();
    expect(!result.ok && result.reason).toBe('denied');
    expect(await returns()).toHaveSize(0);
    expect(await batchQuantities()).toEqual([
      ['bat-001', 1196],
      ['bat-002', 2400],
    ]);
  });

  it('refuses when nobody is signed in', async () => {
    const result = await service().complete();
    expect(!result.ok && result.reason).toBe('denied');
  });
});
