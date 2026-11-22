import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PosCustomer } from '../models/domain/pos-customer.model';
import { SaleReturn } from '../models/domain/sale-return.model';
import { Sale } from '../models/domain/sale.model';
import { ReturnSettlement } from '../models/enums/return-settlement.enum';
import {
  buildReturnableLines,
  buildSaleReturn,
  normaliseLookup,
  selectReturn,
  settlementOptions,
} from '../utils/pos-return.util';
import { ClockService } from './clock.service';
import { DayLockedError } from './data/day-locked.error';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { SettingsDataService } from './data/settings-data.service';
import { PosFailureResult } from './pos-sale.service';
import { PosCashService } from './pos-cash.service';
import { CASH_REFUND_LOCKED_MESSAGE, PosWriteGuard, posFailure } from './pos-write-guard.service';

export type ReturnLookupResult = { ok: true } | { ok: false; message: string };
export type CompleteReturnResult = { ok: true; saleReturn: SaleReturn } | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to take returns at the till.';
const QUANTITY_TEXT_MAX_LENGTH = 5;

@Injectable({ providedIn: 'root' })
export class PosReturnService {
  private readonly clockService = inject(ClockService);
  private readonly productDataService = inject(ProductDataService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly settingsDataService = inject(SettingsDataService);
  private readonly writeGuard = inject(PosWriteGuard);
  private readonly cashService = inject(PosCashService);

  private readonly saleSignal = signal<Sale | null>(null);
  private readonly returnsSignal = signal<readonly SaleReturn[]>([]);
  private readonly customersSignal = signal<readonly PosCustomer[]>([]);
  private readonly viewedSignal = signal<SaleReturn | null>(null);
  private readonly quantitiesSignal = signal<Readonly<Record<string, string>>>({});
  private readonly settlementSignal = signal<ReturnSettlement>(ReturnSettlement.CASH_REFUND);

  readonly sale = this.saleSignal.asReadonly();
  readonly viewedReturn = this.viewedSignal.asReadonly();
  readonly quantities = this.quantitiesSignal.asReadonly();
  readonly settlement = this.settlementSignal.asReadonly();
  readonly lines = computed(() => {
    const sale = this.saleSignal();
    return sale === null ? [] : buildReturnableLines(sale, this.returnsSignal());
  });
  readonly selection = computed(() => selectReturn(this.lines(), this.quantitiesSignal()));
  readonly isWalkIn = computed(() => {
    const customerId = this.saleSignal()?.customerId;
    return this.customersSignal().find(customer => customer.id === customerId)?.isWalkIn ?? true;
  });
  readonly options = computed(() => settlementOptions(this.isWalkIn()));
  readonly inProgress = computed(
    () => this.saleSignal() !== null && Object.values(this.quantitiesSignal()).some(Boolean)
  );

  async findInvoice(text: string): Promise<ReturnLookupResult> {
    const term = normaliseLookup(text);
    if (term.length === 0) return { ok: false, message: 'Enter an invoice number to look up.' };
    const [sales, returns, customers] = await Promise.all([
      firstValueFrom(this.salesDataService.getSales()),
      firstValueFrom(this.salesDataService.getReturns()),
      firstValueFrom(this.salesDataService.getCustomers()),
    ]);
    this.reset();
    const sale = sales.find(candidate => candidate.invoiceNo.toUpperCase() === term);
    if (sale === undefined) return { ok: false, message: `No sale found for ${term}.` };
    this.saleSignal.set(sale);
    this.returnsSignal.set(returns.filter(candidate => candidate.originalSaleId === sale.id));
    this.customersSignal.set(customers);
    return { ok: true };
  }

  async findReturn(text: string): Promise<ReturnLookupResult> {
    const term = normaliseLookup(text);
    if (term.length === 0) return { ok: false, message: 'Enter a return number to look up.' };
    const returns = await firstValueFrom(this.salesDataService.getReturns());
    this.reset();
    const found = returns.find(candidate => candidate.returnNo.toUpperCase() === term);
    if (found === undefined) return { ok: false, message: `No return found for ${term}.` };
    this.viewedSignal.set(found);
    return { ok: true };
  }

  setQuantity(productId: string, text: string): void {
    const value = text.slice(0, QUANTITY_TEXT_MAX_LENGTH);
    this.quantitiesSignal.update(current => ({ ...current, [productId]: value }));
  }

  setSettlement(settlement: ReturnSettlement): void {
    if (this.options().includes(settlement)) this.settlementSignal.set(settlement);
  }

  reset(): void {
    this.saleSignal.set(null);
    this.returnsSignal.set([]);
    this.viewedSignal.set(null);
    this.quantitiesSignal.set({});
    this.settlementSignal.set(ReturnSettlement.CASH_REFUND);
  }

  complete(): Promise<CompleteReturnResult> {
    return this.writeGuard.run('pos-stock', DENIED_MESSAGE, async user => {
      const sale = this.saleSignal();
      if (sale === null) return posFailure('invalid', 'Look up the invoice first.');
      const quantities = { ...this.quantitiesSignal() };
      const settlement = this.settlementSignal();
      const [appSettings, customers, sales, returns, products] = await Promise.all([
        firstValueFrom(this.settingsDataService.get()),
        firstValueFrom(this.salesDataService.getCustomers()),
        firstValueFrom(this.salesDataService.getSales()),
        firstValueFrom(this.salesDataService.getReturns()),
        firstValueFrom(this.productDataService.getAll()),
      ]);
      const fresh = sales.find(candidate => candidate.id === sale.id);
      if (fresh === undefined) return posFailure('not-found', 'That sale is no longer there.');
      const built = buildSaleReturn({
        sale: fresh,
        allReturns: returns,
        products,
        customers,
        quantities,
        settlement,
        blockExpired: appSettings.blockExpiredSales,
        today: this.clockService.today(),
        now: this.clockService.now(),
        processedBy: { id: user.id, name: user.displayName },
      });
      if (!built.ok) return posFailure(built.reason, built.message);
      if (settlement === ReturnSettlement.CASH_REFUND) {
        const status = await this.cashService.status(this.clockService.today());
        if (status.counterClosed) return posFailure('invalid', CASH_REFUND_LOCKED_MESSAGE);
      }
      await firstValueFrom(this.productDataService.saveAll(built.products));
      let saleReturn: SaleReturn;
      try {
        saleReturn = await firstValueFrom(this.salesDataService.saveReturn(built.saleReturn));
      } catch (error) {
        await firstValueFrom(this.productDataService.saveAll(products));
        if (error instanceof DayLockedError)
          return posFailure('invalid', CASH_REFUND_LOCKED_MESSAGE);
        throw error;
      }
      this.reset();
      return { ok: true as const, saleReturn };
    });
  }
}
