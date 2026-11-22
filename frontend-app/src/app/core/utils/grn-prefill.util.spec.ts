import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { emptyGrnInput, grnToInput, linesFromOrder, orderedQuantities } from './grn-prefill.util';

describe('grn-prefill.util', () => {
  it('starts empty with today as the received date and credit as the method', () => {
    const input = emptyGrnInput('2026-09-21');
    expect(input.receivedDate).toBe('2026-09-21');
    expect(input.paymentMethod).toBe('CREDIT');
    expect(input.lines).toEqual([]);
    expect(input.supplierId).toBe('');
  });

  it('fills one line per ordered product with its quantity and unit cost', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-004')!;
    const lines = linesFromOrder(order, PRODUCT_SEED);
    expect(lines.map(line => line.productId)).toEqual(['prod-002', 'prod-006']);
    expect(lines[0]).toEqual({
      productId: 'prod-002',
      batchNo: '',
      expiry: '',
      received: '200',
      free: '0',
      cost: '12.50',
      price: '18.00',
    });
  });

  it('fills only what is still outstanding on a part received PO', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-003')!;
    const lines = linesFromOrder(order, PRODUCT_SEED);
    expect(lines.find(line => line.productId === 'prod-001')?.received).toBe('1000');
    expect(lines.find(line => line.productId === 'prod-005')?.received).toBe('500');
  });

  it('skips lines for products that no longer exist', () => {
    const order = {
      ...PURCHASE_ORDER_SEED[3],
      lines: [{ productId: 'prod-999', orderedQuantity: 5, receivedQuantity: 0, unitCostCents: 1 }],
    };
    expect(linesFromOrder(order, PRODUCT_SEED)).toEqual([]);
  });

  it('remembers the quantity ordered for each product', () => {
    const order = PURCHASE_ORDER_SEED.find(item => item.id === 'po-003');
    expect(orderedQuantities(order).get('prod-001')).toBe(2000);
    expect(orderedQuantities(undefined).size).toBe(0);
  });

  it('turns a saved GRN back into form entries', () => {
    const input = grnToInput(GRN_SEED[0], PURCHASE_ORDER_SEED);
    expect(input.supplierId).toBe('sup-001');
    expect(input.purchaseOrderId).toBe('');
    expect(input.lines[0].expiry).toBe('01/2028');
    expect(input.lines[0].cost).toBe('1.80');
    expect(input.lines[0].free).toBe('100');
    expect(input.paidNow).toBe('');
    const linked = grnToInput(GRN_SEED[4], PURCHASE_ORDER_SEED);
    expect(linked.purchaseOrderId).toBe('po-004');
    expect(linked.dueDate).toBe('2026-10-21');
  });
});
