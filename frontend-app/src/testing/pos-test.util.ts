import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Batch } from '../app/core/models/domain/batch.model';
import { BillLine } from '../app/core/models/domain/bill-line.model';
import { Bill } from '../app/core/models/domain/bill.model';
import { CounterReport } from '../app/core/models/domain/counter-report.model';
import { Product } from '../app/core/models/domain/product.model';
import { SaleLine } from '../app/core/models/domain/sale-line.model';
import { SaleReturn } from '../app/core/models/domain/sale-return.model';
import { Sale } from '../app/core/models/domain/sale.model';
import { PermissionLevel } from '../app/core/models/enums/permission-level.enum';
import { UserRole } from '../app/core/models/enums/user-role.enum';
import { RoleDataService } from '../app/core/services/data/role-data.service';
import { PermissionService } from '../app/core/services/permission.service';
import { CloseCounterInput } from '../app/core/services/pos-counter.service';
import { ReturnSettlement } from '../app/core/models/enums/return-settlement.enum';
import { SalePaymentMethod } from '../app/core/models/enums/sale-payment-method.enum';

export const TEST_TODAY = '2026-09-21';

export function testBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: 'bat-001',
    batchNo: 'B1',
    expiryDate: '2027-03-31',
    quantity: 100,
    costCents: 100,
    ...overrides,
  };
}

export function testProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-001',
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    category: 'Analgesic',
    form: 'Tablet',
    unit: 'tablet',
    sku: 'PAR-500',
    barcode: '1',
    manufacturer: 'Maker',
    costCents: 100,
    priceCents: 250,
    reorderLevel: 10,
    trackBatches: true,
    stockOnHand: 0,
    prescriptionRequired: false,
    active: true,
    taxRatePercent: 0,
    shelfLocation: '',
    showInPosQuickList: true,
    batches: [testBatch()],
    ...overrides,
  };
}

export function testSaleLine(overrides: Partial<SaleLine> = {}): SaleLine {
  return {
    productId: 'prod-001',
    sku: 'PAR-500',
    name: 'Paracetamol 500mg',
    barcode: '1',
    unitPriceCents: 250,
    discountPercent: 0,
    quantity: 5,
    totalCents: 1250,
    batchAllocations: [{ batchId: 'bat-001', batchNo: 'B1', quantity: 5, costCents: 100 }],
    ...overrides,
  };
}

export function testSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-001',
    invoiceNo: 'INV-0001',
    date: TEST_TODAY,
    createdAt: `${TEST_TODAY}T10:00:00`,
    cashierUserId: 'usr-004',
    cashierName: 'Ruwani Jayawardena',
    customerId: 'cus-001',
    customerName: 'Walk-in Customer',
    repId: null,
    repName: null,
    lines: [testSaleLine()],
    payments: [{ method: SalePaymentMethod.CASH, amountCents: 1500, reference: '' }],
    subTotalCents: 1250,
    discountCents: 0,
    totalCents: 1250,
    paidCents: 1500,
    creditCents: 0,
    changeCents: 250,
    profitCents: 750,
    discountApprovals: [],
    ...overrides,
  };
}

export function testReturn(overrides: Partial<SaleReturn> = {}): SaleReturn {
  return {
    id: 'ret-001',
    returnNo: 'RET-0001',
    originalSaleId: 'sale-001',
    originalInvoiceNo: 'INV-0001',
    customerId: 'cus-001',
    customerName: 'Walk-in Customer',
    lines: [
      {
        productId: 'prod-001',
        sku: 'PAR-500',
        name: 'Paracetamol 500mg',
        unitPriceCents: 250,
        quantity: 2,
        totalCents: 500,
        restockAllocations: [{ batchId: 'bat-001', batchNo: 'B1', quantity: 2, costCents: 100 }],
      },
    ],
    totalCents: 500,
    settlement: ReturnSettlement.CASH_REFUND,
    date: TEST_TODAY,
    createdAt: `${TEST_TODAY}T11:00:00`,
    processedByUserId: 'usr-004',
    processedByName: 'Ruwani Jayawardena',
    ...overrides,
  };
}

export function testBillLine(productId = 'prod-001', quantity = 4): BillLine {
  const catalogue: Record<string, [string, string, number]> = {
    'prod-001': ['PAR-500', 'Paracetamol 500mg', 250],
    'prod-002': ['AMX-500', 'Amoxicillin 500mg', 1800],
  };
  const [sku, name, price] = catalogue[productId];
  return {
    productId,
    sku,
    name,
    barcode: '1',
    unitPriceCents: price,
    discountPercent: 0,
    quantity,
    discountApproval: null,
  };
}

export function testBill(overrides: Partial<Bill> = {}): Bill {
  return {
    invoiceNo: 'INV-0001',
    date: TEST_TODAY,
    customerId: 'cus-001',
    repId: null,
    lines: [testBillLine()],
    billDiscount: { mode: 'PERCENT', percent: 0 },
    billDiscountApproval: null,
    payments: {
      cash: '10',
      card: '',
      online: '',
      cardLast4: '',
      onlineNote: '',
      onlineAccountId: null,
      creditSelected: false,
    },
    ...overrides,
  };
}

export async function setPosLevel(role: UserRole, level: PermissionLevel): Promise<void> {
  await TestBed.inject(PermissionService).load();
  const roleData = TestBed.inject(RoleDataService);
  const matrix = await firstValueFrom(roleData.getMatrix());
  await firstValueFrom(roleData.saveMatrix({ ...matrix, [role]: { ...matrix[role], pos: level } }));
}

export async function settle(fixture: { detectChanges(): void }, ms = 40): Promise<void> {
  fixture.detectChanges();
  await new Promise(resolve => setTimeout(resolve, ms));
  fixture.detectChanges();
}

export function closeOpenDialogs(): void {
  for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
    (dialog as HTMLDialogElement).close();
  }
}

export function counterCloseInput(
  countedText: string,
  overrides: Partial<CloseCounterInput> = {}
): CloseCounterInput {
  return {
    countedText,
    handoverText: '',
    supervisorUserId: null,
    broughtForwardText: null,
    note: '',
    confirmed: true,
    ...overrides,
  };
}

export function testCounterReport(overrides: Partial<CounterReport> = {}): CounterReport {
  return {
    date: TEST_TODAY,
    register: 'Counter 1',
    startTime: `${TEST_TODAY}T08:00:00`,
    endTime: `${TEST_TODAY}T18:00:00`,
    totalSalesCents: 0,
    openingCents: 100,
    cashInCents: 0,
    cashOutCents: 0,
    expectedCents: 100,
    countedCents: 100,
    differenceCents: 0,
    handoverCents: 0,
    supervisorUserId: null,
    supervisorName: null,
    broughtForwardCents: 100,
    unaccountedCents: 0,
    note: '',
    closedByUserId: 'usr-001',
    closedBy: 'Nimal Perera',
    closedAt: `${TEST_TODAY}T18:00:00`,
    locked: true,
    ...overrides,
  };
}
