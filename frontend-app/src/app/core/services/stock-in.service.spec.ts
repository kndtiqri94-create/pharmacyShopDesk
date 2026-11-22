import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { clearBrowserStorage, signInAs, TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { GrnFormInput } from '../utils/grn-validation.util';
import { getStockOnHand } from '../utils/stock-status.util';
import { GrnDataService } from './data/grn-data.service';
import { ProductDataService } from './data/product-data.service';
import { PurchaseOrderDataService } from './data/purchase-order-data.service';
import { StockInService } from './stock-in.service';

const input: GrnFormInput = {
  supplierId: 'sup-001',
  purchaseOrderId: 'po-004',
  receivedDate: '2026-09-21',
  invoiceNo: 'INV-90001',
  invoiceDate: '2026-09-21',
  paymentMethod: 'CREDIT',
  paidNow: '100',
  dueDate: '',
  discount: '',
  lines: [
    {
      productId: 'prod-002',
      batchNo: 'B2700',
      expiry: '05/2028',
      received: '200',
      free: '10',
      cost: '13.00',
      price: '18.00',
    },
    {
      productId: 'prod-006',
      batchNo: 'B2701',
      expiry: '06/2028',
      received: '100',
      free: '0',
      cost: '45.00',
      price: '60.00',
    },
  ],
};

describe('StockInService', () => {
  beforeEach(() => {
    clearBrowserStorage();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
  });

  afterEach(clearBrowserStorage);

  const service = () => TestBed.inject(StockInService);
  const products = () => firstValueFrom(TestBed.inject(ProductDataService).getAll());
  const orders = () => firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
  const grns = () => firstValueFrom(TestBed.inject(GrnDataService).getAll());

  it('receives a GRN: new batches, more stock, cost updated, PO closed, payment derived', async () => {
    await signInAs(UserRole.MANAGER);
    const before = (await products()).find(product => product.id === 'prod-002')!;
    const result = await service().receiveGrn(input, null);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.grn.number).toBe('GRN-0212');
    expect(result.grn.status).toBe(GrnStatus.RECEIVED);
    expect(result.grn.receivedBy).toBe('Kamal Silva');
    expect(result.grn.purchaseOrderNumber).toBe('PO-0148');
    expect(result.grn.paymentStatus).toBe(PaymentStatus.PART_PAID);
    const after = (await products()).find(product => product.id === 'prod-002')!;
    expect(getStockOnHand(after)).toBe(getStockOnHand(before) + 210);
    expect(after.costCents).toBe(1300);
    expect(after.priceCents).toBe(before.priceCents);
    const order = (await orders()).find(item => item.id === 'po-004')!;
    expect(order.status).toBe(PoStatus.RECEIVED);
    expect((await grns()).some(grn => grn.number === 'GRN-0212')).toBeTrue();
  });

  it('refuses invalid input and changes nothing', async () => {
    await signInAs(UserRole.MANAGER);
    const stockBefore = await products();
    const result = await service().receiveGrn({ ...input, invoiceNo: '', lines: [] }, null);
    expect(result.ok).toBeFalse();
    if (result.ok) return;
    expect(result.reason).toBe('invalid');
    expect(result.errors['invoiceNo']).toBe('Enter the supplier invoice number');
    expect(await products()).toEqual(stockBefore);
    expect(await grns()).toHaveSize(7);
  });

  it('rejects receiving a GRN that is already received', async () => {
    await signInAs(UserRole.MANAGER);
    const result = await service().receiveGrn(input, 'grn-001');
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe('already-received');
  });

  it('rejects receiving twice from the same draft', async () => {
    await signInAs(UserRole.MANAGER);
    const first = await service().receiveGrn(input, 'grn-005');
    expect(first.ok).toBeTrue();
    const second = await service().receiveGrn(input, 'grn-005');
    expect(second.ok).toBeFalse();
    if (!second.ok) expect(second.reason).toBe('already-received');
  });

  it('rejects an unknown GRN id', async () => {
    await signInAs(UserRole.MANAGER);
    const result = await service().receiveGrn(input, 'grn-999');
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe('not-found');
  });

  it('lets a Pharmacist receive stock', async () => {
    await signInAs(UserRole.PHARMACIST);
    expect((await service().receiveGrn(input, null)).ok).toBeTrue();
  });

  it('denies a Cashier and changes nothing', async () => {
    await signInAs(UserRole.CASHIER);
    const result = await service().receiveGrn(input, null);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe('denied');
    expect(await grns()).toHaveSize(7);
  });

  it('denies everything while signed out', async () => {
    const result = await service().saveDraft(input, null);
    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.reason).toBe('denied');
  });

  it('saves a draft without touching stock, batches, cost or the PO', async () => {
    await signInAs(UserRole.MANAGER);
    const stockBefore = await products();
    const ordersBefore = await orders();
    const result = await service().saveDraft(input, null);
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.grn.status).toBe(GrnStatus.DRAFT);
    expect(await products()).toEqual(stockBefore);
    expect(await orders()).toEqual(ordersBefore);
    expect((await grns()).filter(grn => grn.status === GrnStatus.DRAFT)).toHaveSize(2);
  });

  it('updates an existing draft in place and keeps its number', async () => {
    await signInAs(UserRole.MANAGER);
    const result = await service().saveDraft({ ...input, invoiceNo: 'INV-CHANGED' }, 'grn-005');
    expect(result.ok).toBeTrue();
    if (!result.ok) return;
    expect(result.grn.id).toBe('grn-005');
    expect(result.grn.number).toBe('GRN-0211');
    expect(await grns()).toHaveSize(7);
  });

  it('completes a part received PO with a later GRN', async () => {
    await signInAs(UserRole.MANAGER);
    const first = {
      ...input,
      supplierId: 'sup-002',
      purchaseOrderId: 'po-003',
      lines: [{ ...input.lines[0], productId: 'prod-005', received: '500' }],
    };
    expect((await service().receiveGrn(first, null)).ok).toBeTrue();
    const order = (await orders()).find(item => item.id === 'po-003')!;
    expect(order.lines.find(line => line.productId === 'prod-005')?.receivedQuantity).toBe(500);
    expect(order.status).toBe(PoStatus.PART_RECEIVED);
  });
});
