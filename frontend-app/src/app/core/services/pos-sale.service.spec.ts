import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { BillLine } from '../models/domain/bill-line.model';
import { Bill } from '../models/domain/bill.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ProductDataService } from './data/product-data.service';
import { RoleDataService } from './data/role-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PermissionService } from './permission.service';
import { MAX_HELD_BILLS, PosSaleService } from './pos-sale.service';

const NAMED_CUSTOMER = 'cus-002';
const WALK_IN = 'cus-001';

function line(productId = 'prod-001', quantity = 4, overrides: Partial<BillLine> = {}): BillLine {
  const catalogue: Record<string, [string, string, number]> = {
    'prod-001': ['PAR-500', 'Paracetamol 500mg', 250],
    'prod-002': ['AMX-500', 'Amoxicillin 500mg', 1800],
  };
  const [sku, name, price] = catalogue[productId];
  return {
    productId,
    sku,
    name,
    barcode: '1',
    unitPriceCents: price,
    discountPercent: 0,
    quantity,
    discountApproval: null,
    ...overrides,
  };
}

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    invoiceNo: 'INV-0001',
    date: '2026-09-21',
    customerId: WALK_IN,
    repId: null,
    lines: [line()],
    billDiscount: { mode: 'PERCENT', percent: 0 },
    billDiscountApproval: null,
    payments: {
      cash: '10',
      card: '',
      online: '',
      cardReference: '',
      onlineReference: '',
      creditSelected: false,
    },
    ...overrides,
  };
}

const approval = (overrides: Partial<DiscountApproval> = {}): DiscountApproval => ({
  scope: 'LINE',
  productId: 'prod-001',
  percent: 10,
  approverUserId: 'usr-001',
  approverName: 'Nimal Perera',
  approvedAt: '2026-09-21T10:00:00',
  ...overrides,
});

describe('PosSaleService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(PosSaleService);
  const product = async (id: string) =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById(id)))!;
  const stockOf = async (id: string) =>
    (await product(id)).batches.map(batch => [batch.id, batch.quantity]);
  const sales = () => firstValueFrom(TestBed.inject(SalesDataService).getSales());
  const held = () => firstValueFrom(TestBed.inject(SalesDataService).getHeldBills());

  async function setPosLevel(role: UserRole, level: PermissionLevel): Promise<void> {
    await TestBed.inject(PermissionService).load();
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: level } })
    );
  }

  describe('save', () => {
    it('records the sale and takes the stock from the earliest-expiring batch', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(bill());
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.sale.invoiceNo).toBe('INV-0001');
      expect(result.sale.cashierUserId).toBe('usr-004');
      expect(result.sale.cashierName).toBe('Ruwani Jayawardena');
      expect(await sales()).toHaveSize(1);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 1196],
        ['bat-002', 2400],
      ]);
    });

    it('takes the cashier from the session, never from the bill', async () => {
      await signInAs(UserRole.PHARMACIST);
      const result = await service().save({ ...bill(), cashierName: 'Someone Else' } as Bill);
      expect(result.ok && result.sale.cashierName).toBe('Dilani Fernando');
    });

    it('moves on to the next batch when one is used up, in one write with the sale', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({
          lines: [line('prod-001', 1300)],
          payments: { ...bill().payments, cash: '3250' },
        })
      );
      expect(result.ok).toBeTrue();
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 0],
        ['bat-002', 2300],
      ]);
      expect(await sales()).toHaveSize(1);
    });

    it('gives each sale a different, rising invoice number even for the same bill number', async () => {
      await signInAs(UserRole.CASHIER);
      const first = await service().save(bill());
      const second = await service().save(bill());
      expect(first.ok && first.sale.invoiceNo).toBe('INV-0001');
      expect(second.ok && second.sale.invoiceNo).toBe('INV-0002');
      expect(second.ok && second.sale.id).toBe('sale-002');
    });

    it('prices the sale from fresh product data, not from the line on the bill', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({ lines: [line('prod-001', 4, { unitPriceCents: 1 })] })
      );
      expect(result.ok && result.sale.lines[0].unitPriceCents).toBe(250);
      expect(result.ok && result.sale.totalCents).toBe(1000);
    });

    it('feeds Today sales on the Dashboard', async () => {
      await signInAs(UserRole.CASHIER);
      await service().save(bill());
      const summary = await firstValueFrom(TestBed.inject(SalesDataService).getTodaySummary());
      expect(summary.salesCents).toBe(8_425_000 + 1000);
      expect(summary.bills).toBe(64);
    });

    it('does not keep any password or credential on the sale', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({
          lines: [line('prod-001', 4, { discountPercent: 10, discountApproval: approval() })],
          payments: { ...bill().payments, cash: '9' },
        })
      );
      expect(result.ok).toBeTrue();
      expect(JSON.stringify(await sales()).toLowerCase()).not.toContain('password');
      expect(JSON.stringify(await sales())).not.toContain('Owner@2026');
    });

    it('records the approver and the time when a discount was approved', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({
          lines: [line('prod-001', 4, { discountPercent: 10, discountApproval: approval() })],
          payments: { ...bill().payments, cash: '9' },
        })
      );
      expect(result.ok && result.sale.discountApprovals).toEqual([approval()]);
    });
  });

  describe('save refusals leave stock and sales untouched', () => {
    async function expectUntouched(): Promise<void> {
      expect(await sales()).toHaveSize(0);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 1200],
        ['bat-002', 2400],
      ]);
    }

    it('refuses someone who is signed out', async () => {
      const result = await service().save(bill());
      expect(result).toEqual(jasmine.objectContaining({ ok: false, reason: 'denied' }));
      await expectUntouched();
    });

    it('refuses a role with view-only POS access, checked in the service not only the screen', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      expect(await service().save(bill())).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'denied' })
      );
      await expectUntouched();
    });

    it('refuses a role whose POS access was removed in the same session', async () => {
      await signInAs(UserRole.CASHIER);
      expect((await service().save(bill())).ok).toBeTrue();
      await setPosLevel(UserRole.CASHIER, PermissionLevel.NONE);
      expect(await service().save(bill({ invoiceNo: 'INV-0002' }))).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'denied' })
      );
      expect(await sales()).toHaveSize(1);
    });

    it('blocks the sale when stock ran out since the item was added, naming the product', async () => {
      await signInAs(UserRole.CASHIER);
      const fresh = await product('prod-001');
      await firstValueFrom(
        TestBed.inject(ProductDataService).save({
          ...fresh,
          batches: fresh.batches.map(batch => ({
            ...batch,
            quantity: batch.id === 'bat-001' ? 2 : 0,
          })),
        })
      );
      const result = await service().save(bill());
      expect(result).toEqual(jasmine.objectContaining({ ok: false, reason: 'stock' }));
      expect(!result.ok && result.message).toContain('Only 2 available for Paracetamol 500mg');
      expect(await sales()).toHaveSize(0);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 2],
        ['bat-002', 0],
      ]);
    });

    it('writes nothing for any line when a later line fails', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({
          lines: [line('prod-001', 4), line('prod-002', 999)],
          payments: { ...bill().payments, cash: '99999' },
        })
      );
      expect(result.ok).toBeFalse();
      await expectUntouched();
      expect((await product('prod-002')).batches[0].quantity).toBe(150);
    });

    it('refuses an unapproved discount and a discount above the maximum', async () => {
      await signInAs(UserRole.CASHIER);
      const unapproved = await service().save(
        bill({ lines: [line('prod-001', 4, { discountPercent: 10 })] })
      );
      expect(unapproved).toEqual(jasmine.objectContaining({ ok: false, reason: 'invalid' }));
      const aboveMax = await service().save(
        bill({
          lines: [
            line('prod-001', 4, {
              discountPercent: 50,
              discountApproval: approval({ percent: 50 }),
            }),
          ],
        })
      );
      expect(aboveMax.ok).toBeFalse();
      await expectUntouched();
    });

    it('refuses an empty bill, incomplete payment and credit for the walk-in customer', async () => {
      await signInAs(UserRole.CASHIER);
      expect((await service().save(bill({ lines: [] }))).ok).toBeFalse();
      expect(
        (await service().save(bill({ payments: { ...bill().payments, cash: '5' } }))).ok
      ).toBeFalse();
      const walkInCredit = await service().save(
        bill({ payments: { ...bill().payments, cash: '3', creditSelected: true } })
      );
      expect(!walkInCredit.ok && walkInCredit.message).toContain('named customer');
      await expectUntouched();
    });

    it('lets a named customer take credit and records it', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().save(
        bill({
          customerId: NAMED_CUSTOMER,
          payments: { ...bill().payments, cash: '3', creditSelected: true },
        })
      );
      expect(result.ok && result.sale.creditCents).toBe(700);
    });

    it('accepts only one of two quick saves and reduces stock once', async () => {
      await signInAs(UserRole.CASHIER);
      const [first, second] = await Promise.all([service().save(bill()), service().save(bill())]);
      expect(first.ok).toBeTrue();
      expect(second).toEqual(jasmine.objectContaining({ ok: false, reason: 'busy' }));
      expect(await sales()).toHaveSize(1);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 1196],
        ['bat-002', 2400],
      ]);
    });
  });

  describe('hold, resume and discard', () => {
    it('parks a bill under a hold number without touching stock', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().hold(bill());
      expect(result.ok && result.held.holdNo).toBe('H-001');
      expect(result.ok && result.held.itemCount).toBe(1);
      expect(result.ok && result.held.totalCents).toBe(1000);
      const second = await service().hold(bill());
      expect(second.ok && second.held.holdNo).toBe('H-002');
      expect(await held()).toHaveSize(2);
      expect(await sales()).toHaveSize(0);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 1200],
        ['bat-002', 2400],
      ]);
    });

    it('refuses to hold an empty bill', async () => {
      await signInAs(UserRole.CASHIER);
      const result = await service().hold(bill({ lines: [] }));
      expect(!result.ok && result.message).toContain('no items');
      expect(await held()).toHaveSize(0);
    });

    it('refuses hold, resume and discard for a view-only role', async () => {
      await signInAs(UserRole.CASHIER);
      const parked = await service().hold(bill());
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      expect(await service().hold(bill())).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'denied' })
      );
      const id = parked.ok ? parked.held.id : '';
      expect(await service().resume(id, null)).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'denied' })
      );
      expect(await service().discard(id)).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'denied' })
      );
      expect(await held()).toHaveSize(1);
    });

    it('stops holding past the limit', async () => {
      await signInAs(UserRole.CASHIER);
      for (let count = 0; count < MAX_HELD_BILLS; count += 1) {
        expect((await service().hold(bill())).ok).toBeTrue();
      }
      const result = await service().hold(bill());
      expect(!result.ok && result.message).toContain('Too many bills');
      expect(await held()).toHaveSize(MAX_HELD_BILLS);
    });

    it('brings the held bill back as it was and removes the held entry', async () => {
      await signInAs(UserRole.CASHIER);
      const stored = bill({
        customerId: NAMED_CUSTOMER,
        repId: 'rep-002',
        payments: { ...bill().payments, cash: '4', card: '3', cardReference: 'ref-1' },
      });
      const parked = await service().hold(stored);
      const result = await service().resume(parked.ok ? parked.held.id : '', null);
      expect(result.ok).toBeTrue();
      if (!result.ok) return;
      expect(result.bill).toEqual(stored);
      expect(result.notes).toEqual([]);
      expect(result.autoHeld).toBeNull();
      expect(await held()).toHaveSize(0);
    });

    it('holds the current bill when another is resumed so nothing is lost', async () => {
      await signInAs(UserRole.CASHIER);
      const parked = await service().hold(bill({ lines: [line('prod-002', 1)] }));
      const current = bill({ lines: [line('prod-001', 2)] });
      const result = await service().resume(parked.ok ? parked.held.id : '', current);
      expect(result.ok && result.autoHeld?.bill.lines[0].productId).toBe('prod-001');
      const remaining = await held();
      expect(remaining).toHaveSize(1);
      expect(remaining[0].bill.lines[0].productId).toBe('prod-001');
    });

    it('re-checks a resumed bill against fresh stock and says what changed', async () => {
      await signInAs(UserRole.CASHIER);
      const parked = await service().hold(bill({ lines: [line('prod-002', 100)] }));
      const fresh = await product('prod-002');
      await firstValueFrom(
        TestBed.inject(ProductDataService).save({
          ...fresh,
          batches: fresh.batches.map(batch => ({ ...batch, quantity: 20 })),
        })
      );
      const result = await service().resume(parked.ok ? parked.held.id : '', null);
      expect(result.ok && result.bill.lines[0].quantity).toBe(20);
      expect(result.ok && result.notes.join(' ')).toContain('reduced to 20');
    });

    it('does not find a held bill that is already gone', async () => {
      await signInAs(UserRole.CASHIER);
      expect(await service().resume('held-999', null)).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'not-found' })
      );
      expect(await service().discard('held-999')).toEqual(
        jasmine.objectContaining({ ok: false, reason: 'not-found' })
      );
    });

    it('discards a held bill without touching stock', async () => {
      await signInAs(UserRole.CASHIER);
      const parked = await service().hold(bill());
      expect((await service().discard(parked.ok ? parked.held.id : '')).ok).toBeTrue();
      expect(await held()).toHaveSize(0);
      expect(await stockOf('prod-001')).toEqual([
        ['bat-001', 1200],
        ['bat-002', 2400],
      ]);
    });
  });
});
