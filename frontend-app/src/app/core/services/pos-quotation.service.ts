import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Bill } from '../models/domain/bill.model';
import { Quotation } from '../models/domain/quotation.model';
import { QuotationStatus } from '../models/enums/quotation-status.enum';
import { cloneValue } from '../utils/clone.util';
import { nextDocumentNumber, nextRecordId } from '../utils/document-number.util';
import {
  MAX_QUOTATIONS,
  QUOTATION_NOT_FOUND,
  quotationTotalCents,
  snapshotQuotationBill,
} from '../utils/pos-quotation.util';
import { MAX_BILL_LINES, validateHold } from '../utils/pos-validation.util';
import { ClockService } from './clock.service';
import { SalesDataService } from './data/sales-data.service';
import { PosFailureResult } from './pos-sale.service';
import { PosWriteGuard, posFailure } from './pos-write-guard.service';

export type SaveQuotationResult = { ok: true; quotation: Quotation } | PosFailureResult;
export type RemoveQuotationResult = { ok: true } | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to save quotations at the till.';
const TOO_MANY = 'Too many quotations are saved. Delete one first.';

@Injectable({ providedIn: 'root' })
export class PosQuotationService {
  private readonly clockService = inject(ClockService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly writeGuard = inject(PosWriteGuard);

  async list(): Promise<Quotation[]> {
    const all = await firstValueFrom(this.salesDataService.getQuotations());
    return [...all].sort(
      (first, second) =>
        second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id)
    );
  }

  async find(id: string): Promise<Quotation | null> {
    const all = await firstValueFrom(this.salesDataService.getQuotations());
    return all.find(candidate => candidate.id === id) ?? null;
  }

  save(bill: Bill): Promise<SaveQuotationResult> {
    return this.writeGuard.run('pos-quote', DENIED_MESSAGE, async user => {
      const empty = validateHold(bill.lines.length);
      if (empty !== null) return posFailure('invalid', empty.message);
      if (bill.lines.length > MAX_BILL_LINES) {
        return posFailure('invalid', 'The bill has too many items.');
      }
      const [quotations, customers] = await Promise.all([
        firstValueFrom(this.salesDataService.getQuotations()),
        firstValueFrom(this.salesDataService.getCustomers()),
      ]);
      if (quotations.length >= MAX_QUOTATIONS) return posFailure('invalid', TOO_MANY);
      const customer = customers.find(candidate => candidate.id === bill.customerId);
      if (customer === undefined) return posFailure('invalid', 'Choose a customer from the list.');
      const snapshot = snapshotQuotationBill(cloneValue(bill));
      const now = this.clockService.now();
      const quotation: Quotation = {
        id: nextRecordId(
          'quo',
          quotations.map(existing => existing.id)
        ),
        quotationNo: nextDocumentNumber(
          'QUO',
          quotations.map(existing => existing.quotationNo)
        ),
        status: QuotationStatus.OPEN,
        bill: snapshot,
        customerId: customer.id,
        customerName: customer.name,
        itemCount: snapshot.lines.length,
        totalCents: quotationTotalCents(snapshot),
        date: this.clockService.today(),
        createdAt: now,
        createdByUserId: user.id,
        createdByName: user.displayName,
        convertedInvoiceNo: null,
      };
      const saved = await firstValueFrom(this.salesDataService.saveQuotation(quotation));
      return { ok: true as const, quotation: saved };
    });
  }

  remove(id: string): Promise<RemoveQuotationResult> {
    return this.writeGuard.run('pos-quote', DENIED_MESSAGE, async () => {
      const current = await this.find(id);
      if (current === null) return posFailure('not-found', QUOTATION_NOT_FOUND);
      if (current.status !== QuotationStatus.OPEN) {
        return posFailure('invalid', 'A converted quotation is kept as a record.');
      }
      await firstValueFrom(this.salesDataService.removeQuotation(id));
      return { ok: true as const };
    });
  }
}
