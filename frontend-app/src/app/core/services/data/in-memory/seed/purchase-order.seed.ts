import { PurchaseOrder } from '../../../../models/domain/purchase-order.model';
import { PoStatus } from '../../../../models/enums/po-status.enum';

export const PURCHASE_ORDER_SEED: readonly PurchaseOrder[] = [
  {
    id: 'po-001',
    number: 'PO-0145',
    orderDate: '2026-09-01',
    expectedDate: '2026-09-10',
    supplierId: 'sup-002',
    status: PoStatus.RECEIVED,
    notes: '',
    totalCents: 312_000,
    lines: [
      { productId: 'prod-004', orderedQuantity: 600, receivedQuantity: 600, unitCostCents: 520 },
    ],
  },
  {
    id: 'po-002',
    number: 'PO-0146',
    orderDate: '2026-08-30',
    expectedDate: '2026-09-06',
    supplierId: 'sup-004',
    status: PoStatus.CANCELLED,
    notes: 'Cancelled, supplier could not deliver in time.',
    totalCents: 1_120_000,
    lines: [
      { productId: 'prod-009', orderedQuantity: 40, receivedQuantity: 0, unitCostCents: 28000 },
    ],
  },
  {
    id: 'po-003',
    number: 'PO-0147',
    orderDate: '2026-09-12',
    expectedDate: '2026-09-28',
    supplierId: 'sup-002',
    status: PoStatus.PART_RECEIVED,
    notes: '',
    totalCents: 535_000,
    lines: [
      { productId: 'prod-001', orderedQuantity: 2000, receivedQuantity: 1000, unitCostCents: 180 },
      { productId: 'prod-005', orderedQuantity: 500, receivedQuantity: 0, unitCostCents: 350 },
    ],
  },
  {
    id: 'po-004',
    number: 'PO-0148',
    orderDate: '2026-09-10',
    expectedDate: '2026-09-20',
    supplierId: 'sup-001',
    status: PoStatus.SENT,
    notes: 'Please deliver before noon.',
    totalCents: 700_000,
    lines: [
      { productId: 'prod-002', orderedQuantity: 200, receivedQuantity: 0, unitCostCents: 1250 },
      { productId: 'prod-006', orderedQuantity: 100, receivedQuantity: 0, unitCostCents: 4500 },
    ],
  },
  {
    id: 'po-005',
    number: 'PO-0149',
    orderDate: '2026-09-21',
    expectedDate: '2026-09-30',
    supplierId: 'sup-003',
    status: PoStatus.DRAFT,
    notes: '',
    totalCents: 380_000,
    lines: [
      { productId: 'prod-007', orderedQuantity: 10, receivedQuantity: 0, unitCostCents: 38000 },
    ],
  },
];
