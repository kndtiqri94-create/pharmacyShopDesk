import { Grn } from '../models/domain/grn.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { SupplierPayment } from '../models/domain/supplier-payment.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { BadgeTone } from '../models/shared/badge-tone.model';
import { StatusDisplay } from '../models/shared/status-display.model';
import { derivePaymentStatus } from './grn-totals.util';
import { formatRupees } from './money.util';
import { isPurchaseOrderOverdue } from './purchase-order-overdue.util';
import { PAYMENT_STATUS_DISPLAY, PO_STATUS_DISPLAY } from './status-display.util';

export const RECENT_ACTIVITY_LIMIT = 5;

export interface SupplierActivityItem {
  key: string;
  date: string;
  text: string;
  stateLabel: string;
  tone: BadgeTone;
  rank: number;
}

export interface SupplierActivitySources {
  orders: readonly PurchaseOrder[];
  grns: readonly Grn[];
  payments: readonly SupplierPayment[];
}

const PAYMENT_RANK = 3;
const GRN_RANK = 2;
const ORDER_RANK = 1;

const ORDER_VERBS: Partial<Record<PoStatus, string>> = {
  [PoStatus.SENT]: 'sent',
  [PoStatus.PART_RECEIVED]: 'part received',
  [PoStatus.RECEIVED]: 'received',
  [PoStatus.CANCELLED]: 'cancelled',
};

const OVERDUE_DISPLAY: StatusDisplay = { label: 'Overdue', tone: 'danger' };
const PAID_DISPLAY: StatusDisplay = { label: 'Paid', tone: 'success' };

function orderActivity(orders: readonly PurchaseOrder[], today: string): SupplierActivityItem[] {
  return orders.flatMap(order => {
    const verb = ORDER_VERBS[order.status];
    if (verb === undefined) return [];
    const state = isPurchaseOrderOverdue(order, today)
      ? OVERDUE_DISPLAY
      : PO_STATUS_DISPLAY[order.status];
    return [
      {
        key: order.id,
        date: order.orderDate,
        text: `${order.number} ${verb}`,
        stateLabel: state.label,
        tone: state.tone,
        rank: ORDER_RANK,
      },
    ];
  });
}

function grnActivity(grns: readonly Grn[]): SupplierActivityItem[] {
  return grns
    .filter(grn => grn.status === GrnStatus.RECEIVED)
    .map(grn => {
      const state = PAYMENT_STATUS_DISPLAY[derivePaymentStatus(grn.totalCents, grn.paidCents)];
      return {
        key: grn.id,
        date: grn.receivedDate,
        text: `${grn.number} received`,
        stateLabel: state.label,
        tone: state.tone,
        rank: GRN_RANK,
      };
    });
}

function paymentActivity(payments: readonly SupplierPayment[]): SupplierActivityItem[] {
  return payments.map(payment => ({
    key: payment.id,
    date: payment.paidDate,
    text: `Payment of ${formatRupees(payment.amountCents)}`,
    stateLabel: PAID_DISPLAY.label,
    tone: PAID_DISPLAY.tone,
    rank: PAYMENT_RANK,
  }));
}

function newestFirst(first: SupplierActivityItem, second: SupplierActivityItem): number {
  return (
    second.date.localeCompare(first.date) ||
    second.rank - first.rank ||
    second.key.localeCompare(first.key)
  );
}

export function buildSupplierActivity(
  supplierId: string,
  sources: SupplierActivitySources,
  today: string
): SupplierActivityItem[] {
  const ofSupplier = <T extends { supplierId: string }>(items: readonly T[]) =>
    items.filter(item => item.supplierId === supplierId);
  const events = [
    ...orderActivity(ofSupplier(sources.orders), today),
    ...grnActivity(ofSupplier(sources.grns)),
    ...paymentActivity(ofSupplier(sources.payments)),
  ];
  events.sort(newestFirst);
  return events.slice(0, RECENT_ACTIVITY_LIMIT);
}
