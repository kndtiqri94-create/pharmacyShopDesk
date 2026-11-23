import { Table } from 'dexie';
import { cloneValue } from '../../../../utils/clone.util';
import { ATTENDANCE_SEED } from '../../in-memory/seed/attendance.seed';
import { BANK_ACCOUNT_SEED } from '../../in-memory/seed/bank-account.seed';
import { EMPLOYEE_SEED } from '../../in-memory/seed/employee.seed';
import { GRN_SEED } from '../../in-memory/seed/grn.seed';
import {
  LEAVE_ENTITLEMENT_SEED,
  LEAVE_REQUEST_SEED,
  LEAVE_TYPE_SEED,
} from '../../in-memory/seed/leave.seed';
import {
  NOPAY_SEED,
  PAYROLL_INPUT_SEED,
  PAYROLL_PAYMENT_SEED,
  PAYROLL_SETTINGS_SEED,
  SALARY_ADVANCE_SEED,
} from '../../in-memory/seed/payroll.seed';
import { OPENING_DUE_SEED, POS_CUSTOMER_SEED, SALES_REP_SEED } from '../../in-memory/seed/pos.seed';
import { PRODUCT_SEED } from '../../in-memory/seed/product.seed';
import { PURCHASE_ORDER_SEED } from '../../in-memory/seed/purchase-order.seed';
import { RELOAD_FLOAT_SEED, RELOAD_TRANSACTION_SEED } from '../../in-memory/seed/reload.seed';
import { ROLE_PERMISSION_SEED } from '../../in-memory/seed/role-permission.seed';
import { SETTINGS_SEED } from '../../in-memory/seed/settings.seed';
import { SUPPLIER_PAYMENT_SEED } from '../../in-memory/seed/supplier-payment.seed';
import { SUPPLIER_SEED } from '../../in-memory/seed/supplier.seed';
import { USER_SEED } from '../../in-memory/seed/user.seed';
import { LocalDatabase, ProductRow, Row } from '../local-database';
import { DOCUMENT_IDS, META_KEYS, readMeta, writeDocument, writeMeta } from '../local-meta';
import { skuKeyOf } from '../local-product-keys';
import { sanitizeUser } from '../local-user-sanitizer';

async function putAll<T extends object>(
  table: Table<Row<T>, string>,
  items: readonly T[]
): Promise<void> {
  await table.bulkPut(
    items.map((item, index) => ({ ...cloneValue(item), _ord: index + 1 }) as Row<T>)
  );
}

async function seedProducts(db: LocalDatabase): Promise<void> {
  const rows = PRODUCT_SEED.map((product, index): ProductRow => ({
    ...cloneValue(product),
    _ord: index + 1,
    skuKey: skuKeyOf(product.sku),
  }));
  await db.products.bulkPut(rows);
}

async function seedCollections(db: LocalDatabase): Promise<void> {
  await putAll(db.suppliers, SUPPLIER_SEED);
  await putAll(db.bankAccounts, BANK_ACCOUNT_SEED);
  await putAll(db.users, USER_SEED.map(sanitizeUser));
  await putAll(db.reloadTransactions, RELOAD_TRANSACTION_SEED);
  await putAll(db.reloadFloats, RELOAD_FLOAT_SEED);
  await putAll(db.supplierPayments, SUPPLIER_PAYMENT_SEED);
  await putAll(db.grns, GRN_SEED);
  await putAll(db.purchaseOrders, PURCHASE_ORDER_SEED);
  await putAll(db.posCustomers, POS_CUSTOMER_SEED);
  await putAll(db.salesReps, SALES_REP_SEED);
  await putAll(db.openingDues, OPENING_DUE_SEED);
  await putAll(db.employees, EMPLOYEE_SEED);
  await putAll(db.attendance, ATTENDANCE_SEED);
  await putAll(db.leaveTypes, LEAVE_TYPE_SEED);
  await putAll(db.leaveEntitlements, LEAVE_ENTITLEMENT_SEED);
  await putAll(db.leaveRequests, LEAVE_REQUEST_SEED);
  await putAll(db.payrollInputs, PAYROLL_INPUT_SEED);
  await putAll(db.salaryAdvances, SALARY_ADVANCE_SEED);
  await putAll(db.nopayEntries, NOPAY_SEED);
  await putAll(db.payrollPayments, PAYROLL_PAYMENT_SEED);
}

export async function seedLocalDatabase(db: LocalDatabase, now: string): Promise<boolean> {
  return db.transaction('rw', db.tables, async () => {
    if ((await readMeta<string>(db, META_KEYS.seededAt)) !== undefined) return false;
    await seedProducts(db);
    await seedCollections(db);
    await writeDocument(db, DOCUMENT_IDS.appSettings, cloneValue(SETTINGS_SEED));
    await writeDocument(db, DOCUMENT_IDS.payrollSettings, cloneValue(PAYROLL_SETTINGS_SEED));
    await writeDocument(db, DOCUMENT_IDS.roleMatrix, cloneValue(ROLE_PERMISSION_SEED));
    await writeMeta(db, META_KEYS.seededAt, now);
    return true;
  });
}
