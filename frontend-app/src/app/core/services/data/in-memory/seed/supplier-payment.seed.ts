import { SupplierPayment } from '../../../../models/domain/supplier-payment.model';

export const SUPPLIER_PAYMENT_SEED: readonly SupplierPayment[] = [
  {
    id: 'pay-001',
    supplierId: 'sup-003',
    paidDate: '2026-09-16',
    amountCents: 200_000,
    allocations: [{ grnId: 'grn-003', amountCents: 200_000 }],
    recordedBy: 'Kamal Silva',
  },
  {
    id: 'pay-002',
    supplierId: 'sup-002',
    paidDate: '2026-09-12',
    amountCents: 312_000,
    allocations: [{ grnId: 'grn-002', amountCents: 312_000 }],
    recordedBy: 'Nimal Perera',
  },
];
