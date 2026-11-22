import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { counterCloseInput, setPosLevel } from '../../../testing/pos-test.util';
import { BillType } from '../models/enums/bill-type.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { QuotationStatus } from '../models/enums/quotation-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PosCashService } from './pos-cash.service';
import { PosCounterService } from './pos-counter.service';
import { PosProductUpdateService } from './pos-product-update.service';
import { PosQuotationService } from './pos-quotation.service';
import { PosReturnService } from './pos-return.service';
import { PosSaleService } from './pos-sale.service';
import { PosService } from './pos.service';

describe('PosService, Phase B', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const pos = () => TestBed.inject(PosService);
  const quotations = () => TestBed.inject(PosQuotationService);
  const stock = async () =>
    (await firstValueFrom(TestBed.inject(ProductDataService).getById('prod-001')))!.batches.map(
      batch => batch.quantity
    );

  async function open(role: UserRole = UserRole.CASHIER): Promise<void> {
    await signInAs(role);
    await pos().open();
  }

  function fillBill(quantity = '4'): void {
    pos().addProduct('prod-001');
    pos().setQuantity('prod-001', quantity);
    pos().setPaymentText('cash', '10');
  }

  describe('bill type', () => {
    it('starts as an Invoice and can switch to Return and back', async () => {
      await open();
      expect(pos().billType()).toBe(BillType.INVOICE);
      expect(pos().setBillType(BillType.RETURN).ok).toBeTrue();
      expect(pos().billType()).toBe(BillType.RETURN);
      expect(pos().setBillType(BillType.INVOICE).ok).toBeTrue();
    });

    it('refuses anything that is not Invoice or Return (no Transfer)', async () => {
      await open();
      expect(pos().setBillType('TRANSFER' as BillType).ok).toBeFalse();
      expect(pos().billType()).toBe(BillType.INVOICE);
    });

    it('does not let a user who cannot sell switch', async () => {
      await signInAs(UserRole.CASHIER);
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      await pos().open();
      expect(pos().setBillType(BillType.RETURN).ok).toBeFalse();
    });

    it('keeps the invoice bill while looking at a return, and counts a return in progress as unsaved', async () => {
      await open();
      fillBill();
      pos().setBillType(BillType.RETURN);
      expect(pos().bill().lines).toHaveSize(1);
      pos().setBillType(BillType.INVOICE);
      await pos().saveBill();
      expect(pos().hasUnsavedContent()).toBeFalse();
      await TestBed.inject(PosReturnService).findInvoice('INV-0001');
      TestBed.inject(PosReturnService).setQuantity('prod-001', '1');
      expect(pos().hasUnsavedContent()).toBeTrue();
    });

    it('clears a return in progress when a new bill is started', async () => {
      await open();
      fillBill();
      await pos().saveBill();
      await TestBed.inject(PosReturnService).findInvoice('INV-0001');
      TestBed.inject(PosReturnService).setQuantity('prod-001', '1');
      await pos().newBill();
      expect(TestBed.inject(PosReturnService).inProgress()).toBeFalse();
    });
  });

  describe('quotations', () => {
    it('saves the bill as a quotation, clears the till and reuses the invoice number', async () => {
      await open();
      fillBill();
      const before = await stock();
      const result = await pos().saveQuotation();
      expect(result.ok).toBeTrue();
      expect(pos().bill().lines).toEqual([]);
      expect(pos().bill().invoiceNo).toBe('INV-0001');
      expect(await stock()).toEqual(before);
      expect(await firstValueFrom(TestBed.inject(SalesDataService).getSales())).toHaveSize(0);
    });

    it('refuses an empty bill with a clear message', async () => {
      await open();
      const result = await pos().saveQuotation();
      expect(!result.ok && result.message).toContain('no items');
    });

    it('refuses to save a quotation from the Return bill type', async () => {
      await open();
      pos().setBillType(BillType.RETURN);
      expect((await pos().saveQuotation()).ok).toBeFalse();
    });

    it('loads a quotation as an invoice, charging nothing until it is saved', async () => {
      await open();
      fillBill();
      await pos().saveQuotation();
      const [saved] = await quotations().list();
      const result = await pos().convertQuotation(saved.id);
      expect(result.ok).toBeTrue();
      expect(pos().bill().lines).toHaveSize(1);
      expect(pos().bill().payments.cash).toBe('');
      expect(pos().converting()?.quotationNo).toBe('QUO-0001');
      expect(await stock()).toEqual([1200, 2400]);
      pos().setPaymentText('cash', '10');
      const sale = await pos().saveBill();
      expect(sale.ok).toBeTrue();
      expect(await stock()).toEqual([1196, 2400]);
      const stored = await quotations().find(saved.id);
      expect(stored?.status).toBe(QuotationStatus.CONVERTED);
      expect(stored?.convertedInvoiceNo).toBe('INV-0001');
      expect(pos().converting()).toBeNull();
    });

    it('cannot be converted twice', async () => {
      await open();
      fillBill();
      await pos().saveQuotation();
      const [saved] = await quotations().list();
      await pos().convertQuotation(saved.id);
      pos().setPaymentText('cash', '10');
      await pos().saveBill();
      const again = await pos().convertQuotation(saved.id);
      expect(again.ok).toBeFalse();
    });

    it('puts an unsaved bill on hold first rather than losing it', async () => {
      await open();
      fillBill();
      await pos().saveQuotation();
      const [saved] = await quotations().list();
      fillBill('2');
      const result = await pos().convertQuotation(saved.id);
      expect(result.ok && result.autoHeld?.holdNo).toBe('H-001');
      expect(pos().heldBills()).toHaveSize(1);
      expect(pos().bill().lines[0].quantity).toBe(4);
    });

    it('uses today prices and says so', async () => {
      await open();
      fillBill();
      await pos().saveQuotation();
      const [saved] = await quotations().list();
      await signInAs(UserRole.ADMIN);
      await TestBed.inject(PosProductUpdateService).save('prod-001', '3', '3600', true);
      const result = await pos().convertQuotation(saved.id);
      expect(result.ok && result.notes.join(' ')).toContain('Rs. 3');
      expect(pos().bill().lines[0].unitPriceCents).toBe(300);
    });

    it('refuses a user who cannot sell', async () => {
      await open();
      fillBill();
      await pos().saveQuotation();
      const [saved] = await quotations().list();
      await setPosLevel(UserRole.CASHIER, PermissionLevel.VIEW);
      const result = await pos().convertQuotation(saved.id);
      expect(result.ok).toBeFalse();
    });
  });

  describe('product update', () => {
    it('re-checks a bill that holds the product and tells the user', async () => {
      await open();
      fillBill('4');
      await TestBed.inject(PosProductUpdateService).save('prod-001', '3', '2', true);
      const notes = await pos().recheckBillAfterProductChange();
      expect(notes.join(' ')).toContain('Only 2');
      expect(pos().bill().lines[0].unitPriceCents).toBe(300);
    });

    it('has nothing to say for an empty bill but the till search sees the new price', async () => {
      await open();
      await TestBed.inject(PosProductUpdateService).save('prod-001', '3', '3600', true);
      expect(await pos().recheckBillAfterProductChange()).toEqual([]);
      expect(
        pos()
          .products()
          .find(item => item.id === 'prod-001')?.priceCents
      ).toBe(300);
    });
  });

  describe('warnings before saving', () => {
    it('has none on a normal day', async () => {
      await open();
      fillBill();
      expect(await pos().saveWarnings()).toEqual([]);
    });

    it('warns about a closed counter', async () => {
      await open();
      fillBill();
      await TestBed.inject(PosCounterService).close(counterCloseInput('0'));
      const warnings = await pos().saveWarnings();
      expect(warnings.join(' ')).toContain('counter is already closed');
    });

    it('warns about an ended drawer only for a cash sale', async () => {
      await open();
      fillBill();
      await TestBed.inject(PosCashService).endDrawer();
      expect((await pos().saveWarnings()).join(' ')).toContain('drawer has been ended');
      pos().setPaymentText('cash', '');
      pos().setPaymentText('card', '10');
      expect(await pos().saveWarnings()).toEqual([]);
    });

    it('still saves the sale after the warning, and adds it to the day', async () => {
      await open();
      fillBill();
      await TestBed.inject(PosCashService).endDrawer();
      const sale = await TestBed.inject(PosSaleService).save(pos().bill());
      expect(sale.ok).toBeTrue();
    });
  });
});
