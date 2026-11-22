import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CustomerDue } from '../models/domain/customer-due.model';
import { DuePayment } from '../models/domain/due-payment.model';
import { SalePaymentMethod } from '../models/enums/sale-payment-method.enum';
import { nextDocumentNumber, nextRecordId } from '../utils/document-number.util';
import {
  cleanDueReference,
  computeDues,
  isDuePaymentMethod,
  owedCents,
  parseDuePayment,
} from '../utils/pos-due.util';
import { ClockService } from './clock.service';
import { DayLockedError } from './data/day-locked.error';
import { SalesDataService } from './data/sales-data.service';
import { PosCashService } from './pos-cash.service';
import { PosRecordsService } from './pos-records.service';
import { PosFailureResult } from './pos-sale.service';
import { CASH_PAYMENT_LOCKED_MESSAGE, PosWriteGuard, posFailure } from './pos-write-guard.service';

export type TakePaymentResult =
  { ok: true; payment: DuePayment; remainingCents: number } | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to take payments at the till.';

@Injectable({ providedIn: 'root' })
export class PosDueService {
  private readonly clockService = inject(ClockService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly recordsService = inject(PosRecordsService);
  private readonly writeGuard = inject(PosWriteGuard);
  private readonly cashService = inject(PosCashService);

  async list(): Promise<CustomerDue[]> {
    const [customers, records] = await Promise.all([
      firstValueFrom(this.salesDataService.getCustomers()),
      this.recordsService.load(),
    ]);
    return computeDues(customers, records);
  }

  takePayment(
    customerId: string,
    amountText: string,
    method: string,
    reference: string
  ): Promise<TakePaymentResult> {
    return this.writeGuard.run('pos-due', DENIED_MESSAGE, async user => {
      if (!isDuePaymentMethod(method) || method === SalePaymentMethod.CREDIT) {
        return posFailure('invalid', 'Choose Cash, Card or Online.');
      }
      const [customers, records] = await Promise.all([
        firstValueFrom(this.salesDataService.getCustomers()),
        this.recordsService.load(),
      ]);
      const customer = customers.find(candidate => candidate.id === customerId);
      if (customer === undefined || customer.isWalkIn) {
        return posFailure('not-found', 'That customer is not on the list.');
      }
      const owed = owedCents(customer.id, records);
      if (owed <= 0) return posFailure('not-found', `${customer.name} does not owe anything now.`);
      const parsed = parseDuePayment(amountText, owed);
      if (!parsed.ok) return posFailure('invalid', parsed.message);
      if (method === SalePaymentMethod.CASH) {
        const status = await this.cashService.status(this.clockService.today());
        if (status.counterClosed) return posFailure('invalid', CASH_PAYMENT_LOCKED_MESSAGE);
      }
      const payment: DuePayment = {
        id: nextRecordId(
          'dpay',
          records.duePayments.map(existing => existing.id)
        ),
        receiptNo: nextDocumentNumber(
          'RCP',
          records.duePayments.map(existing => existing.receiptNo)
        ),
        customerId: customer.id,
        customerName: customer.name,
        amountCents: parsed.cents,
        method,
        reference: cleanDueReference(method, reference),
        createdAt: this.clockService.now(),
        takenByUserId: user.id,
        takenBy: user.displayName,
      };
      try {
        const saved = await firstValueFrom(this.salesDataService.saveDuePayment(payment));
        return { ok: true as const, payment: saved, remainingCents: owed - parsed.cents };
      } catch (error) {
        if (error instanceof DayLockedError) {
          return posFailure('invalid', CASH_PAYMENT_LOCKED_MESSAGE);
        }
        throw error;
      }
    });
  }
}
