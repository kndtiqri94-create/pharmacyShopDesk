import { z } from 'zod';

/**
 * Server-side validation. Field names, enums and limits mirror the frontend models under
 * frontend-app/src/app/core/models and the UI validation utils (product, bank account, ...).
 * Money is whole cents, quantities are whole numbers (as in the app).
 */

export const MAX_PRICE_CENTS = 1_000_000_000; // 10,000,000 rupees (product-validation.util)
export const MAX_QUANTITY = 10_000_000;
const MAX_MONEY_CENTS = 100_000_000_000; // generous cap for totals and balances

const id = z.string().trim().min(1).max(64);
const text = (max: number) => z.string().max(max);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const cents = z.number().int().min(0).max(MAX_MONEY_CENTS);
const signedCents = z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS);
const quantity = z.number().int().min(0).max(MAX_QUANTITY);
const signedQuantity = z.number().int().min(-MAX_QUANTITY).max(MAX_QUANTITY);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date as YYYY-MM-DD.');
const optionalIsoDate = z.union([isoDate, z.literal('')]);
const timestamp = z.string().min(10).max(40);
const percent = z.number().min(0).max(100);

export const USER_ROLES = ['ADMIN', 'MANAGER', 'PHARMACIST', 'CASHIER'] as const;
export const MODULE_KEYS = [
  'dashboard',
  'products',
  'grn',
  'purchase-orders',
  'suppliers',
  'employees',
  'payroll',
  'reload-utility',
  'pos',
  'users',
  'settings',
] as const;
export const STOCK_MOVEMENT_TYPES = ['SALE', 'RETURN', 'GRN', 'ADJUSTMENT'] as const;

// ---------------------------------------------------------------- master data

export const batchSchema = z.object({
  id,
  batchNo: requiredText(40),
  expiryDate: optionalIsoDate,
  quantity: signedQuantity,
  costCents: cents,
});

export const productSchema = z.object({
  id: z.string().max(64).default(''),
  name: requiredText(120),
  genericName: text(120).default(''),
  category: text(60).default(''),
  form: text(60).default(''),
  unit: requiredText(30),
  sku: requiredText(40),
  barcode: text(40).default(''),
  manufacturer: text(120).default(''),
  costCents: z.number().int().min(0).max(MAX_PRICE_CENTS),
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS),
  reorderLevel: quantity,
  trackBatches: z.boolean(),
  stockOnHand: signedQuantity,
  prescriptionRequired: z.boolean(),
  active: z.boolean(),
  taxRatePercent: percent,
  shelfLocation: text(40).default(''),
  showInPosQuickList: z.boolean(),
  batches: z.array(batchSchema).max(500),
});

export const supplierSchema = z.object({
  id,
  name: requiredText(120),
  contactPerson: text(120),
  phone: text(30),
  email: text(120),
  sinceYear: z.number().int().min(1900).max(2200),
  creditDays: z.number().int().min(0).max(3650),
  deliveryDays: text(120),
  active: z.boolean(),
});

export const bankAccountSchema = z.object({
  id,
  bank: z.string().trim().min(2).max(60),
  branch: z.string().trim().max(60),
  holderName: z.string().trim().min(2).max(60),
  accountNo: z.string().trim().min(6).max(20),
  openingBalanceCents: signedCents,
});

export const appUserSchema = z.object({
  id,
  username: requiredText(60),
  displayName: requiredText(120),
  initials: text(4),
  role: z.enum(USER_ROLES),
  employeeId: z.string().max(64).nullable(),
  status: z.enum(['ACTIVE', 'DISABLED']),
  lastSignIn: text(40),
});

export const posCustomerSchema = z.object({
  id,
  name: requiredText(120),
  isWalkIn: z.boolean(),
});

export const salesRepSchema = z.object({ id, name: requiredText(120) });

export const appSettingsSchema = z.object({
  shopName: requiredText(120),
  branchLabel: text(120),
  registrationNo: text(60),
  address: text(300),
  phone: text(30),
  email: text(120),
  expiryAlertDays: z.number().int().min(0).max(3650),
  defaultReorderLevel: quantity,
  lowFloatCents: cents,
  showLowStockCountInSidebar: z.boolean(),
  sellEarliestExpiringFirst: z.boolean(),
  blockExpiredSales: z.boolean(),
  posLineDiscountEnabled: z.boolean(),
  posBillDiscountEnabled: z.boolean(),
  posDefaultDiscountPercent: percent,
  posMaxDiscountPercent: percent,
  posHideSidebar: z.boolean(),
});

export const payrollSettingsSchema = z.object({
  epfEmployeeRate: percent,
  epfEmployerRate: percent,
  etfEmployerRate: percent,
  taxSlabs: z
    .array(z.object({ upToCents: cents.nullable(), rate: percent }))
    .max(50),
  dailyRateDivisor: z.number().min(1).max(366),
  counters: z.array(requiredText(60)).max(50),
  note: text(500),
});

export const roleMatrixSchema = z.record(
  z.enum(USER_ROLES),
  z.record(z.enum(MODULE_KEYS), z.enum(['FULL', 'VIEW', 'NONE']))
);

// ---------------------------------------------------------------- stock

export const movementSchema = z.object({
  id,
  productId: id,
  batchId: z.string().max(64).default(''),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  qtyDelta: z
    .number()
    .int()
    .min(-MAX_QUANTITY)
    .max(MAX_QUANTITY)
    .refine(value => value !== 0, 'A movement must change stock.'),
  refId: z.string().max(64).nullable().default(null),
  userId: z.string().max(64).nullable().default(null),
  deviceCode: z.string().regex(/^[A-Z0-9]{2,4}$/, 'Device code is 2 to 4 capital letters or digits.'),
  createdAt: timestamp,
  // The device-local sequence is accepted and ignored: the server assigns its own order.
  seq: z.number().optional(),
});
export const movementsEnvelope = z.array(movementSchema).max(500).optional();

// ---------------------------------------------------------------- stock in

const grnLine = z.object({
  productId: id,
  batchNo: text(40),
  expiryDate: z.union([isoDate, z.literal('')]).nullable(),
  receivedQuantity: quantity,
  freeQuantity: quantity,
  costCents: cents,
  priceCents: cents,
});

export const grnSchema = z.object({
  id,
  number: requiredText(40),
  receivedDate: isoDate,
  supplierId: id,
  invoiceNo: text(60),
  invoiceDate: optionalIsoDate,
  purchaseOrderNumber: z.string().max(40).nullable(),
  receivedBy: text(120),
  status: z.enum(['DRAFT', 'RECEIVED', 'CANCELLED']),
  paymentStatus: z.enum(['PAID', 'PART_PAID', 'UNPAID']),
  paymentMethod: z.enum(['CASH', 'CREDIT', 'BANK']),
  paidCents: cents,
  dueDate: optionalIsoDate.nullable(),
  discountCents: cents,
  totalCents: cents,
  lines: z.array(grnLine).min(1).max(1000),
});

export const purchaseOrderSchema = z.object({
  id,
  number: requiredText(40),
  orderDate: isoDate,
  expectedDate: optionalIsoDate,
  supplierId: id,
  status: z.enum(['DRAFT', 'SENT', 'PART_RECEIVED', 'RECEIVED', 'CANCELLED']),
  notes: text(1000),
  deliveryCents: cents,
  totalCents: cents,
  lines: z
    .array(
      z.object({
        productId: id,
        orderedQuantity: quantity,
        receivedQuantity: quantity,
        unitCostCents: cents,
      })
    )
    .min(1)
    .max(1000),
});

export const productAdjustmentSchema = z.object({
  id,
  productId: id,
  productName: text(120),
  oldPriceCents: cents,
  newPriceCents: cents,
  oldStock: signedQuantity,
  newStock: signedQuantity,
  byUserId: text(64),
  by: text(120),
  at: timestamp,
});

export const supplierPaymentSchema = z.object({
  id,
  supplierId: id,
  paidDate: isoDate,
  amountCents: cents,
  allocations: z.array(z.object({ grnId: id, amountCents: cents })).max(1000),
  recordedBy: text(120),
});

// ---------------------------------------------------------------- POS

const discountApproval = z.object({
  scope: z.string().max(20),
  productId: z.string().max(64).nullable(),
  percent,
  approverUserId: text(64),
  approverName: text(120),
  approvedAt: timestamp,
});

const batchAllocation = z.object({
  batchId: z.string().max(64).nullable(),
  batchNo: text(40),
  quantity,
  costCents: cents,
});

const saleLine = z.object({
  productId: id,
  sku: text(40),
  name: text(120),
  barcode: text(40),
  unitPriceCents: cents,
  discountPercent: percent,
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  totalCents: cents,
  batchAllocations: z.array(batchAllocation).max(100),
});

const bankSnapshot = z.object({ bank: text(60), accountNo: text(20), holderName: text(60) });

const salePayment = z.object({
  method: z.enum(['CASH', 'CARD', 'ONLINE', 'CREDIT']),
  amountCents: cents,
  reference: text(200),
  account: bankSnapshot.nullable().optional(),
  cardLast4: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  note: text(200).optional(),
});

export const saleSchema = z.object({
  id,
  invoiceNo: requiredText(40),
  date: isoDate,
  createdAt: timestamp,
  cashierUserId: text(64),
  cashierName: text(120),
  customerId: id,
  customerName: text(120),
  repId: z.string().max(64).nullable(),
  repName: z.string().max(120).nullable(),
  lines: z.array(saleLine).min(1).max(1000),
  payments: z.array(salePayment).max(20),
  subTotalCents: cents,
  discountCents: cents,
  totalCents: cents,
  paidCents: cents,
  creditCents: cents,
  changeCents: cents,
  profitCents: signedCents,
  discountApprovals: z.array(discountApproval).max(1000),
  convertedFromQuotationNo: text(40).optional(),
});

const billLine = z.object({
  productId: id,
  sku: text(40),
  name: text(120),
  barcode: text(40),
  unitPriceCents: cents,
  discountPercent: percent,
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  discountApproval: discountApproval.nullable(),
});

/** A bill in progress (held bills, quotations). Kept permissive: it is not a posted record. */
const bill = z.object({
  invoiceNo: text(40),
  date: isoDate,
  customerId: text(64),
  repId: z.string().max(64).nullable(),
  lines: z.array(billLine).max(1000),
  billDiscount: z.looseObject({}),
  billDiscountApproval: discountApproval.nullable(),
  payments: z.looseObject({}),
});

export const heldBillSchema = z.object({
  id,
  holdNo: requiredText(40),
  heldAt: timestamp,
  customerName: text(120),
  itemCount: quantity,
  totalCents: cents,
  bill,
});

export const quotationSchema = z.object({
  id,
  quotationNo: requiredText(40),
  status: z.enum(['OPEN', 'CONVERTED']),
  bill,
  customerId: id,
  customerName: text(120),
  itemCount: quantity,
  totalCents: cents,
  date: isoDate,
  createdAt: timestamp,
  createdByUserId: text(64),
  createdByName: text(120),
  convertedInvoiceNo: z.string().max(40).nullable(),
});

export const saleReturnSchema = z.object({
  id,
  returnNo: requiredText(40),
  originalSaleId: id,
  originalInvoiceNo: text(40),
  customerId: id,
  customerName: text(120),
  lines: z
    .array(
      z.object({
        productId: id,
        sku: text(40),
        name: text(120),
        unitPriceCents: cents,
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
        totalCents: cents,
        restockAllocations: z.array(batchAllocation).max(100),
      })
    )
    .min(1)
    .max(1000),
  totalCents: cents,
  settlement: z.enum(['CASH_REFUND', 'CUSTOMER_CREDIT']),
  date: isoDate,
  createdAt: timestamp,
  processedByUserId: text(64),
  processedByName: text(120),
});

export const duePaymentSchema = z.object({
  id,
  receiptNo: requiredText(40),
  customerId: id,
  customerName: text(120),
  amountCents: cents.refine(value => value > 0, 'Enter an amount above zero.'),
  method: z.enum(['CASH', 'CARD', 'ONLINE', 'CREDIT']),
  reference: text(200),
  createdAt: timestamp,
  takenByUserId: text(64),
  takenBy: text(120),
});

export const openingDueSchema = z.object({ customerId: id, owedCents: cents });

export const dayOpeningSchema = z.object({
  date: isoDate,
  amountCents: cents,
  setByUserId: text(64),
  setBy: text(120),
  setAt: timestamp,
  changeLog: z
    .array(
      z.object({
        oldCents: cents,
        newCents: cents,
        byUserId: text(64),
        by: text(120),
        at: timestamp,
      })
    )
    .max(1000),
});

export const drawerSessionSchema = z.object({
  date: isoDate,
  endedAt: timestamp.nullable(),
  endedByUserId: text(64),
  endedBy: text(120),
});

export const counterReportSchema = z.object({
  date: isoDate,
  register: text(60),
  startTime: z.string().max(40).nullable(),
  endTime: text(40),
  totalSalesCents: cents,
  openingCents: cents,
  cashInCents: cents,
  cashOutCents: cents,
  expectedCents: signedCents,
  countedCents: cents,
  differenceCents: signedCents,
  handoverCents: cents,
  supervisorUserId: z.string().max(64).nullable(),
  supervisorName: z.string().max(120).nullable(),
  broughtForwardCents: signedCents,
  unaccountedCents: signedCents,
  note: text(500),
  closedByUserId: text(64),
  closedBy: text(120),
  closedAt: timestamp,
  locked: z.literal(true),
});

export const reloadTransactionSchema = z.object({
  id,
  occurredAt: timestamp,
  provider: requiredText(60),
  type: z.enum(['RELOAD', 'BILL_PAYMENT']),
  reference: text(100),
  amountCents: cents,
  commissionCents: cents,
  status: z.enum(['SUCCESS', 'PENDING', 'FAILED']),
});

export const reloadFloatSchema = z.object({
  date: isoDate,
  availableCents: signedCents,
  reloadsCount: quantity,
  billsCount: quantity,
  commissionCents: cents,
});

// ---------------------------------------------------------------- HR

export const employeeSchema = z.looseObject({
  id,
  code: requiredText(40),
  name: requiredText(160),
  jobTitle: text(120),
  phone: text(30),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']),
  userId: z.string().max(64).nullable(),
  salaryType: z.enum(['MONTHLY', 'DAILY']),
  basicSalaryCents: cents,
  allowances: z.array(z.object({ id, name: text(120), amountCents: cents })).max(100),
  createdAt: timestamp,
});

export const attendanceSchema = z.object({
  id,
  employeeId: id,
  date: isoDate,
  status: z.enum(['PRESENT', 'LATE', 'NOT_YET', 'ON_LEAVE']),
  timeIn: z.string().max(40).nullable(),
});

export const leaveTypeSchema = z.object({ id, name: requiredText(60) });

export const leaveEntitlementSchema = z.object({
  id,
  employeeId: id,
  leaveTypeId: id,
  year: z.number().int().min(1900).max(2200),
  days: z.number().min(0).max(366),
});

export const leaveRequestSchema = z
  .object({
    id,
    employeeId: id,
    leaveTypeId: id,
    fromDate: isoDate,
    toDate: isoDate,
    days: z.number().min(0.5).max(366),
    reason: z.enum(['Personal', 'Medical', 'Family', 'Travel', 'Bereavement', 'Other']),
    comments: text(1000),
    attachmentName: z.string().max(200).nullable(),
    coveringEmployeeId: z.string().max(64).nullable(),
    approverEmployeeId: text(64),
    approverComment: text(1000),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
    createdAt: timestamp,
    decidedAt: timestamp.nullable(),
  })
  .refine(value => value.fromDate <= value.toDate, {
    message: 'The leave end date cannot be before the start date.',
    path: ['toDate'],
  });

export const payrollInputSchema = z.object({
  id,
  employeeId: id,
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use a month as YYYY-MM.'),
  overtimeHours: z.number().min(0).max(744),
  commissionBaseCents: cents,
  daysWorked: z.number().min(0).max(31),
});

export const salaryAdvanceSchema = z.object({
  id,
  employeeId: id,
  counter: text(60),
  date: isoDate,
  amountCents: cents.refine(value => value > 0, 'Enter an amount above zero.'),
  createdAt: timestamp,
});

export const nopayEntrySchema = z.object({
  id,
  employeeId: id,
  date: isoDate,
  amountCents: cents,
  reason: text(300),
  createdAt: timestamp,
});

export const payrollPaymentSchema = z.object({
  id,
  employeeId: id,
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use a month as YYYY-MM.'),
  status: z.enum(['UNPAID', 'PAID']),
});
