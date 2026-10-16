import { Grn } from '../models/domain/grn.model';
import { Product } from '../models/domain/product.model';
import { PurchaseOrder } from '../models/domain/purchase-order.model';
import { PaymentMethod } from '../models/enums/payment-method.enum';
import { formatExpiryInput } from './date.util';
import { GrnFormInput, GrnLineInput } from './grn-validation.util';
import { formatRupeesInput } from './money.util';

export function emptyGrnInput(today: string): GrnFormInput {
  return {
    supplierId: '',
    purchaseOrderId: '',
    receivedDate: today,
    invoiceNo: '',
    invoiceDate: '',
    paymentMethod: PaymentMethod.CREDIT,
    paidNow: '',
    dueDate: '',
    discount: '',
    lines: [],
  };
}

export function linesFromOrder(order: PurchaseOrder, products: readonly Product[]): GrnLineInput[] {
  return order.lines.flatMap(line => {
    const product = products.find(candidate => candidate.id === line.productId);
    const outstanding = line.orderedQuantity - line.receivedQuantity;
    if (!product || outstanding <= 0) return [];
    return [
      {
        productId: line.productId,
        batchNo: '',
        expiry: '',
        received: String(outstanding),
        free: '0',
        cost: formatRupeesInput(line.unitCostCents),
        price: formatRupeesInput(product.priceCents),
      },
    ];
  });
}

export function orderedQuantities(order: PurchaseOrder | undefined): Map<string, number> {
  return new Map((order?.lines ?? []).map(line => [line.productId, line.orderedQuantity]));
}

function moneyText(cents: number): string {
  return cents > 0 ? formatRupeesInput(cents) : '';
}

export function grnToInput(grn: Grn, orders: readonly PurchaseOrder[]): GrnFormInput {
  return {
    supplierId: grn.supplierId,
    purchaseOrderId: orders.find(order => order.number === grn.purchaseOrderNumber)?.id ?? '',
    receivedDate: grn.receivedDate,
    invoiceNo: grn.invoiceNo,
    invoiceDate: grn.invoiceDate,
    paymentMethod: grn.paymentMethod,
    paidNow: moneyText(grn.paidCents),
    dueDate: grn.dueDate ?? '',
    discount: moneyText(grn.discountCents),
    lines: grn.lines.map(line => ({
      productId: line.productId,
      batchNo: line.batchNo,
      expiry: line.expiryDate === null ? '' : formatExpiryInput(line.expiryDate),
      received: String(line.receivedQuantity),
      free: String(line.freeQuantity),
      cost: formatRupeesInput(line.costCents),
      price: formatRupeesInput(line.priceCents),
    })),
  };
}
