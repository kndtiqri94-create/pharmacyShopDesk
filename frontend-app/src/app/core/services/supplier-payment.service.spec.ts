import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { amountOwedToSupplier } from '../utils/supplier-owed.util';
import { GrnDataService } from './data/grn-data.service';
import { SupplierPaymentDataService } from './data/supplier-payment-data.service';
import { SupplierPaymentService } from './supplier-payment.service';

describe('SupplierPaymentService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(SupplierPaymentService);
  const grns = () => firstValueFrom(TestBed.inject(GrnDataService).getAll());
  const payments = () => firstValueFrom(TestBed.inject(SupplierPaymentDataService).getAll());
  const owed = async (supplierId: string) => amountOwedToSupplier(await grns(), supplierId);

  it('records a payment oldest first and lowers what is owed by exactly that amount', async () => {
    await signInAs(UserRole.MANAGER);
    const before = await owed('sup-001');
    const result = await service().recordPayment('sup-001', 600_000);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.owedCents).toBe(before - 600_000);
    expect(await owed('sup-001')).toBe(before - 600_000);
    expect(result.payment.recordedBy).toBe('Kamal Silva');
    expect(result.payment.paidDate).toBe('2026-09-21');
    expect(result.payment.allocations).toEqual([
      { grnId: 'grn-006', amountCents: 520_000 },
      { grnId: 'grn-007', amountCents: 80_000 },
    ]);
    const after = await grns();
    expect(after.find(grn => grn.id === 'grn-006')?.paymentStatus).toBe(PaymentStatus.PAID);
    const part = after.find(grn => grn.id === 'grn-007')!;
    expect(part.paidCents).toBe(180_000);
    expect(part.paymentStatus).toBe(PaymentStatus.PART_PAID);
    expect(after.find(grn => grn.id === 'grn-001')?.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect((await payments()).some(payment => payment.id === result.payment.id)).toBeTrue();
  });

  it('lets an Admin settle everything a supplier is owed', async () => {
    await signInAs(UserRole.ADMIN);
    const result = await service().recordPayment('sup-001', await owed('sup-001'));
    expect(result.ok).toBeTrue();
    expect(await owed('sup-001')).toBe(0);
  });

  it('refuses a payment above what is owed and changes nothing', async () => {
    await signInAs(UserRole.MANAGER);
    const before = await grns();
    const result = await service().recordPayment('sup-001', (await owed('sup-001')) + 1);
    expect(result).toEqual({ ok: false, reason: 'too-much' });
    expect(await grns()).toEqual(before);
  });

  it('refuses zero, negative, fractional and non-numeric amounts', async () => {
    await signInAs(UserRole.MANAGER);
    for (const amount of [0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(await service().recordPayment('sup-001', amount))
        .withContext(String(amount))
        .toEqual({ ok: false, reason: 'invalid-amount' });
    }
    expect(await payments()).toHaveSize(2);
  });

  it('refuses a payment to a supplier that is owed nothing, or does not exist', async () => {
    await signInAs(UserRole.MANAGER);
    expect(await service().recordPayment('sup-004', 100)).toEqual({
      ok: false,
      reason: 'nothing-owed',
    });
    expect(await service().recordPayment('sup-999', 100)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('rejects the second of two quick submissions', async () => {
    await signInAs(UserRole.MANAGER);
    const full = await owed('sup-003');
    const [first, second] = await Promise.all([
      service().recordPayment('sup-003', full),
      service().recordPayment('sup-003', full),
    ]);
    expect(first.ok).toBeTrue();
    expect(second).toEqual({ ok: false, reason: 'busy' });
    expect(await owed('sup-003')).toBe(0);
    const again = await service().recordPayment('sup-003', full);
    expect(again).toEqual({ ok: false, reason: 'nothing-owed' });
  });

  it('refuses people who can only view suppliers, or nobody signed in', async () => {
    expect(await service().recordPayment('sup-001', 100)).toEqual({ ok: false, reason: 'denied' });
    await signInAs(UserRole.PHARMACIST);
    expect(await service().recordPayment('sup-001', 100)).toEqual({ ok: false, reason: 'denied' });
    expect(await owed('sup-001')).toBe(1_160_000);
  });
});
