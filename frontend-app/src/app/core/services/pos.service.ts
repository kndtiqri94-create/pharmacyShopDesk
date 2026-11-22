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
import { ALL_BILL_TYPES, BillType } from '../models/enums/bill-type.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { QuotationStatus } from '../models/enums/quotation-status.enum';
import {
  CARD_LAST4_LENGTH,
  CARD_LAST4_MESSAGE,
  ONLINE_NOTE_MAX_LENGTH,
  isValidCardLast4,
  onlyDigits,
} from '../utils/bank-account-validation.util';
import { isIsoDate } from '../utils/date.util';
import {
  decideBillDiscount,
  decideLineDiscount,
  defaultBillDiscount,
  defaultLineDiscountPercent,
  findDiscountProblem,
  parseDiscountPercent,
} from '../utils/pos-discount.util';
import { emptyPaymentEntries } from '../utils/pos-payment-entries.util';
import { POS_SETTINGS_DEFAULTS, toPosSettings } from '../utils/pos-settings.util';
import { recheckBillLines } from '../utils/pos-product-update.util';
import { prepareQuotationForInvoice } from '../utils/pos-quotation.util';
import { SellableStock, getSellableStock } from '../utils/pos-stock-allocation.util';
import { PaymentAmounts, billDiscountPercent, computeBillTotals } from '../utils/pos-totals.util';
import {
  AMOUNT_TEXT_MAX_LENGTH,
  CREDIT_WALK_IN_MESSAGE,
  ONLINE_ACCOUNT_MESSAGE,
  PaymentFieldKey,
  PaymentMethodKey,
  checkProductAddable,
  checkQuantityAgainstStock,
  invalidQuantityMessage,
  parseAmountCents,
  parseLineQuantity,
  parsePaymentEntries,
} from '../utils/pos-validation.util';
import { AuthService } from './auth/auth.service';
import { BankAccountService } from './bank-account.service';
import { ClockService } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { SettingsDataService } from './data/settings-data.service';
import { PermissionService } from './permission.service';
import { PosCashService } from './pos-cash.service';
import { DiscountChangeRequest, PosDiscountApprovalService } from './pos-discount-approval.service';
import { PosQuotationService, SaveQuotationResult } from './pos-quotation.service';
import { PosReturnService } from './pos-return.service';
import {
  DiscardResult,
  HoldResult,
  PosFailureResult,
  PosSaleService,
  QuotationLink,
  ResumeResult,
  SaveSaleResult,
} from './pos-sale.service';

export interface PaymentProblems {
  cardLast4: string | null;
  onlineAccount: string | null;
}

export type PosActionResult = { ok: true } | { ok: false; message: string };

export type DiscountEvaluation =
  | { kind: 'APPLIED' }
  | { kind: 'NEEDS_APPROVAL'; request: DiscountChangeRequest; billInput: BillDiscountInput | null }
  | { kind: 'REFUSED'; message: string };

export type ConvertQuotationResult =
  { ok: true; notes: string[]; autoHeld: HeldBill | null } | PosFailureResult;

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

function failureResult(
  message: string,
  reason: PosFailureResult['reason'] = 'invalid'
): PosFailureResult {
  return { ok: false, reason, message };
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
  private readonly returnService = inject(PosReturnService);
  private readonly quotationService = inject(PosQuotationService);
  private readonly cashService = inject(PosCashService);
  private readonly bankAccountService = inject(BankAccountService);

  private readonly settingsSignal = signal<PosSettings>(POS_SETTINGS_DEFAULTS);
  private readonly productsSignal = signal<readonly Product[]>([]);
  private readonly customersSignal = signal<readonly PosCustomer[]>([]);
  private readonly billSignal = signal<Bill>(this.blankBill(''));
  private readonly repsSignal = signal<readonly SalesRep[]>([]);
  private readonly heldBillsSignal = signal<readonly HeldBill[]>([]);
  private readonly activeMethodSignal = signal<PaymentMethodKey>('cash');
  private readonly showProblemsSignal = signal(false);
  private readonly workingSignal = signal(false);
  private readonly readySignal = signal(false);
  private readonly billTypeSignal = signal<BillType>(BillType.INVOICE);
  private readonly conversionSignal = signal<QuotationLink | null>(null);
  private blockExpired = true;
  private started = false;

  readonly bill = this.billSignal.asReadonly();
  readonly settings = this.settingsSignal.asReadonly();
  readonly products = this.productsSignal.asReadonly();
  readonly customers = this.customersSignal.asReadonly();
  readonly reps = this.repsSignal.asReadonly();
  readonly heldBills = this.heldBillsSignal.asReadonly();
  readonly activePaymentMethod = this.activeMethodSignal.asReadonly();
  readonly showPaymentProblems = this.showProblemsSignal.asReadonly();
  readonly working = this.workingSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly billType = this.billTypeSignal.asReadonly();
  readonly converting = this.conversionSignal.asReadonly();

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
  readonly paymentProblems = computed<PaymentProblems>(() => {
    const payments = this.billSignal().payments;
    const onlineCents = this.parsedPayments().amounts?.onlineCents ?? 0;
    return {
      cardLast4: isValidCardLast4(payments.cardLast4) ? null : CARD_LAST4_MESSAGE,
      onlineAccount:
        onlineCents > 0 && this.bankAccountService.findById(payments.onlineAccountId) === null
          ? ONLINE_ACCOUNT_MESSAGE
          : null,
    };
  });
  readonly hasBillLines = computed(() => this.billSignal().lines.length > 0);
  readonly hasUnsavedContent = computed(
    () => this.hasBillLines() || this.returnService.inProgress()
  );
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
    this.activeMethodSignal.set('cash');
    this.billTypeSignal.set(BillType.INVOICE);
    this.conversionSignal.set(null);
    this.returnService.reset();
  }

  setBillType(type: BillType): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (!ALL_BILL_TYPES.includes(type)) return fail('Choose Invoice or Return.');
    if (type === BillType.INVOICE) this.returnService.reset();
    this.billTypeSignal.set(type);
    return ok();
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
    if (this.activeMethodSignal() === 'credit') this.syncCreditMode();
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

  selectPaymentMethod(method: PaymentMethodKey): void {
    this.activeMethodSignal.set(method);
    this.syncCreditMode();
  }

  setPaymentText(field: PaymentFieldKey, text: string): void {
    if (!this.canSell()) return;
    const value = text.slice(0, AMOUNT_TEXT_MAX_LENGTH);
    this.updatePayments({ [field]: value });
  }

  clearPaymentText(field: PaymentFieldKey): void {
    if (!this.canSell()) return;
    this.updatePayments({ [field]: '' });
  }

  setCardLast4(text: string): void {
    if (!this.canSell()) return;
    this.updatePayments({ cardLast4: onlyDigits(text, CARD_LAST4_LENGTH) });
  }

  setOnlineNote(text: string): void {
    if (!this.canSell()) return;
    this.updatePayments({ onlineNote: text.slice(0, ONLINE_NOTE_MAX_LENGTH) });
  }

  setOnlineAccount(accountId: string | null): void {
    if (!this.canSell()) return;
    const known = accountId !== null && this.bankAccountService.findById(accountId) !== null;
    this.updatePayments({ onlineAccountId: known ? accountId : null });
  }

  setCredit(selected: boolean): PosActionResult {
    if (!this.canSell()) return fail(NOT_ALLOWED);
    if (selected && this.isWalkIn()) return fail(CREDIT_WALK_IN_MESSAGE);
    this.updatePayments({ creditSelected: selected });
    return ok();
  }

  async saveBill(): Promise<SaveSaleResult> {
    return this.work(async () => {
      const result = await this.saleService.save(this.billSignal(), this.conversionSignal());
      if (result.ok) {
        await this.reloadProducts();
        await this.startNewBill();
      } else {
        this.showProblemsSignal.set(true);
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
      const current = this.hasBillLines() ? this.billSignal() : null;
      const result = await this.saleService.resume(heldId, current);
      if (result.ok) {
        this.billSignal.set(result.bill);
        this.activeMethodSignal.set('cash');
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

  async saveQuotation(): Promise<SaveQuotationResult> {
    if (this.billTypeSignal() === BillType.RETURN) {
      return failureResult('Quotations are for invoices. Switch the bill type to Invoice first.');
    }
    return this.work(async () => {
      const bill = this.billSignal();
      const result = await this.quotationService.save(bill);
      if (result.ok) {
        await firstValueFrom(this.salesDataService.releaseInvoiceNumber(bill.invoiceNo));
        await this.startNewBill();
      }
      return result;
    });
  }

  async convertQuotation(quotationId: string): Promise<ConvertQuotationResult> {
    if (!this.canSell()) return failureResult(NOT_ALLOWED);
    return this.work(async () => {
      const quotation = await this.quotationService.find(quotationId);
      if (quotation === null) {
        return failureResult('That quotation is no longer there.', 'not-found');
      }
      if (quotation.status !== QuotationStatus.OPEN) {
        return failureResult('That quotation was already converted to an invoice.');
      }
      let autoHeld: HeldBill | null = null;
      if (this.hasBillLines()) {
        const held = await this.saleService.hold(this.billSignal());
        if (!held.ok) return held;
        autoHeld = held.held;
      }
      const reusable =
        autoHeld === null && !this.hasBillLines() && this.billSignal().invoiceNo !== '';
      const invoiceNo = reusable
        ? this.billSignal().invoiceNo
        : await firstValueFrom(this.salesDataService.nextInvoiceNumber());
      await this.loadData();
      const prepared = prepareQuotationForInvoice(quotation.bill, {
        products: this.productsSignal(),
        customers: this.customersSignal(),
        reps: this.repsSignal(),
        settings: this.settingsSignal(),
        today: this.clockService.today(),
        blockExpired: this.blockExpired,
        invoiceNo,
      });
      this.returnService.reset();
      this.billTypeSignal.set(BillType.INVOICE);
      this.billSignal.set(prepared.bill);
      this.activeMethodSignal.set('cash');
      this.conversionSignal.set({ id: quotation.id, quotationNo: quotation.quotationNo });
      return { ok: true as const, notes: prepared.notes, autoHeld };
    });
  }

  refreshProducts(): Promise<void> {
    return this.reloadProducts();
  }

  async recheckBillAfterProductChange(): Promise<string[]> {
    await this.reloadProducts();
    const bill = this.billSignal();
    if (bill.lines.length === 0) return [];
    const result = recheckBillLines(
      bill.lines,
      this.productsSignal(),
      this.clockService.today(),
      this.blockExpired
    );
    this.billSignal.set({ ...bill, lines: result.lines });
    return result.notes;
  }

  async saveWarnings(): Promise<string[]> {
    const status = await this.cashService.status(this.clockService.today());
    const messages: string[] = [];
    if (status.counterClosed) {
      messages.push(
        "Today's counter is already closed. This sale will not be part of the locked counter report."
      );
    }
    const cashCents = this.parsedPayments().amounts?.cashCents ?? 0;
    if (status.drawerEnded && cashCents > 0) {
      messages.push(
        "The drawer has been ended for today. This cash sale will be added to the day's entries."
      );
    }
    return messages;
  }

  private updatePayments(change: Partial<PaymentEntries>): void {
    this.billSignal.update(bill => ({ ...bill, payments: { ...bill.payments, ...change } }));
  }

  private syncCreditMode(): void {
    if (!this.canSell()) return;
    const wanted = this.activeMethodSignal() === 'credit' && !this.isWalkIn();
    if (this.billSignal().payments.creditSelected !== wanted) this.setCredit(wanted);
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
      payments: emptyPaymentEntries(),
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
    this.showProblemsSignal.set(false);
    this.activeMethodSignal.set('cash');
    this.conversionSignal.set(null);
    this.returnService.reset();
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
    await Promise.all([this.reloadProducts(), this.reloadHeld(), this.bankAccountService.load()]);
  }

  private async reloadProducts(): Promise<void> {
    this.productsSignal.set(await firstValueFrom(this.productDataService.getAll()));
  }

  private async reloadHeld(): Promise<void> {
    this.heldBillsSignal.set(await firstValueFrom(this.salesDataService.getHeldBills()));
  }
}
