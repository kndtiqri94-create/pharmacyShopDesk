import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { SUPPLIER_SEED } from '../services/data/in-memory/seed/supplier.seed';
import {
  PurchaseOrderFormInput,
  PurchaseOrderValidationContext,
  purchaseOrderLineKey,
  validatePurchaseOrder,
} from './purchase-order-validation.util';

const strict: PurchaseOrderValidationContext = {
  products: PRODUCT_SEED,
  suppliers: SUPPLIER_SEED,
  strict: true,
};

const valid: PurchaseOrderFormInput = {
  supplierId: 'sup-002',
  orderDate: '2026-09-21',
  expectedDate: '2026-09-30',
  notes: ' Deliver in the morning ',
  delivery: '50',
  lines: [{ productId: 'prod-001', quantity: '100', unitCost: '1.80' }],
};

describe('purchase-order-validation.util', () => {
  it('accepts a complete order and works out the total with delivery', () => {
    const result = validatePurchaseOrder(valid, strict);
    expect(result.errors).toEqual({});
    expect(result.values?.totalCents).toBe(18_000 + 5_000);
    expect(result.values?.deliveryCents).toBe(5_000);
    expect(result.values?.notes).toBe('Deliver in the morning');
    expect(result.values?.lines[0].receivedQuantity).toBe(0);
  });

  it('lets a valid order be sent without an expected delivery date', () => {
    const result = validatePurchaseOrder({ ...valid, expectedDate: '' }, strict);
    expect(result.errors).toEqual({});
    expect(result.values?.expectedDate).toBe('');
  });

  it('asks for a supplier and at least one line before sending', () => {
    const result = validatePurchaseOrder(
      { ...valid, supplierId: '', expectedDate: '', lines: [] },
      strict
    );
    expect(result.values).toBeNull();
    expect(result.errors['supplierId']).toBe('Choose the supplier');
    expect(result.errors['lines']).toBe('Add an item to order first');
    expect(result.errors['expectedDate']).toBeUndefined();
    expect(result.firstErrorField).toBe('supplierId');
  });

  it('rejects a quantity that is not above 0 and a bad unit cost', () => {
    const result = validatePurchaseOrder(
      { ...valid, lines: [{ productId: 'prod-001', quantity: '0', unitCost: '-3' }] },
      strict
    );
    expect(result.errors[purchaseOrderLineKey(0, 'quantity')]).toBe(
      'Enter an order quantity above 0'
    );
    expect(result.errors[purchaseOrderLineKey(0, 'unitCost')]).toBeDefined();
    const text = validatePurchaseOrder(
      { ...valid, lines: [{ productId: 'prod-001', quantity: 'ten', unitCost: 'abc' }] },
      strict
    );
    expect(text.values).toBeNull();
  });

  it('rejects a bad delivery charge, oversized notes and a date before the order date', () => {
    expect(
      validatePurchaseOrder({ ...valid, delivery: '-1' }, strict).errors['delivery']
    ).toBeDefined();
    expect(
      validatePurchaseOrder({ ...valid, notes: 'x'.repeat(301) }, strict).errors['notes']
    ).toBeDefined();
    expect(
      validatePurchaseOrder({ ...valid, expectedDate: '2026-09-01' }, strict).errors['expectedDate']
    ).toContain('before the order date');
  });

  it('rejects an unknown supplier or product and too many lines', () => {
    expect(
      validatePurchaseOrder({ ...valid, supplierId: 'x' }, strict).errors['supplierId']
    ).toBeDefined();
    const unknown = { ...valid, lines: [{ productId: 'prod-999', quantity: '1', unitCost: '1' }] };
    expect(validatePurchaseOrder(unknown, strict).errors['lines']).toContain('no longer');
    const many = Array.from({ length: 201 }, () => valid.lines[0]);
    expect(validatePurchaseOrder({ ...valid, lines: many }, strict).errors['lines']).toContain(
      'up to 200'
    );
  });

  it('lets a draft be saved without lines, supplier or expected date', () => {
    const draft = { ...strict, strict: false };
    const result = validatePurchaseOrder(
      { ...valid, supplierId: '', expectedDate: '', delivery: '', lines: [] },
      draft
    );
    expect(result.errors).toEqual({});
    expect(result.values?.lines).toEqual([]);
    expect(result.values?.expectedDate).toBe('');
  });

  it('still rejects malformed figures in a draft', () => {
    const draft = { ...strict, strict: false };
    const result = validatePurchaseOrder(
      { ...valid, lines: [{ productId: 'prod-001', quantity: '1.5', unitCost: '' }] },
      draft
    );
    expect(result.errors[purchaseOrderLineKey(0, 'quantity')]).toBeDefined();
  });
});
