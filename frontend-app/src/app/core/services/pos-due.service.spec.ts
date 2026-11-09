import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { setPosLevel, testBill } from '../../../testing/pos-test.util';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { SalesDataService } from './data/sales-data.service';
import { PosDueService } from './pos-due.service';
import { PosSaleService } from './pos-sale.service';

describe('PosDueService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosDueService);
  const owedBy = async (customerId: string) =>
    (await service().list()).find(due => due.customerId === customerId)?.owedCents;

  it('lists customers who owe money, and not those who owe nothing or the Walk-in Customer', async () => {
    await signInAs(UserRole.CASHIER);
    const dues = await service().list();
    expect(dues.map(due => due.name)).toEqual(['Galle Road Clinic', 'Sunil Rathnayake']);
    expect(dues.every(due => due.owedCents > 0)).toBeTrue();
  });

  it('adds what a customer owes when a sale is put on credit', async () => {
    await signInAs(UserRole.CASHIER);
    const before = (await owedBy('cus-003')) ?? 0;
    expect(before).toBe(0);
    const sale = await TestBed.inject(PosSaleService).save(
      testBill({
        customerId: 'cus-003',
        payments: { ...testBill().payments, cash: '4', creditSelected: true },
      })
    );
    expect(sale.ok).toBeTrue();
    expect(await owedBy('cus-003')).toBe(600);
  });

  it('takes a payment, lowers the balance, and keeps a numbered record', async () => {
    await signInAs(UserRole.CASHIER);
    const before = (await owedBy('cus-002'))!;
    const result = await service().takePayment('cus-002', '1000', 'CASH', '');
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.payment.receiptNo).toBe('RCP-0001');
    expect(result.payment.takenBy).toBe('Ruwani Jayawardena');
    expect(result.remainingCents).toBe(before - 100_000);
    expect(await owedBy('cus-002')).toBe(before - 100_000);
    const stored = await firstValueFrom(TestBed.inject(SalesDataService).getDuePayments());
    expect(stored).toHaveSize(1);
  });

  it('removes the customer from the list once the balance is cleared', async () => {
    await signInAs(UserRole.CASHIER);
    const owed = (await owedBy('cus-002'))!;
    const result = await service().takePayment('cus-002', (owed / 100).toFixed(2), 'CARD', 'ref-1');
    expect(result.ok && result.payment.reference).toBe('ref-1');
    expect(await owedBy('cus-002')).toBeUndefined();
    const again = await service().takePayment('cus-002', '1', 'CASH', '');
    expect(again.ok).toBeFalse();
  });

  it('refuses more than is owed, zero, negative, non numeric and an unknown method', async () => {
    await signInAs(UserRole.CASHIER);
    const owed = (await owedBy('cus-002'))!;
    const tooMuch = ((owed + 1) / 100).toFixed(2);
    for (const bad of [tooMuch, '0', '0.00', '-5', '', 'abc', 'NaN', '1.234']) {
      expect((await service().takePayment('cus-002', bad, 'CASH', '')).ok)
        .withContext(bad)
        .toBeFalse();
    }
    expect((await service().takePayment('cus-002', '10', 'CREDIT', '')).ok).toBeFalse();
    expect((await service().takePayment('cus-002', '10', 'BARTER', '')).ok).toBeFalse();
    expect(await owedBy('cus-002')).toBe(owed);
  });

  it('refuses the Walk-in Customer and an unknown customer', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().takePayment('cus-001', '1', 'CASH', '')).ok).toBeFalse();
    expect((await service().takePayment('cus-999', '1', 'CASH', '')).ok).toBeFalse();
  });

  it('drops the reference for cash and caps its length otherwise', async () => {
    await signInAs(UserRole.CASHIER);
    const cash = await service().takePayment('cus-002', '1', 'CASH', 'secret');
    expect(cash.ok && cash.payment.reference).toBe('');
    const online = await service().takePayment('cus-002', '1', 'ONLINE', 'x'.repeat(300));
    expect(online.ok && online.payment.reference).toHaveSize(40);
  });

  it('refuses a user who can only view the till', async () => {
    await signInAs(UserRole.CASHIER);
    await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
    const result = await service().takePayment('cus-002', '1', 'CASH', '');
    expect(!result.ok && result.reason).toBe('denied');
    expect((await service().list()).length).toBe(2);
  });
});
