import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { SAMPLE_TODAY } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { RoleDataService } from './data/role-data.service';
import { SalesDataService } from './data/sales-data.service';
import { SettingsDataService } from './data/settings-data.service';
import { PermissionService } from './permission.service';
import { DiscountChangeRequest, PosDiscountApprovalService } from './pos-discount-approval.service';
import { PosService } from './pos.service';

const PARACETAMOL = 'prod-001';
const AMOXICILLIN = 'prod-002';
const SALBUTAMOL = 'prod-007';
const OUT_OF_STOCK = 'prod-006';
const NAMED_CUSTOMER = 'cus-002';
const WALK_IN = 'cus-001';

describe('PosService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const pos = () => TestBed.inject(PosService);

  async function start(role: UserRole = UserRole.CASHIER): Promise<void> {
    await signInAs(role);
    await pos().open();
  }

  async function approvalFor(change: DiscountChangeRequest): Promise<DiscountApproval> {
    const result = await TestBed.inject(PosDiscountApprovalService).approve(
      change,
      'nimal',
      'Owner@2026'
    );
    if (!result.ok) throw new Error('Expected an approval');
    return result.approval;
  }

  async function changeSettings(patch: Record<string, unknown>): Promise<void> {
    const settingsDataService = TestBed.inject(SettingsDataService);
    const current = await firstValueFrom(settingsDataService.get());
    await firstValueFrom(settingsDataService.save({ ...current, ...patch }));
  }

  async function setPosLevel(role: UserRole, level: PermissionLevel): Promise<void> {
    await TestBed.inject(PermissionService).load();
    const roleData = TestBed.inject(RoleDataService);
    const matrix = await firstValueFrom(roleData.getMatrix());
    await firstValueFrom(
      roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: level } })
    );
  }

  const lineOf = (productId: string) =>
    pos()
      .bill()
      .lines.find(line => line.productId === productId);

  describe('opening the till', () => {
    it('loads sample customers, reps and products and starts an Invoice for today', async () => {
      await start();
      const bill = pos().bill();
      expect(pos().ready()).toBeTrue();
      expect(bill.invoiceNo).toBe('INV-0001');
      expect(bill.date).toBe(SAMPLE_TODAY);
      expect(bill.customerId).toBe(WALK_IN);
      expect(bill.repId).toBeNull();
      expect(bill.lines).toEqual([]);
      expect(bill.billDiscount).toEqual({ mode: 'PERCENT', percent: 0 });
      expect(
        pos()
          .customers()
          .some(customer => customer.name === 'Walk-in Customer')
      ).toBeTrue();
      expect(pos().reps().length).toBeGreaterThan(0);
      expect(pos().products()).toHaveSize(10);
      expect(pos().settings().maxDiscountPercent).toBe(20);
    });

    it('does not skip an invoice number when the till is opened and closed without a sale', async () => {
      await start();
      expect(pos().bill().invoiceNo).toBe('INV-0001');
      pos().close();
      await pos().open();
      expect(pos().bill().invoiceNo).toBe('INV-0001');
      pos().addProduct(PARACETAMOL);
      pos().close();
      await pos().open();
      expect(pos().bill().invoiceNo).toBe('INV-0002');
    });

    it('keeps the invoice number when an untouched bill is refreshed', async () => {
      await start();
      await pos().refresh();
      expect(pos().bill().invoiceNo).toBe('INV-0001');
    });

    it('keeps the bill when opened again, and starts clean after the till was closed', async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      await pos().open();
      expect(pos().bill().lines).toHaveSize(1);
      pos().close();
      expect(pos().ready()).toBeFalse();
      await pos().open();
      expect(pos().bill().lines).toEqual([]);
    });

    it('uses the saved Settings for the next new bill', async () => {
      await signInAs(UserRole.CASHIER);
      await changeSettings({ posDefaultDiscountPercent: 5, posMaxDiscountPercent: 15 });
      await pos().open();
      expect(pos().settings().defaultDiscountPercent).toBe(5);
      expect(pos().bill().billDiscount).toEqual({ mode: 'PERCENT', percent: 5 });
      pos().addProduct(PARACETAMOL);
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(5);
    });

    it('never crashes on settings that predate point of sale', async () => {
      await signInAs(UserRole.CASHIER);
      const settingsDataService = TestBed.inject(SettingsDataService);
      const current = { ...(await firstValueFrom(settingsDataService.get())) } as Record<
        string,
        unknown
      >;
      delete current['posMaxDiscountPercent'];
      delete current['posHideSidebar'];
      await firstValueFrom(settingsDataService.save(current as never));
      await pos().open();
      expect(pos().settings().maxDiscountPercent).toBe(20);
      expect(pos().settings().hideSidebarOnOpen).toBeTrue();
    });
  });

  describe('bill lines', () => {
    it('adds a line at the selling price and counts one more when added again', async () => {
      await start();
      expect(pos().addProduct(PARACETAMOL)).toEqual({ ok: true });
      expect(lineOf(PARACETAMOL)?.unitPriceCents).toBe(250);
      expect(lineOf(PARACETAMOL)?.quantity).toBe(1);
      pos().addProduct(PARACETAMOL);
      expect(pos().bill().lines).toHaveSize(1);
      expect(lineOf(PARACETAMOL)?.quantity).toBe(2);
      expect(pos().totals().totalCents).toBe(500);
      expect(pos().hasUnsavedContent()).toBeTrue();
    });

    it('refuses an out-of-stock product with a message', async () => {
      await start();
      const result = pos().addProduct(OUT_OF_STOCK);
      expect(result.ok).toBeFalse();
      expect(!result.ok && result.message).toContain('out of stock');
      expect(pos().bill().lines).toEqual([]);
    });

    it('refuses a product whose only stock has expired while expired sales are blocked', async () => {
      await signInAs(UserRole.CASHIER);
      const productDataService = TestBed.inject(ProductDataService);
      const fresh = (await firstValueFrom(productDataService.getById(AMOXICILLIN)))!;
      await firstValueFrom(
        productDataService.save({
          ...fresh,
          batches: fresh.batches.map(batch => ({ ...batch, expiryDate: '2026-08-31' })),
        })
      );
      await pos().open();
      const result = pos().addProduct(AMOXICILLIN);
      expect(!result.ok && result.message).toContain('expired');
    });

    it('allows the expired product when Settings no longer blocks expired sales', async () => {
      await signInAs(UserRole.CASHIER);
      const productDataService = TestBed.inject(ProductDataService);
      const fresh = (await firstValueFrom(productDataService.getById(AMOXICILLIN)))!;
      await firstValueFrom(
        productDataService.save({
          ...fresh,
          batches: fresh.batches.map(batch => ({ ...batch, expiryDate: '2026-08-31' })),
        })
      );
      await changeSettings({ blockExpiredSales: false });
      await pos().open();
      expect(pos().addProduct(AMOXICILLIN).ok).toBeTrue();
    });

    it('stops adding more of a product than is in stock', async () => {
      await start();
      pos().addProduct(SALBUTAMOL);
      expect(pos().setQuantity(SALBUTAMOL, '18').ok).toBeTrue();
      const result = pos().addProduct(SALBUTAMOL);
      expect(!result.ok && result.message).toBe('Only 18 available for Salbutamol Inhaler 100mcg.');
      expect(lineOf(SALBUTAMOL)?.quantity).toBe(18);
    });

    it('changes the quantity and the totals together', async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().setQuantity(PARACETAMOL, '4');
      expect(pos().totals().subTotalCents).toBe(1000);
      expect(pos().totals().itemCount).toBe(1);
    });

    it('refuses a quantity above stock naming the amount available', async () => {
      await start();
      pos().addProduct(SALBUTAMOL);
      const result = pos().setQuantity(SALBUTAMOL, '19');
      expect(!result.ok && result.message).toContain('Only 18 available');
      expect(lineOf(SALBUTAMOL)?.quantity).toBe(1);
    });

    it('refuses quantities that are not whole numbers from 1', async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      for (const text of ['0', '-1', '1.5', 'abc', '', '1e9', '99999999']) {
        expect(pos().setQuantity(PARACETAMOL, text).ok).withContext(text).toBeFalse();
      }
      expect(lineOf(PARACETAMOL)?.quantity).toBe(1);
    });

    it('removes a line and updates the totals', async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().addProduct(AMOXICILLIN);
      pos().removeLine(PARACETAMOL);
      expect(
        pos()
          .bill()
          .lines.map(line => line.productId)
      ).toEqual([AMOXICILLIN]);
      expect(pos().totals().totalCents).toBe(1800);
    });

    it('lets a view-only user look at the till but not change the bill', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      await pos().open();
      expect(pos().canSell()).toBeFalse();
      const result = pos().addProduct(PARACETAMOL);
      expect(!result.ok && result.message).toContain('cannot change a bill');
      expect(pos().bill().lines).toEqual([]);
      expect((await pos().saveBill()).ok).toBeFalse();
      expect((await pos().holdBill()).ok).toBeFalse();
    });
  });

  describe('line discounts', () => {
    beforeEach(async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().setQuantity(PARACETAMOL, '4');
    });

    it('applies the default with no approval', () => {
      expect(pos().evaluateLineDiscount(PARACETAMOL, '0')).toEqual({ kind: 'APPLIED' });
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
    });

    it('asks for approval for any other value within the maximum and keeps the old value meanwhile', () => {
      const outcome = pos().evaluateLineDiscount(PARACETAMOL, '10');
      expect(outcome).toEqual({
        kind: 'NEEDS_APPROVAL',
        request: { scope: 'LINE', productId: PARACETAMOL, percent: 10 },
        billInput: null,
      });
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
    });

    it('refuses a value above the maximum, a non-number and an unknown line without a dialog', () => {
      for (const text of ['20.01', '25', '100', 'abc', '-5', '', '1.234']) {
        const outcome = pos().evaluateLineDiscount(PARACETAMOL, text);
        expect(outcome.kind).withContext(text).toBe('REFUSED');
      }
      const above = pos().evaluateLineDiscount(PARACETAMOL, '25');
      expect(above.kind === 'REFUSED' && above.message).toContain('20%');
      expect(pos().evaluateLineDiscount('prod-999', '0').kind).toBe('REFUSED');
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
    });

    it('applies a discount only together with an approval that matches this change', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 10 });
      expect(pos().setLineDiscount(PARACETAMOL, 10, null).ok).toBeFalse();
      expect(pos().setLineDiscount(PARACETAMOL, 10, { ...approval }).ok).toBeFalse();
      expect(pos().setLineDiscount(PARACETAMOL, 12, approval).ok).toBeFalse();
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
      expect(pos().setLineDiscount(PARACETAMOL, 10, approval)).toEqual({ ok: true });
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(10);
      expect(lineOf(PARACETAMOL)?.discountApproval?.approverName).toBe('Nimal Perera');
      expect(pos().totals().subTotalCents).toBe(900);
    });

    it('uses one approval for one change only', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 10 });
      pos().setLineDiscount(PARACETAMOL, 10, approval);
      pos().resetLineDiscount(PARACETAMOL);
      expect(pos().setLineDiscount(PARACETAMOL, 10, approval).ok).toBeFalse();
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
    });

    it('never applies a value above the maximum, even with an approval', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 30 });
      expect(pos().setLineDiscount(PARACETAMOL, 30, approval).ok).toBeFalse();
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
    });

    it('needs no approval to go back to the default, and drops the old approval', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 10 });
      pos().setLineDiscount(PARACETAMOL, 10, approval);
      expect(pos().evaluateLineDiscount(PARACETAMOL, '0')).toEqual({ kind: 'APPLIED' });
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
      expect(lineOf(PARACETAMOL)?.discountApproval).toBeNull();
    });

    it('asks again when an approved discount is changed to another value', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 10 });
      pos().setLineDiscount(PARACETAMOL, 10, approval);
      expect(pos().evaluateLineDiscount(PARACETAMOL, '15').kind).toBe('NEEDS_APPROVAL');
    });

    it('goes back to the default when the change is not approved', async () => {
      const approval = await approvalFor({ scope: 'LINE', productId: PARACETAMOL, percent: 10 });
      pos().setLineDiscount(PARACETAMOL, 10, approval);
      pos().resetLineDiscount(PARACETAMOL);
      expect(lineOf(PARACETAMOL)?.discountPercent).toBe(0);
      expect(lineOf(PARACETAMOL)?.discountApproval).toBeNull();
    });

    it('refuses every line discount when line discount is off in Settings', async () => {
      await changeSettings({ posLineDiscountEnabled: false });
      await pos().refresh();
      pos().addProduct(PARACETAMOL);
      const outcome = pos().evaluateLineDiscount(PARACETAMOL, '5');
      expect(outcome.kind === 'REFUSED' && outcome.message).toContain('turned off');
      expect(pos().setLineDiscount(PARACETAMOL, 5, null).ok).toBeFalse();
    });

    it('does not let a view-only user change a discount', async () => {
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const outcome = pos().evaluateLineDiscount(PARACETAMOL, '10');
      expect(outcome.kind).toBe('REFUSED');
      expect(pos().setLineDiscount(PARACETAMOL, 10, null).ok).toBeFalse();
    });
  });

  describe('bill discount', () => {
    beforeEach(async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().setQuantity(PARACETAMOL, '4');
    });

    it('asks for approval for a percentage that is not the default', () => {
      expect(pos().evaluateBillDiscount('PERCENT', '5')).toEqual({
        kind: 'NEEDS_APPROVAL',
        request: { scope: 'BILL', productId: null, percent: 5 },
        billInput: { mode: 'PERCENT', percent: 5 },
      });
      expect(pos().bill().billDiscount).toEqual({ mode: 'PERCENT', percent: 0 });
    });

    it('asks for approval for an amount, working out the percentage', () => {
      expect(pos().evaluateBillDiscount('AMOUNT', '1')).toEqual({
        kind: 'NEEDS_APPROVAL',
        request: { scope: 'BILL', productId: null, percent: 10 },
        billInput: { mode: 'AMOUNT', cents: 100 },
      });
    });

    it('keeps Rs. and % linked once approved, in both directions', async () => {
      const byPercent = await approvalFor({ scope: 'BILL', productId: null, percent: 10 });
      pos().setBillDiscount({ mode: 'PERCENT', percent: 10 }, byPercent);
      expect(pos().totals().discountCents).toBe(100);
      expect(pos().totals().discountPercent).toBe(10);
      expect(pos().totals().totalCents).toBe(900);
      const byAmount = await approvalFor({ scope: 'BILL', productId: null, percent: 5 });
      pos().setBillDiscount({ mode: 'AMOUNT', cents: 50 }, byAmount);
      expect(pos().totals().discountCents).toBe(50);
      expect(pos().totals().discountPercent).toBe(5);
    });

    it('refuses a percentage above the maximum or an amount above the sub total, with no dialog', () => {
      expect(pos().evaluateBillDiscount('PERCENT', '25').kind).toBe('REFUSED');
      const aboveSub = pos().evaluateBillDiscount('AMOUNT', '10.01');
      expect(aboveSub.kind === 'REFUSED' && aboveSub.message).toContain('sub total');
      expect(pos().evaluateBillDiscount('AMOUNT', '3').kind).toBe('REFUSED');
      expect(pos().evaluateBillDiscount('PERCENT', 'abc').kind).toBe('REFUSED');
      expect(pos().evaluateBillDiscount('AMOUNT', '1.234').kind).toBe('REFUSED');
    });

    it('applies only with a matching approval and never above the maximum', async () => {
      expect(pos().setBillDiscount({ mode: 'PERCENT', percent: 10 }, null).ok).toBeFalse();
      const approval = await approvalFor({ scope: 'BILL', productId: null, percent: 30 });
      expect(pos().setBillDiscount({ mode: 'PERCENT', percent: 30 }, approval).ok).toBeFalse();
      const lineApproval = await approvalFor({ scope: 'LINE', productId: null, percent: 10 });
      expect(pos().setBillDiscount({ mode: 'PERCENT', percent: 10 }, lineApproval).ok).toBeFalse();
      expect(pos().bill().billDiscount).toEqual({ mode: 'PERCENT', percent: 0 });
    });

    it('needs no approval to go back to the default, and asks again for another value', async () => {
      const approval = await approvalFor({ scope: 'BILL', productId: null, percent: 10 });
      pos().setBillDiscount({ mode: 'PERCENT', percent: 10 }, approval);
      expect(pos().evaluateBillDiscount('PERCENT', '15').kind).toBe('NEEDS_APPROVAL');
      expect(pos().evaluateBillDiscount('PERCENT', '0')).toEqual({ kind: 'APPLIED' });
      expect(pos().bill().billDiscountApproval).toBeNull();
      expect(pos().totals().discountCents).toBe(0);
    });

    it('is refused when bill discount is off in Settings', async () => {
      await changeSettings({ posBillDiscountEnabled: false });
      await pos().refresh();
      const outcome = pos().evaluateBillDiscount('PERCENT', '5');
      expect(outcome.kind === 'REFUSED' && outcome.message).toContain('turned off');
    });

    it('warns when the approved discount no longer fits after the lines change', async () => {
      const approval = await approvalFor({ scope: 'BILL', productId: null, percent: 10 });
      pos().setBillDiscount({ mode: 'AMOUNT', cents: 100 }, approval);
      expect(pos().discountProblem()).toBeNull();
      pos().setQuantity(PARACETAMOL, '8');
      expect(pos().discountProblem()).toContain('approval');
    });
  });

  describe('customer, rep and date', () => {
    beforeEach(() => start());

    it('picks a customer and a rep from the lists only', () => {
      expect(pos().setCustomer(NAMED_CUSTOMER)).toEqual({ ok: true });
      expect(pos().bill().customerId).toBe(NAMED_CUSTOMER);
      expect(pos().setCustomer('cus-999').ok).toBeFalse();
      expect(pos().setRep('rep-001')).toEqual({ ok: true });
      expect(pos().setRep(null)).toEqual({ ok: true });
      expect(pos().setRep('rep-999').ok).toBeFalse();
      expect(pos().bill().repId).toBeNull();
    });

    it('accepts today or an earlier date and refuses the future and non-dates', () => {
      expect(pos().setDate('2026-09-18')).toEqual({ ok: true });
      expect(pos().bill().date).toBe('2026-09-18');
      expect(pos().setDate(SAMPLE_TODAY).ok).toBeTrue();
      expect(pos().setDate('2026-09-22').ok).toBeFalse();
      expect(pos().setDate('nonsense').ok).toBeFalse();
      expect(pos().setDate('2026-02-30').ok).toBeFalse();
      expect(pos().bill().date).toBe(SAMPLE_TODAY);
    });

    it('starts a new bill with a new invoice number', async () => {
      const first = pos().bill().invoiceNo;
      await pos().newBill();
      expect(pos().bill().invoiceNo).not.toBe(first);
      expect(pos().bill().invoiceNo).toBe('INV-0002');
    });
  });

  describe('payment', () => {
    beforeEach(async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().setQuantity(PARACETAMOL, '4');
    });

    it('treats Cash + Card + Online as paid and shows no credit', () => {
      pos().setPaymentText('cash', '6');
      pos().setPaymentText('card', '4');
      expect(pos().totals().paidCents).toBe(1000);
      expect(pos().totals().balanceKind).toBe('SETTLED');
    });

    it('shows Change when cash is more than the amount due', () => {
      pos().setPaymentText('cash', '12');
      expect(pos().totals().balanceKind).toBe('CHANGE');
      expect(pos().totals().changeCents).toBe(200);
    });

    it('keeps references for card and online, capped in length', () => {
      pos().setReference('card', 'c'.repeat(100));
      pos().setReference('online', 'ONL-1');
      expect(pos().bill().payments.cardReference).toHaveSize(40);
      expect(pos().bill().payments.onlineReference).toBe('ONL-1');
    });

    it('blocks Credit for the walk-in customer with a message', () => {
      const result = pos().setCredit(true);
      expect(!result.ok && result.message).toContain('named customer');
      expect(pos().bill().payments.creditSelected).toBeFalse();
    });

    it('shows Credit due and Paid for a named customer', () => {
      pos().setCustomer(NAMED_CUSTOMER);
      pos().setPaymentText('cash', '3');
      expect(pos().setCredit(true)).toEqual({ ok: true });
      expect(pos().totals().balanceKind).toBe('CREDIT_DUE');
      expect(pos().totals().creditCents).toBe(700);
      expect(pos().totals().paidCents).toBe(300);
    });

    it('will not save a credit bill once the customer is changed back to Walk-in', async () => {
      pos().setCustomer(NAMED_CUSTOMER);
      pos().setPaymentText('cash', '3');
      pos().setCredit(true);
      pos().setCustomer(WALK_IN);
      expect(pos().isWalkIn()).toBeTrue();
      const result = await pos().saveBill();
      expect(!result.ok && result.message).toContain('named customer');
      expect(pos().bill().lines).toHaveSize(1);
    });

    it('types on the keypad into the field in use, ignoring a second point and a third decimal', () => {
      for (const key of ['1', '2', '.', '5', '.', '7', '9']) pos().pressKey(key);
      expect(pos().bill().payments.cash).toBe('12.57');
      pos().selectPaymentField('card');
      for (const key of ['5', '0', 'BACKSPACE']) pos().pressKey(key);
      expect(pos().bill().payments.card).toBe('5');
      expect(pos().bill().payments.cash).toBe('12.57');
    });

    it('does not break on text that is not an amount', () => {
      pos().setPaymentText('cash', 'abc');
      expect(pos().parsedPayments().errors.cash).toBeDefined();
      expect(pos().totals().totalCents).toBe(1000);
    });

    it('ignores oversized payment text', () => {
      pos().setPaymentText('cash', '9'.repeat(100));
      expect(pos().bill().payments.cash.length).toBeLessThanOrEqual(12);
    });
  });

  describe('saving, holding and resuming', () => {
    beforeEach(async () => {
      await start();
      pos().addProduct(PARACETAMOL);
      pos().setQuantity(PARACETAMOL, '4');
      pos().setPaymentText('cash', '10');
    });

    it('saves, reloads stock and opens a new empty bill with the next invoice number', async () => {
      const result = await pos().saveBill();
      expect(result.ok && result.sale.invoiceNo).toBe('INV-0001');
      expect(pos().bill().lines).toEqual([]);
      expect(pos().bill().invoiceNo).toBe('INV-0002');
      expect(pos().bill().payments.cash).toBe('');
      const paracetamol = pos()
        .products()
        .find(product => product.id === PARACETAMOL)!;
      expect(paracetamol.batches.find(batch => batch.id === 'bat-001')?.quantity).toBe(1196);
      expect(pos().working()).toBeFalse();
    });

    it('keeps the bill on screen when saving is refused', async () => {
      pos().setPaymentText('cash', '5');
      const result = await pos().saveBill();
      expect(!result.ok && result.message).toContain('incomplete');
      expect(pos().bill().lines).toHaveSize(1);
      expect(pos().bill().payments.cash).toBe('5');
    });

    it('blocks saving with a message naming the product when stock ran out meanwhile', async () => {
      const productDataService = TestBed.inject(ProductDataService);
      const fresh = (await firstValueFrom(productDataService.getById(PARACETAMOL)))!;
      await firstValueFrom(
        productDataService.save({
          ...fresh,
          batches: fresh.batches.map(batch => ({ ...batch, quantity: 1 })),
        })
      );
      const result = await pos().saveBill();
      expect(!result.ok && result.message).toContain('Paracetamol 500mg');
      expect(pos().bill().lines).toHaveSize(1);
    });

    it('holds a bill, opens a fresh one and lists the held bill', async () => {
      const result = await pos().holdBill();
      expect(result.ok && result.held.holdNo).toBe('H-001');
      expect(pos().bill().lines).toEqual([]);
      expect(pos().bill().invoiceNo).toBe('INV-0002');
      expect(pos().heldBills()).toHaveSize(1);
      const sales = await firstValueFrom(TestBed.inject(SalesDataService).getSales());
      expect(sales).toHaveSize(0);
    });

    it('refuses to hold an empty bill', async () => {
      pos().removeLine(PARACETAMOL);
      const result = await pos().holdBill();
      expect(!result.ok && result.message).toContain('no items');
    });

    it('resumes a held bill with the same lines, customer, discount and payment entries', async () => {
      pos().setCustomer(NAMED_CUSTOMER);
      const heldBill = pos().bill();
      const held = await pos().holdBill();
      const result = await pos().resumeHeldBill(held.ok ? held.held.id : '');
      expect(result.ok).toBeTrue();
      expect(pos().bill()).toEqual(heldBill);
      expect(pos().heldBills()).toHaveSize(0);
    });

    it('holds the current bill when resuming another one', async () => {
      const first = await pos().holdBill();
      pos().addProduct(AMOXICILLIN);
      const result = await pos().resumeHeldBill(first.ok ? first.held.id : '');
      expect(result.ok && result.autoHeld?.holdNo).toBe('H-002');
      expect(
        pos()
          .bill()
          .lines.map(line => line.productId)
      ).toEqual([PARACETAMOL]);
      expect(pos().heldBills()).toHaveSize(1);
      expect(pos().heldBills()[0].bill.lines[0].productId).toBe(AMOXICILLIN);
    });

    it('discards a held bill', async () => {
      const held = await pos().holdBill();
      const result = await pos().discardHeldBill(held.ok ? held.held.id : '');
      expect(result.ok).toBeTrue();
      expect(pos().heldBills()).toHaveSize(0);
    });

    it('refreshing clears the bill and reloads the data', async () => {
      await pos().refresh();
      expect(pos().bill().lines).toEqual([]);
      expect(pos().ready()).toBeTrue();
    });
  });
});
