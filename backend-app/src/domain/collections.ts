import { z } from 'zod';
import { JsonObject } from '../store/types.js';
import * as s from './schemas.js';

/**
 * One entry per frontend Dexie table. `name` is the collection (and sync entity) name and equals
 * the frontend table name; `route` is the URL segment under /api/v1.
 */
export interface CollectionSpec {
  name: string;
  route: string;
  /** Field holding the record id (most use `id`; day records use `date`). */
  idField: string;
  schema: z.ZodType;
  /** Case-folded natural key that must be unique, or null. */
  uniqueKey?: (data: JsonObject) => string | null;
  uniqueCode?: string;
  uniqueMessage?: string;
  dateKey?: (data: JsonObject) => string | null;
  /** Append-only: once posted a record is never changed or deleted (sales, returns, ...). */
  immutable?: boolean;
  /** REST create accepts an optional `movements` array recorded in the same transaction. */
  withMovements?: boolean;
  /** Cross-field business rule. Returns a message when the record breaks it. */
  check?: (data: JsonObject) => string | null;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const fold = (value: unknown): string => str(value).trim().toLowerCase();
const nonEmpty = (value: string): string | null => (value.length > 0 ? value : null);
const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

const dateOf =
  (field: string) =>
  (data: JsonObject): string | null =>
    nonEmpty(str(data[field]).slice(0, 10));

function checkSale(data: JsonObject): string | null {
  const lines = Array.isArray(data['lines']) ? (data['lines'] as JsonObject[]) : [];
  const linesTotal = lines.reduce((total, line) => total + num(line['totalCents']), 0);
  if (linesTotal !== num(data['subTotalCents'])) {
    return 'The line totals do not add up to the sub total.';
  }
  if (num(data['discountCents']) > num(data['subTotalCents'])) {
    return 'The discount cannot be more than the sub total.';
  }
  if (num(data['subTotalCents']) - num(data['discountCents']) !== num(data['totalCents'])) {
    return 'The total must equal the sub total less the discount.';
  }
  return null;
}

function checkReturn(data: JsonObject): string | null {
  const lines = Array.isArray(data['lines']) ? (data['lines'] as JsonObject[]) : [];
  const linesTotal = lines.reduce((total, line) => total + num(line['totalCents']), 0);
  return linesTotal === num(data['totalCents'])
    ? null
    : 'The line totals do not add up to the return total.';
}

const pairKey = (...fields: string[]) =>
  (data: JsonObject): string => fields.map(field => fold(data[field])).join('|');

export const COLLECTIONS: readonly CollectionSpec[] = [
  {
    name: 'products',
    route: 'products',
    idField: 'id',
    schema: s.productSchema,
    uniqueKey: data => nonEmpty(fold(data['sku'])),
    uniqueCode: 'duplicate_sku',
    uniqueMessage: 'This SKU already belongs to another product.',
  },
  { name: 'suppliers', route: 'suppliers', idField: 'id', schema: s.supplierSchema },
  {
    name: 'bankAccounts',
    route: 'bank-accounts',
    idField: 'id',
    schema: s.bankAccountSchema,
    uniqueKey: pairKey('bank', 'accountNo'),
    uniqueCode: 'duplicate_bank_account',
    uniqueMessage: 'This account already exists for that bank.',
  },
  { name: 'users', route: 'users', idField: 'id', schema: s.appUserSchema,
    uniqueKey: data => nonEmpty(fold(data['username'])),
    uniqueCode: 'duplicate_username',
    uniqueMessage: 'This username is already taken.' },
  { name: 'posCustomers', route: 'customers', idField: 'id', schema: s.posCustomerSchema },
  { name: 'salesReps', route: 'sales-reps', idField: 'id', schema: s.salesRepSchema },
  {
    name: 'grns',
    route: 'grns',
    idField: 'id',
    schema: s.grnSchema,
    withMovements: true,
    uniqueKey: data => nonEmpty(fold(data['number'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This GRN number is already used.',
    dateKey: dateOf('receivedDate'),
  },
  {
    name: 'purchaseOrders',
    route: 'purchase-orders',
    idField: 'id',
    schema: s.purchaseOrderSchema,
    uniqueKey: data => nonEmpty(fold(data['number'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This purchase order number is already used.',
    dateKey: dateOf('orderDate'),
  },
  {
    name: 'productAdjustments',
    route: 'product-adjustments',
    idField: 'id',
    schema: s.productAdjustmentSchema,
    immutable: true,
    withMovements: true,
    dateKey: dateOf('at'),
  },
  {
    name: 'supplierPayments',
    route: 'supplier-payments',
    idField: 'id',
    schema: s.supplierPaymentSchema,
    immutable: true,
    dateKey: dateOf('paidDate'),
  },
  {
    name: 'sales',
    route: 'sales',
    idField: 'id',
    schema: s.saleSchema,
    immutable: true,
    withMovements: true,
    uniqueKey: data => nonEmpty(fold(data['invoiceNo'])),
    uniqueCode: 'duplicate_invoice_no',
    uniqueMessage: 'This invoice number belongs to a different sale.',
    dateKey: dateOf('date'),
    check: checkSale,
  },
  {
    name: 'heldBills',
    route: 'held-bills',
    idField: 'id',
    schema: s.heldBillSchema,
    uniqueKey: data => nonEmpty(fold(data['holdNo'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This hold number is already used.',
  },
  {
    name: 'quotations',
    route: 'quotations',
    idField: 'id',
    schema: s.quotationSchema,
    uniqueKey: data => nonEmpty(fold(data['quotationNo'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This quotation number is already used.',
    dateKey: dateOf('date'),
  },
  {
    name: 'saleReturns',
    route: 'sale-returns',
    idField: 'id',
    schema: s.saleReturnSchema,
    immutable: true,
    withMovements: true,
    uniqueKey: data => nonEmpty(fold(data['returnNo'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This return number is already used.',
    dateKey: dateOf('date'),
    check: checkReturn,
  },
  {
    name: 'duePayments',
    route: 'due-payments',
    idField: 'id',
    schema: s.duePaymentSchema,
    immutable: true,
    uniqueKey: data => nonEmpty(fold(data['receiptNo'])),
    uniqueCode: 'duplicate_number',
    uniqueMessage: 'This receipt number is already used.',
    dateKey: dateOf('createdAt'),
  },
  {
    name: 'openingDues',
    route: 'opening-dues',
    idField: 'customerId',
    schema: s.openingDueSchema,
  },
  {
    name: 'dayOpenings',
    route: 'day-openings',
    idField: 'date',
    schema: s.dayOpeningSchema,
    dateKey: dateOf('date'),
  },
  {
    name: 'drawerSessions',
    route: 'drawer-sessions',
    idField: 'date',
    schema: s.drawerSessionSchema,
    dateKey: dateOf('date'),
  },
  {
    name: 'counterReports',
    route: 'counter-reports',
    idField: 'date',
    schema: s.counterReportSchema,
    immutable: true,
    dateKey: dateOf('date'),
  },
  {
    name: 'reloadTransactions',
    route: 'reload-transactions',
    idField: 'id',
    schema: s.reloadTransactionSchema,
    dateKey: dateOf('occurredAt'),
  },
  {
    name: 'reloadFloats',
    route: 'reload-floats',
    idField: 'date',
    schema: s.reloadFloatSchema,
    dateKey: dateOf('date'),
  },
  {
    name: 'employees',
    route: 'employees',
    idField: 'id',
    schema: s.employeeSchema,
    uniqueKey: data => nonEmpty(fold(data['code'])),
    uniqueCode: 'duplicate_employee_code',
    uniqueMessage: 'This employee code is already used.',
  },
  {
    name: 'attendance',
    route: 'attendance',
    idField: 'id',
    schema: s.attendanceSchema,
    uniqueKey: pairKey('employeeId', 'date'),
    uniqueCode: 'duplicate_attendance',
    uniqueMessage: 'Attendance for this employee and day already exists.',
    dateKey: dateOf('date'),
  },
  { name: 'leaveTypes', route: 'leave-types', idField: 'id', schema: s.leaveTypeSchema,
    uniqueKey: data => nonEmpty(fold(data['name'])),
    uniqueCode: 'duplicate_leave_type',
    uniqueMessage: 'This leave type already exists.' },
  {
    name: 'leaveEntitlements',
    route: 'leave-entitlements',
    idField: 'id',
    schema: s.leaveEntitlementSchema,
    uniqueKey: data =>
      [fold(data['employeeId']), fold(data['leaveTypeId']), String(num(data['year']))].join('|'),
    uniqueCode: 'duplicate_entitlement',
    uniqueMessage: 'This entitlement already exists for the employee, leave type and year.',
  },
  {
    name: 'leaveRequests',
    route: 'leave-requests',
    idField: 'id',
    schema: s.leaveRequestSchema,
    dateKey: dateOf('fromDate'),
  },
  {
    name: 'payrollInputs',
    route: 'payroll-inputs',
    idField: 'id',
    schema: s.payrollInputSchema,
    uniqueKey: pairKey('employeeId', 'month'),
    uniqueCode: 'duplicate_payroll_input',
    uniqueMessage: 'Payroll inputs for this employee and month already exist.',
  },
  {
    name: 'salaryAdvances',
    route: 'salary-advances',
    idField: 'id',
    schema: s.salaryAdvanceSchema,
    dateKey: dateOf('date'),
  },
  {
    name: 'nopayEntries',
    route: 'nopay-entries',
    idField: 'id',
    schema: s.nopayEntrySchema,
    dateKey: dateOf('date'),
  },
  {
    name: 'payrollPayments',
    route: 'payroll-payments',
    idField: 'id',
    schema: s.payrollPaymentSchema,
    uniqueKey: pairKey('employeeId', 'month'),
    uniqueCode: 'duplicate_payroll_payment',
    uniqueMessage: 'A payment record for this employee and month already exists.',
  },
];

export const COLLECTION_BY_NAME: ReadonlyMap<string, CollectionSpec> = new Map(
  COLLECTIONS.map(spec => [spec.name, spec])
);

/** Singleton documents (frontend `documents` table): settings and the role matrix. */
export const DOCUMENTS_COLLECTION = 'documents';
export const DOCUMENT_SCHEMAS: Readonly<Record<string, { route: string; schema: z.ZodType }>> = {
  'app-settings': { route: 'app', schema: s.appSettingsSchema },
  'payroll-settings': { route: 'payroll', schema: s.payrollSettingsSchema },
  'role-matrix': { route: 'role-matrix', schema: s.roleMatrixSchema },
};

/** Entity names accepted by the sync endpoints. */
export const SYNC_ENTITIES: ReadonlySet<string> = new Set([
  ...COLLECTIONS.map(spec => spec.name),
  DOCUMENTS_COLLECTION,
  'stockMovements',
]);
