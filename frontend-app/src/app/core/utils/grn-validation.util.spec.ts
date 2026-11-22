import { PaymentStatus } from '../models/enums/payment-status.enum';
import { PRODUCT_SEED } from '../services/data/in-memory/seed/product.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_SEED } from '../services/data/in-memory/seed/supplier.seed';
import {
  GrnFormInput,
  GrnLineInput,
  GrnValidationContext,
  grnLineKey,
  validateGrn,
} from './grn-validation.util';

const context: GrnValidationContext = {
  products: PRODUCT_SEED,
  suppliers: SUPPLIER_SEED,
  orders: PURCHASE_ORDER_SEED,
  strict: true,
};

const line: GrnLineInput = {
  productId: 'prod-001',
  batchNo: 'B2601',
  expiry: '03/2028',
  received: '100',
  free: '10',
  cost: '1.80',
  price: '2.50',
};

const valid: GrnFormInput = {
  supplierId: 'sup-001',
  purchaseOrderId: '',
  receivedDate: '2026-09-21',
  invoiceNo: 'INV-1',
  invoiceDate: '2026-09-20',
  paymentMethod: 'CREDIT',
  paidNow: '',
  dueDate: '',
  discount: '',
  lines: [line],
};

describe('grn-validation.util', () => {
  it('accepts a complete GRN and derives total and payment status', () => {
    const result = validateGrn({ ...valid, paidNow: '50' }, context);
    expect(result.errors).toEqual({});
    expect(result.values?.totalCents).toBe(18_000);
    expect(result.values?.paidCents).toBe(5_000);
    expect(result.values?.paymentStatus).toBe(PaymentStatus.PART_PAID);
    expect(result.values?.purchaseOrderNumber).toBeNull();
    expect(result.values?.lines[0].expiryDate).toBe('2028-03-31');
  });

  it('asks for the supplier and the invoice number and focuses the first problem', () => {
    const result = validateGrn({ ...valid, supplierId: '', invoiceNo: '  ' }, context);
    expect(result.values).toBeNull();
    expect(result.errors['supplierId']).toBe('Choose the supplier');
    expect(result.errors['invoiceNo']).toBe('Enter the supplier invoice number');
    expect(result.firstErrorField).toBe('supplierId');
  });

  it('refuses a GRN with no lines', () => {
    const result = validateGrn({ ...valid, lines: [] }, context);
    expect(result.errors['lines']).toBe('Add an item first, then receive stock');
  });

  it('flags a missing batch, a bad expiry, a zero quantity and negative figures', () => {
    const bad: GrnLineInput = {
      ...line,
      batchNo: '',
      expiry: '13/2027',
      received: '0',
      free: '-1',
      cost: '-2',
    };
    const result = validateGrn({ ...valid, lines: [bad] }, context);
    expect(Object.keys(result.errors)).toEqual([
      grnLineKey(0, 'batchNo'),
      grnLineKey(0, 'expiry'),
      grnLineKey(0, 'received'),
      grnLineKey(0, 'free'),
      grnLineKey(0, 'cost'),
    ]);
    expect(result.firstErrorField).toBe(grnLineKey(0, 'batchNo'));
  });

  it('rejects malformed expiry text', () => {
    for (const expiry of ['3/27', '2028', 'ab/cdef', '']) {
      const result = validateGrn({ ...valid, lines: [{ ...line, expiry }] }, context);
      expect(result.errors[grnLineKey(0, 'expiry')]).toBeDefined();
    }
  });

  it('rejects paid now that is negative, not a number or more than the total', () => {
    for (const paidNow of ['-5', 'abc', '180.01', '1e3']) {
      const result = validateGrn({ ...valid, paidNow }, context);
      expect(result.errors['paidNow']).toBeDefined();
      expect(result.values).toBeNull();
    }
  });

  it('rejects a discount above the items total', () => {
    const result = validateGrn({ ...valid, discount: '999' }, context);
    expect(result.errors['discount']).toBe('The discount cannot be more than the items total');
  });

  it('checks a chosen PO is open and belongs to the supplier', () => {
    expect(
      validateGrn({ ...valid, purchaseOrderId: 'po-004' }, context).values?.purchaseOrderNumber
    ).toBe('PO-0148');
    expect(
      validateGrn({ ...valid, purchaseOrderId: 'po-001' }, context).errors['purchaseOrderId']
    ).toBeDefined();
    expect(
      validateGrn({ ...valid, purchaseOrderId: 'po-003' }, context).errors['purchaseOrderId']
    ).toBeDefined();
    expect(
      validateGrn({ ...valid, purchaseOrderId: 'nope' }, context).errors['purchaseOrderId']
    ).toBeDefined();
  });

  it('rejects a product that no longer exists and an invalid date', () => {
    const result = validateGrn(
      { ...valid, receivedDate: '2026-02-30', lines: [{ ...line, productId: 'prod-999' }] },
      context
    );
    expect(result.errors['lines']).toContain('no longer in your product list');
    expect(result.errors['receivedDate']).toBeDefined();
  });

  it('rejects oversized text and too many lines', () => {
    expect(
      validateGrn({ ...valid, invoiceNo: 'x'.repeat(41) }, context).errors['invoiceNo']
    ).toBeDefined();
    const many = Array.from({ length: 201 }, () => line);
    expect(validateGrn({ ...valid, lines: many }, context).errors['lines']).toContain('up to 200');
  });

  it('lets a draft be saved with blanks but still rejects malformed figures', () => {
    const draft = { ...context, strict: false };
    const blank: GrnFormInput = {
      ...valid,
      supplierId: '',
      invoiceNo: '',
      lines: [{ ...line, batchNo: '', expiry: '', received: '', cost: '' }],
    };
    const result = validateGrn(blank, draft);
    expect(result.errors).toEqual({});
    expect(result.values?.lines[0].expiryDate).toBeNull();
    const malformed = validateGrn({ ...blank, lines: [{ ...line, expiry: '13/2027' }] }, draft);
    expect(malformed.errors[grnLineKey(0, 'expiry')]).toBeDefined();
  });
});
