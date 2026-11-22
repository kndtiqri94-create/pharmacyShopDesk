import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import { ReloadTransactionType } from '../models/enums/reload-transaction-type.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { currentFloat } from '../utils/reload-summary.util';
import { ReloadDataService } from './data/reload-data.service';
import { ReloadService } from './reload.service';

describe('ReloadService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(ReloadService);
  const data = () => TestBed.inject(ReloadDataService);
  const float = async () => currentFloat(await firstValueFrom(data().getFloatHistory()))!;
  const transactions = () => firstValueFrom(data().getTransactions());
  const reload = { operator: 'Dialog', mobile: '77 123 4567', customerName: '', amount: '500' };
  const bill = { provider: 'Electricity (CEB)', account: '0123456789', amount: '1000' };

  it('lowers the float by the full amount, counts the reload, adds the commission and a Success row', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    const rowsBefore = await transactions();
    const result = await service().sendReload(reload);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    const after = await float();
    expect(after.availableCents).toBe(before.availableCents - 50_000);
    expect(after.reloadsCount).toBe(before.reloadsCount + 1);
    expect(after.billsCount).toBe(before.billsCount);
    expect(after.commissionCents).toBe(before.commissionCents + 1250);
    const rows = await transactions();
    expect(rows).toHaveSize(rowsBefore.length + 1);
    expect(result.transaction).toEqual(
      jasmine.objectContaining({
        id: 'rt-006',
        provider: 'Dialog',
        type: ReloadTransactionType.RELOAD,
        reference: '077 123 4567',
        amountCents: 50_000,
        commissionCents: 1250,
        status: ReloadStatus.SUCCESS,
      })
    );
    expect(rows.at(-1)).toEqual(result.transaction);
  });

  it('stamps the new row after every existing row so it lists first', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().sendReload(reload);
    if (!result.ok) throw new Error('expected a sent reload');
    const latestSeed = (await transactions()).slice(0, -1).map(row => row.occurredAt);
    expect(result.transaction.occurredAt > latestSeed.sort().at(-1)!).toBeTrue();
  });

  it('lets a Manager send, and refuses a Pharmacist without changing anything', async () => {
    await signInAs(UserRole.MANAGER);
    expect((await service().sendReload(reload)).ok).toBeTrue();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    clearBrowserStorage();
    await signInAs(UserRole.PHARMACIST);
    const before = await float();
    const rows = await transactions();
    for (const attempt of [
      await service().sendReload(reload),
      await service().payBill(bill),
      await service().topUpFloat(100_000),
    ]) {
      expect(attempt).toEqual(jasmine.objectContaining({ ok: false, reason: 'denied' }));
    }
    expect(await float()).toEqual(before);
    expect(await transactions()).toEqual(rows);
  });

  it('refuses everything when nobody is signed in', async () => {
    const result = await service().sendReload(reload);
    expect(result).toEqual(jasmine.objectContaining({ ok: false, reason: 'denied' }));
  });

  it('refuses an amount above the available float and changes nothing', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    const rows = await transactions();
    const result = await service().sendReload({ ...reload, amount: '6200.01' });
    expect(result).toEqual(
      jasmine.objectContaining({ ok: false, reason: 'invalid', firstErrorField: 'amount' })
    );
    expect(await float()).toEqual(before);
    expect(await transactions()).toEqual(rows);
  });

  it('refuses a second reload built from a stale form once the float has dropped', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().sendReload({ ...reload, amount: '6000' })).ok).toBeTrue();
    const result = await service().sendReload({ ...reload, amount: '500' });
    expect(result.ok).toBeFalse();
    expect((await float()).availableCents).toBe(20_000);
  });

  it('refuses invalid details with the field to focus', async () => {
    await signInAs(UserRole.CASHIER);
    const result = await service().sendReload({
      operator: '',
      mobile: '1',
      customerName: '',
      amount: '',
    });
    expect(result).toEqual(
      jasmine.objectContaining({ ok: false, reason: 'invalid', firstErrorField: 'operator' })
    );
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['operator', 'mobile', 'amount']);
  });

  it('rejects the second of two quick submissions', async () => {
    await signInAs(UserRole.CASHIER);
    const [first, second] = await Promise.all([
      service().sendReload(reload),
      service().sendReload(reload),
    ]);
    expect(first.ok).toBeTrue();
    expect(second).toEqual(jasmine.objectContaining({ ok: false, reason: 'busy' }));
    expect(await transactions()).toHaveSize(6);
  });

  it('pays a bill: one more bill, a Success row, float and commission untouched', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    const result = await service().payBill(bill);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.totalCents).toBe(102_500);
    const after = await float();
    expect(after).toEqual({ ...before, billsCount: before.billsCount + 1 });
    expect(result.transaction).toEqual(
      jasmine.objectContaining({
        provider: 'Electricity (CEB)',
        type: ReloadTransactionType.BILL_PAYMENT,
        reference: 'Account 0123456789',
        amountCents: 100_000,
        commissionCents: 0,
        status: ReloadStatus.SUCCESS,
      })
    );
  });

  it('refuses an invalid bill and changes nothing', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    const result = await service().payBill({ provider: '', account: '', amount: '0' });
    expect(result).toEqual(
      jasmine.objectContaining({ ok: false, reason: 'invalid', firstErrorField: 'provider' })
    );
    expect(await float()).toEqual(before);
    expect(await transactions()).toHaveSize(5);
  });

  it('tops up the float by exactly the amount and adds no transaction row', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    const result = await service().topUpFloat(500_000);
    expect(result.ok).toBeTrue();
    expect(await float()).toEqual({ ...before, availableCents: before.availableCents + 500_000 });
    expect(await transactions()).toHaveSize(5);
  });

  it('refuses top-ups that are zero, negative, part rupees, too large or not numbers', async () => {
    await signInAs(UserRole.CASHIER);
    const before = await float();
    for (const cents of [0, -100, 150, 100_000_100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await service().topUpFloat(cents))
        .withContext(String(cents))
        .toEqual({ ok: false, reason: 'invalid' });
    }
    expect(await float()).toEqual(before);
  });

  it('lets a reload happen again after a top-up raises the float', async () => {
    await signInAs(UserRole.CASHIER);
    expect((await service().sendReload({ ...reload, amount: '7000' })).ok).toBeFalse();
    await service().topUpFloat(100_000);
    expect((await service().sendReload({ ...reload, amount: '7000' })).ok).toBeTrue();
  });
});
