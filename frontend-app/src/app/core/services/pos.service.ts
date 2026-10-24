import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BillDiscountInput } from '../models/domain/bill-discount.model';
import { BillLine } from '../models/domain/bill-line.model';
import { Bill } from '../models/domain/bill.model';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { HeldBill } from '../models/domain/held-bill.model';
import { PaymentEntries } from '../models/domain/payment-entries.model';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { PosSettings } from '../models/domain/pos-settings.model';
import { Product } from '../models/domain/product.model';
import { SalesRep } from '../models/domain/sales-rep.model';
import { DiscountScope } from '../models/enums/discount-scope.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { isIsoDate } from '../utils/date.util';
import {
  decideBillDiscount,
  decideLineDiscount,
  defaultBillDiscount,
  defaultLineDiscountPercent,
  findDiscountProblem,
  parseDiscountPercent,
} from '../utils/pos-discount.util';
import { applyKeypadKey } from '../utils/pos-keypad.util';
import { POS_SETTINGS_DEFAULTS, toPosSettings } from '../utils/pos-settings.util';
import { SellableStock, getSellableStock } from '../utils/pos-stock-allocation.util';
import { PaymentAmounts, billDiscountPercent, computeBillTotals } from '../utils/pos-totals.util';
import {
  AMOUNT_TEXT_MAX_LENGTH,
  CREDIT_WALK_IN_MESSAGE,
  PaymentFieldKey,
  REFERENCE_MAX_LENGTH,
  checkProductAddable,
  checkQuantityAgainstStock,
  invalidQuantityMessage,
  parseAmountCents,
  parseLineQuantity,
  parsePaymentEntries,
} from '../utils/pos-validation.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { SettingsDataService } from './data/settings-data.service';
import { PermissionService } from './permission.service';
import { DiscountChangeRequest, PosDiscountApprovalService } from './pos-discount-approval.service';
import {
  DiscardResult,
  HoldResult,
  PosSaleService,
  ResumeResult,
  SaveSaleResult,
} from './pos-sale.service';

export type PosActionResult = { ok: true } | { ok: false; message: string };

export type DiscountEvaluation =
  | { kind: 'APPLIED' }
  | { kind: 'NEEDS_APPROVAL'; request: DiscountChangeRequest; billInput: BillDiscountInput | null }
  | { kind: 'REFUSED'; message: string };

const NOT_ALLOWED = 'You can look at the till, but you cannot change a bill.';
const NEEDS_APPROVAL = "That discount needs an Admin's approval.";
const ZERO_AMOUNTS: PaymentAmounts = {
  cashCents: 0,
  cardCents: 0,
  onlineCents: 0,
  creditSelected: false,
};

function ok(): PosActionResult {
  return { ok: true };
}

function fail(message: string): PosActionResult {
  return { ok: false, message };
}

function emptyPayments(): PaymentEntries {
  return {
    cash: '',
    card: '',
    online: '',
    cardReference: '',
    onlineReference: '',
    creditSelected: false,
  };
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly clockService = inject(ClockService);
  private readonly productDataService = inject(ProductDataService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly saleService = inject(PosSaleService);
  private readonly approvalService = inject(PosDiscountApprovalService);

  private readonly settingsSignal = signal<PosSettings>(POS_SETTINGS_DEFAULTS);
  private readonly productsSignal = signal<readonly Product[]>([]);
  private readonly customersSignal = signal<readonly PosCustomer[]>([]);
  private readonly billSignal = signal<Bill>(this.blankBill(''));
  private readonly repsSignal = signal<readonly SalesRep[]>([]);
  private readonly heldBillsSignal = signal<readonly HeldBill[]>([]);
  private readonly activeFieldSignal = signal<PaymentFieldKey>('cash');
  private readonly workingSignal = signal(false);
  private readonly readySignal = signal(false);
  private blockExpired = true;
  private started = false;

  readonly bill = this.billSignal.asReadonly();
  readonly settings = this.settingsSignal.asReadonly();
  readonly products = this.productsSignal.asReadonly();
  readonly customers = this.customersSignal.asReadonly();
  readonly reps = this.repsSignal.asReadonly();
  readonly heldBills = this.heldBillsSignal.asReadonly();
  readonly activePaymentField = this.activeFieldSignal.asReadonly();
  readonly working = this.workingSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();

  readonly canSell = computed(
    () => this.authService.currentUser() !== null && this.permissionService.canWrite(ModuleKey.POS)
  );
  readonly parsedPayments = computed(() => parsePaymentEntries(this.billSignal().payments));
  readonly totals = computed(() => {
    const bill = this.billSignal();
    const amounts = this.parsedPayments().amounts ?? {
      ...ZERO_AMOUNTS,
      creditSelected: bill.payments.creditSelected,
    };
    return computeBillTotals(bill.lines, bill.billDiscount, amounts);
  });
  readonly isWalkIn = computed(() => {
    const customerId = this.billSignal().customerId;
    return this.customersSignal().find(customer => customer.id === customerId)?.isWalkIn ?? true;
  });
  readonly hasUnsavedContent = computed(() => this.billSignal().lines.length > 0);
  readonly discountProblem = computed(() => {
    const bill = this.billSignal();
    return findDiscountProblem(
      bill.lines,
      bill.billDiscount,
      bill.billDiscountApproval,
      this.totals().subTotalCents,
      this.settingsSignal()
    );
  });

  async open(): Promise<void> {
    await this.loadData();
    if (!this.started) await this.startNewBill();
    this.readySignal.set(true);
  }

  async refresh(): Promise<void> {
    this.releasePristineInvoiceNumber();
    await this.loadData();
    await this.startNewBill();
  }

  close(): void {
    this.releasePristineInvoiceNumber();
    this.started = false;
    this.readySignal.set(false);
    this.billSignal.set(this.blankBill(''));
    this.activeFieldSignal.set('cash');
  }

  async newBill(): Promise<void> {
    await this.startNewBill();
  }

  stockFor(product: Product): SellableStock {
    return getSellableStock(product, this.clockService.today(), this.blockExpired);
  }

  addProduct(productId: string): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    const product = this.productsSignal().find(candidate => candidate.id === productId);
    if (product === undefined) return fail('That product is not available.');
    const bill = this.billSignal();
    const existing = bill.lines.find(line => line.productId === productId);
    const stock = getSellableStock(product, this.clockService.today(), this.blockExpired);
    const check = checkProductAddable(product, stock, bill.lines.length, existing?.quantity ?? 0);
    if (!check.ok) return fail(check.message);
    if (existing) {
      this.updateLine(productId, line => ({ ...line, quantity: line.quantity + 1 }));
    } else {
      this.billSignal.set({ ...bill, lines: [...bill.lines, this.newLine(product)] });
    }
    return ok();
  }

  setQuantity(productId: string, text: string): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    const quantity = parseLineQuantity(text);
    if (quantity === null) return fail(invalidQuantityMessage());
    const product = this.productsSignal().find(candidate => candidate.id === productId);
    if (product === undefined) return fail('That product is not available.');
    const stock = getSellableStock(product, this.clockService.today(), this.blockExpired);
    const check = checkQuantityAgainstStock(product.name, quantity, stock);
    if (!check.ok) return fail(check.message);
    this.updateLine(productId, line => ({ ...line, quantity }));
    return ok();
  }

  removeLine(productId: string): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    const bill = this.billSignal();
    this.billSignal.set({
      ...bill,
      lines: bill.lines.filter(line => line.productId !== productId),
    });
    return ok();
  }

  evaluateLineDiscount(productId: string, text: string): DiscountEvaluation {
    if (!this.canSell()) return { kind: 'REFUSED', message: NOT_ALLOWED };
    if (!this.billSignal().lines.some(line => line.productId === productId)) {
      return { kind: 'REFUSED', message: 'That item is not on the bill.' };
    }
    const percent = parseDiscountPercent(text) ?? Number.NaN;
    const decision = decideLineDiscount(percent, this.settingsSignal());
    if (decision.kind === 'REFUSED') return { kind: 'REFUSED', message: decision.message };
    if (decision.kind === 'NEEDS_APPROVAL') {
      return {
        kind: 'NEEDS_APPROVAL',
        request: { scope: DiscountScope.LINE, productId, percent },
        billInput: null,
      };
    }
    this.setLineDiscount(productId, percent, null);
    return { kind: 'APPLIED' };
  }

  setLineDiscount(
    productId: string,
    percent: number,
    approval: DiscountApproval | null
  ): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (!this.billSignal().lines.some(line => line.productId === productId)) {
      return fail('That item is not on the bill.');
    }
    const decision = decideLineDiscount(percent, this.settingsSignal());
    if (decision.kind === 'REFUSED') return fail(decision.message);
    if (decision.kind === 'NONE_NEEDED') {
      this.resetLineDiscount(productId);
      return ok();
    }
    if (!this.approvalService.redeem(approval, DiscountScope.LINE, productId, percent)) {
      return fail(NEEDS_APPROVAL);
    }
    this.updateLine(productId, line => ({
      ...line,
      discountPercent: percent,
      discountApproval: approval === null ? null : { ...approval },
    }));
    return ok();
  }

  resetLineDiscount(productId: string): void {
    const percent = defaultLineDiscountPercent(this.settingsSignal());
    this.updateLine(productId, line => ({
      ...line,
      discountPercent: percent,
      discountApproval: null,
    }));
  }

  evaluateBillDiscount(mode: 'PERCENT' | 'AMOUNT', text: string): DiscountEvaluation {
    if (!this.canSell()) return { kind: 'REFUSED', message: NOT_ALLOWED };
    const settings = this.settingsSignal();
    const input = this.parseBillDiscount(mode, text);
    const subTotal = this.totals().subTotalCents;
    const decision = decideBillDiscount(input, subTotal, settings);
    if (decision.kind === 'REFUSED') return { kind: 'REFUSED', message: decision.message };
    if (decision.kind === 'NONE_NEEDED' || input === null) {
      this.resetBillDiscount();
      return { kind: 'APPLIED' };
    }
    return {
      kind: 'NEEDS_APPROVAL',
      request: {
        scope: DiscountScope.BILL,
        productId: null,
        percent: billDiscountPercent(subTotal, input),
      },
      billInput: input,
    };
  }

  setBillDiscount(input: BillDiscountInput, approval: DiscountApproval | null): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    const settings = this.settingsSignal();
    const subTotal = this.totals().subTotalCents;
    const decision = decideBillDiscount(input, subTotal, settings);
    if (decision.kind === 'REFUSED') return fail(decision.message);
    if (decision.kind === 'NONE_NEEDED') {
      this.resetBillDiscount();
      return ok();
    }
    const percent = billDiscountPercent(subTotal, input);
    if (!this.approvalService.redeem(approval, DiscountScope.BILL, null, percent)) {
      return fail(NEEDS_APPROVAL);
    }
    this.billSignal.update(bill => ({
      ...bill,
      billDiscount: input,
      billDiscountApproval: approval === null ? null : { ...approval },
    }));
    return ok();
  }

  resetBillDiscount(): void {
    this.billSignal.update(bill => ({
      ...bill,
      billDiscount: defaultBillDiscount(this.settingsSignal()),
      billDiscountApproval: null,
    }));
  }

  setCustomer(customerId: string): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (!this.customersSignal().some(customer => customer.id === customerId)) {
      return fail('Choose a customer from the list.');
    }
    this.billSignal.update(bill => ({ ...bill, customerId }));
    return ok();
  }

  setRep(repId: string | null): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (repId !== null && !this.repsSignal().some(rep => rep.id === repId)) {
      return fail('Choose a rep from the list, or leave it empty.');
    }
    this.billSignal.update(bill => ({ ...bill, repId }));
    return ok();
  }

  setDate(date: string): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (!isIsoDate(date) || date > this.clockService.today()) {
      return fail('Choose today or an earlier date for the bill.');
    }
    this.billSignal.update(bill => ({ ...bill, date }));
    return ok();
  }

  selectPaymentField(field: PaymentFieldKey): void {
    this.activeFieldSignal.set(field);
  }

  setPaymentText(field: PaymentFieldKey, text: string): void {
    if (!this.canSell()) return;
    const value = text.slice(0, AMOUNT_TEXT_MAX_LENGTH);
    this.billSignal.update(bill => ({ ...bill, payments: { ...bill.payments, [field]: value } }));
  }

  setReference(field: 'card' | 'online', text: string): void {
    if (!this.canSell()) return;
    const key = field === 'card' ? 'cardReference' : 'onlineReference';
    const value = text.slice(0, REFERENCE_MAX_LENGTH);
    this.billSignal.update(bill => ({ ...bill, payments: { ...bill.payments, [key]: value } }));
  }

  pressKey(key: string): void {
    if (!this.canSell()) return;
    const field = this.activeFieldSignal();
    const next = applyKeypadKey(this.billSignal().payments[field], key);
    this.setPaymentText(field, next);
  }

  setCredit(selected: boolean): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (selected && this.isWalkIn()) return fail(CREDIT_WALK_IN_MESSAGE);
    this.billSignal.update(bill => ({
      ...bill,
      payments: { ...bill.payments, creditSelected: selected },
    }));
    return ok();
  }

  async saveBill(): Promise<SaveSaleResult> {
    return this.work(async () => {
      const result = await this.saleService.save(this.billSignal());
      if (result.ok) {
        await this.reloadProducts();
        await this.startNewBill();
      }
      return result;
    });
  }

  async holdBill(): Promise<HoldResult> {
    return this.work(async () => {
      const result = await this.saleService.hold(this.billSignal());
      if (result.ok) {
        await this.reloadHeld();
        await this.startNewBill();
      }
      return result;
    });
  }

  async resumeHeldBill(heldId: string): Promise<ResumeResult> {
    return this.work(async () => {
      const current = this.hasUnsavedContent() ? this.billSignal() : null;
      const result = await this.saleService.resume(heldId, current);
      if (result.ok) {
        this.billSignal.set(result.bill);
        this.activeFieldSignal.set('cash');
        await this.reloadHeld();
        await this.reloadProducts();
      }
      return result;
    });
  }

  async discardHeldBill(heldId: string): Promise<DiscardResult> {
    return this.work(async () => {
      const result = await this.saleService.discard(heldId);
      await this.reloadHeld();
      return result;
    });
  }

  private async work<T>(run: () => Promise<T>): Promise<T> {
    this.workingSignal.set(true);
    try {
      return await run();
    } finally {
      this.workingSignal.set(false);
    }
  }

  private parseBillDiscount(mode: 'PERCENT' | 'AMOUNT', text: string): BillDiscountInput | null {
    if (mode === 'PERCENT') {
      const percent = parseDiscountPercent(text);
      return percent === null ? null : { mode: 'PERCENT', percent };
    }
    const cents = parseAmountCents(text);
    return cents === null ? null : { mode: 'AMOUNT', cents };
  }

  private newLine(product: Product): BillLine {
    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode,
      unitPriceCents: product.priceCents,
      discountPercent: defaultLineDiscountPercent(this.settingsSignal()),
      quantity: 1,
      discountApproval: null,
    };
  }

  private updateLine(productId: string, change: (line: BillLine) => BillLine): void {
    this.billSignal.update(bill => ({
      ...bill,
      lines: bill.lines.map(line => (line.productId === productId ? change(line) : line)),
    }));
  }

  private blankBill(invoiceNo: string): Bill {
    return {
      invoiceNo,
      date: this.clockService.today(),
      customerId: this.customersSignal().find(customer => customer.isWalkIn)?.id ?? '',
      repId: null,
      lines: [],
      billDiscount: defaultBillDiscount(this.settingsSignal()),
      billDiscountApproval: null,
      payments: emptyPayments(),
    };
  }

  private releasePristineInvoiceNumber(): void {
    const bill = this.billSignal();
    const untouched =
      this.started &&
      bill.invoiceNo !== '' &&
      bill.lines.length === 0 &&
      !bill.payments.creditSelected &&
      [bill.payments.cash, bill.payments.card, bill.payments.online].every(text => text === '');
    if (untouched) this.salesDataService.releaseInvoiceNumber(bill.invoiceNo).subscribe();
  }

  private async startNewBill(): Promise<void> {
    const invoiceNo = await firstValueFrom(this.salesDataService.nextInvoiceNumber());
    this.billSignal.set(this.blankBill(invoiceNo));
    this.activeFieldSignal.set('cash');
    this.started = true;
  }

  private async loadData(): Promise<void> {
    const [appSettings, customers, reps] = await Promise.all([
      firstValueFrom(this.settingsDataService.get()),
      firstValueFrom(this.salesDataService.getCustomers()),
      firstValueFrom(this.salesDataService.getReps()),
    ]);
    this.settingsSignal.set(toPosSettings(appSettings));
    this.blockExpired = appSettings.blockExpiredSales;
    this.customersSignal.set(customers);
    this.repsSignal.set(reps);
    await Promise.all([this.reloadProducts(), this.reloadHeld()]);
  }

  private async reloadProducts(): Promise<void> {
    this.productsSignal.set(await firstValueFrom(this.productDataService.getAll()));
  }

  private async reloadHeld(): Promise<void> {
    this.heldBillsSignal.set(await firstValueFrom(this.salesDataService.getHeldBills()));
  }
}
