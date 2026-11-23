import Dexie, { DexieOptions, Table, Transaction } from 'dexie';
import { cloneValue } from '../../../utils/clone.util';
import { newId } from '../../../utils/device-id.util';
import { AppUser } from '../../../models/domain/app-user.model';
import { AttendanceRecord } from '../../../models/domain/attendance-record.model';
import { BankAccount } from '../../../models/domain/bank-account.model';
import { CounterReport } from '../../../models/domain/counter-report.model';
import { DayOpening } from '../../../models/domain/day-opening.model';
import { DrawerSession } from '../../../models/domain/drawer-session.model';
import { DuePayment } from '../../../models/domain/due-payment.model';
import { Employee } from '../../../models/domain/employee.model';
import { Grn } from '../../../models/domain/grn.model';
import { HeldBill } from '../../../models/domain/held-bill.model';
import { LeaveEntitlement } from '../../../models/domain/leave-entitlement.model';
import { LeaveRequest } from '../../../models/domain/leave-request.model';
import { LeaveType } from '../../../models/domain/leave-type.model';
import { NopayEntry } from '../../../models/domain/nopay-entry.model';
import { PayrollInput } from '../../../models/domain/payroll-input.model';
import { PayrollPayment } from '../../../models/domain/payroll-payment.model';
import { PosCustomer } from '../../../models/domain/pos-customer.model';
import { ProductAdjustment } from '../../../models/domain/product-adjustment.model';
import { Product } from '../../../models/domain/product.model';
import { PurchaseOrder } from '../../../models/domain/purchase-order.model';
import { Quotation } from '../../../models/domain/quotation.model';
import { ReloadFloat } from '../../../models/domain/reload-float.model';
import { ReloadTransaction } from '../../../models/domain/reload-transaction.model';
import { SalaryAdvance } from '../../../models/domain/salary-advance.model';
import { SaleReturn } from '../../../models/domain/sale-return.model';
import { Sale } from '../../../models/domain/sale.model';
import { SalesRep } from '../../../models/domain/sales-rep.model';
import { StockMovement } from '../../../models/domain/stock-movement.model';
import { SupplierPayment } from '../../../models/domain/supplier-payment.model';
import { Supplier } from '../../../models/domain/supplier.model';
import { OpeningDueBalance } from '../sales-data.service';
import { FORBIDDEN_FIELDS, OUTBOX_ENTITIES } from './sync/outbox-entities.const';
import { OutboxEntry, OutboxOperation, SyncSeqRow, changeKey } from './sync/outbox.model';

export const LOCAL_DB_NAME = 'shopdesk-local';

export type Row<T> = T & { _ord: number };
export type ProductRow = Row<Product> & { skuKey: string };

export interface DocumentRow {
  id: string;
  value: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export interface SchemaVersion {
  version: number;
  stores: Record<string, string | null>;
  upgrade?: (transaction: Transaction) => void | Promise<void>;
}

export const LOCAL_SCHEMA_VERSIONS: readonly SchemaVersion[] = [
  {
    version: 1,
    stores: {
      products: 'id, _ord, skuKey, barcode',
      suppliers: 'id, _ord',
      bankAccounts: 'id, _ord',
      users: 'id, _ord',
      documents: 'id',
      meta: 'key',
      reloadTransactions: 'id, _ord',
      reloadFloats: 'date, _ord',
      supplierPayments: 'id, _ord',
      grns: 'id, _ord',
      purchaseOrders: 'id, _ord',
      sales: 'id, _ord, invoiceNo, date',
      heldBills: 'id, _ord',
      quotations: 'id, _ord',
      saleReturns: 'id, _ord, date',
      duePayments: 'id, _ord',
      productAdjustments: 'id, _ord',
      dayOpenings: 'date, _ord',
      drawerSessions: 'date, _ord',
      counterReports: 'date, _ord',
      posCustomers: 'id, _ord',
      salesReps: 'id, _ord',
      openingDues: 'customerId, _ord',
      employees: 'id, _ord',
      attendance: 'id, _ord, date',
      leaveTypes: 'id, _ord',
      leaveEntitlements: 'id, _ord',
      leaveRequests: 'id, _ord',
      payrollInputs: 'id, _ord',
      salaryAdvances: 'id, _ord',
      nopayEntries: 'id, _ord',
      payrollPayments: 'id, _ord',
      stockMovements: 'id, &seq, productId, [productId+batchId], createdAt, type, refId',
    },
  },
  {
    version: 2,
    stores: {
      outbox: '++seq, &changeId, status, entity',
      syncSeqs: 'key',
    },
  },
];

interface TrackedTransaction extends Transaction {
  suppressOutbox?: boolean;
  guardWrites?: Set<string>;
  guardEnqueued?: Set<string>;
}

export class OutboxScopeError extends Error {
  constructor() {
    super('A local write must run in a transaction that includes the outbox.');
    this.name = 'OutboxScopeError';
  }
}

export function suppressOutbox(): void {
  const transaction = Dexie.currentTransaction as TrackedTransaction | null;
  if (transaction) rootOf(transaction).suppressOutbox = true;
}

function rootOf(transaction: TrackedTransaction): TrackedTransaction {
  let current = transaction;
  while (current.parent) current = current.parent as TrackedTransaction;
  return current;
}

function snapshotOf(entity: string, data: unknown): unknown {
  const copy = cloneValue(data) as Record<string, unknown>;
  delete copy['_ord'];
  if (entity === 'products') delete copy['skuKey'];
  for (const field of FORBIDDEN_FIELDS) delete copy[field];
  return copy;
}

export class LocalDatabase extends Dexie {
  readonly outboxViolations: string[] = [];

  declare products: Table<ProductRow, string>;
  declare suppliers: Table<Row<Supplier>, string>;
  declare bankAccounts: Table<Row<BankAccount>, string>;
  declare users: Table<Row<AppUser>, string>;
  declare documents: Table<DocumentRow, string>;
  declare meta: Table<MetaRow, string>;
  declare reloadTransactions: Table<Row<ReloadTransaction>, string>;
  declare reloadFloats: Table<Row<ReloadFloat>, string>;
  declare supplierPayments: Table<Row<SupplierPayment>, string>;
  declare grns: Table<Row<Grn>, string>;
  declare purchaseOrders: Table<Row<PurchaseOrder>, string>;
  declare sales: Table<Row<Sale>, string>;
  declare heldBills: Table<Row<HeldBill>, string>;
  declare quotations: Table<Row<Quotation>, string>;
  declare saleReturns: Table<Row<SaleReturn>, string>;
  declare duePayments: Table<Row<DuePayment>, string>;
  declare productAdjustments: Table<Row<ProductAdjustment>, string>;
  declare dayOpenings: Table<Row<DayOpening>, string>;
  declare drawerSessions: Table<Row<DrawerSession>, string>;
  declare counterReports: Table<Row<CounterReport>, string>;
  declare posCustomers: Table<Row<PosCustomer>, string>;
  declare salesReps: Table<Row<SalesRep>, string>;
  declare openingDues: Table<Row<OpeningDueBalance>, string>;
  declare employees: Table<Row<Employee>, string>;
  declare attendance: Table<Row<AttendanceRecord>, string>;
  declare leaveTypes: Table<Row<LeaveType>, string>;
  declare leaveEntitlements: Table<Row<LeaveEntitlement>, string>;
  declare leaveRequests: Table<Row<LeaveRequest>, string>;
  declare payrollInputs: Table<Row<PayrollInput>, string>;
  declare salaryAdvances: Table<Row<SalaryAdvance>, string>;
  declare nopayEntries: Table<Row<NopayEntry>, string>;
  declare payrollPayments: Table<Row<PayrollPayment>, string>;
  declare stockMovements: Table<StockMovement, string>;
  declare outbox: Table<OutboxEntry, number>;
  declare syncSeqs: Table<SyncSeqRow, string>;

  constructor(
    name: string = LOCAL_DB_NAME,
    options?: DexieOptions,
    versions: readonly SchemaVersion[] = LOCAL_SCHEMA_VERSIONS
  ) {
    super(name, options);
    for (const schema of versions) {
      const version = this.version(schema.version).stores(schema.stores);
      if (schema.upgrade) version.upgrade(schema.upgrade);
    }
  }

  async enqueue(entity: string, id: string, op: OutboxOperation, data: unknown): Promise<void> {
    const transaction = Dexie.currentTransaction as TrackedTransaction | null;
    if (transaction && rootOf(transaction).suppressOutbox) return;
    if (!transaction?.storeNames.includes('outbox')) throw new OutboxScopeError();
    const root = rootOf(transaction);
    (root.guardEnqueued ??= new Set()).add(changeKey(entity, id));
    await this.outbox.add({
      changeId: newId(),
      entity,
      id,
      op,
      data: op === 'put' ? snapshotOf(entity, data) : null,
      createdAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    });
  }

  installOutboxGuard(): void {
    for (const entity of OUTBOX_ENTITIES) {
      const table = this.table(entity);
      table.hook('creating', (primKey, _row, transaction) => {
        this.trackWrite(entity, primKey, transaction);
      });
      table.hook('updating', (_mods, primKey, _row, transaction) => {
        this.trackWrite(entity, primKey, transaction);
      });
      table.hook('deleting', (primKey, _row, transaction) => {
        this.trackWrite(entity, primKey, transaction);
      });
    }
  }

  private trackWrite(entity: string, primKey: unknown, transaction: Transaction): void {
    const tracked = rootOf(transaction as TrackedTransaction);
    if (tracked.suppressOutbox) return;
    if (!tracked.guardWrites) {
      tracked.guardWrites = new Set();
      transaction.on('complete', () => this.reportViolations(tracked));
    }
    tracked.guardWrites.add(changeKey(entity, String(primKey)));
  }

  private reportViolations(transaction: TrackedTransaction): void {
    for (const key of transaction.guardWrites ?? []) {
      if (!transaction.guardEnqueued?.has(key)) this.outboxViolations.push(key.split(':')[0]);
    }
  }
}
