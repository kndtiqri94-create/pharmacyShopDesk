import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestApi, createApi, movement, product, sale } from './helpers.js';

let api: TestApi;
beforeEach(async () => {
  api = await createApi();
  await api.post('/products', product());
});
afterEach(async () => api.app.close());

const saleReturn = (overrides: Record<string, unknown> = {}) => ({
  id: 'ret-1',
  returnNo: 'AB1-R0001',
  originalSaleId: 'sale-1',
  originalInvoiceNo: 'AB1-0001',
  customerId: 'cus-1',
  customerName: 'Walk-in',
  lines: [
    { productId: 'prod-1', sku: 'PAR-500', name: 'Paracetamol', unitPriceCents: 250, quantity: 1, totalCents: 250, restockAllocations: [] },
  ],
  totalCents: 250,
  settlement: 'CASH_REFUND',
  date: '2026-11-23',
  createdAt: '2026-11-23T11:00:00.000Z',
  processedByUserId: 'usr-1',
  processedByName: 'Cashier',
  ...overrides,
});

describe('S-3.3.4 POS transactions', () => {
  it('posts a sale with its movements once, however many times it is sent', async () => {
    const body = { ...sale(), movements: [movement()] };
    const first = await api.post('/sales', body);
    expect(first.status).toBe(201);
    const again = await api.post('/sales', body);
    expect(again.status).toBe(200);
    expect(again.body.movements).toEqual({ recorded: 0, duplicates: 1 });
    expect((await api.get('/sales')).body.total).toBe(1);
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(98);
  });

  it('never rejects a sale for stock reasons: stock may go negative and is flagged', async () => {
    const result = await api.post('/sales', { ...sale(), movements: [movement({ qtyDelta: -500 })] });
    expect(result.status).toBe(201);
    expect((await api.get('/products/prod-1')).body.stockOnHand).toBe(-400);
    expect((await api.get('/stock/negative')).body.items).toEqual([
      expect.objectContaining({ productId: 'prod-1', quantity: -400 }),
    ]);
  });

  it('refuses a posted sale that is sent again with different content, and a clashing invoice number', async () => {
    await api.post('/sales', sale());
    const changed = await api.post('/sales', sale({ cashierName: 'Someone else' }));
    expect(changed.status).toBe(409);
    expect(changed.body.error.code).toBe('immutable_record');
    const clash = await api.post('/sales', sale({ id: 'sale-2' }));
    expect(clash.body.error.code).toBe('duplicate_invoice_no');
    expect((await api.del('/sales/sale-1')).status).toBe(409);
  });

  it('checks the sale arithmetic and the payment fields', async () => {
    const wrongTotal = await api.post('/sales', sale({ totalCents: 400 }));
    expect(wrongTotal.status).toBe(400);
    const wrongLines = await api.post('/sales', sale({ subTotalCents: 900, totalCents: 900 }));
    expect(wrongLines.status).toBe(400);
    const badCard = await api.post('/sales', sale({ payments: [{ method: 'CARD', amountCents: 500, reference: '', cardLast4: '12' }] }));
    expect(badCard.status).toBe(400);
    expect((await api.post('/sales', sale({ lines: [] }))).status).toBe(400);
  });

  it('keeps returns, quotations and held bills, and blocks movements on endpoints that do not take them', async () => {
    expect((await api.post('/sales', sale())).status).toBe(201);
    const posted = await api.post('/sale-returns', { ...saleReturn(), movements: [movement({ id: 'mov-r', type: 'RETURN', qtyDelta: 1, refId: 'ret-1' })] });
    expect(posted.status).toBe(201);
    expect((await api.post('/sale-returns', saleReturn({ totalCents: 999 }))).status).toBe(400);
    const notAllowed = await api.post('/suppliers', { id: 's', movements: [] });
    expect(notAllowed.status).toBe(400);
    const bill = { invoiceNo: 'AB1-0002', date: '2026-11-23', customerId: 'cus-1', repId: null, lines: [], billDiscount: {}, billDiscountApproval: null, payments: {} };
    const quotation = { id: 'q-1', quotationNo: 'Q-1', status: 'OPEN', bill, customerId: 'cus-1', customerName: 'Walk-in', itemCount: 0, totalCents: 0, date: '2026-11-23', createdAt: '2026-11-23T08:00:00.000Z', createdByUserId: 'u', createdByName: 'U', convertedInvoiceNo: null };
    expect((await api.post('/quotations', quotation)).status).toBe(201);
    expect((await api.put('/quotations/q-1', { ...quotation, status: 'CONVERTED', convertedInvoiceNo: 'AB1-0002' })).status).toBe(200);
    const held = { id: 'h-1', holdNo: 'H-1', heldAt: '2026-11-23T08:00:00.000Z', customerName: '', itemCount: 0, totalCents: 0, bill };
    expect((await api.post('/held-bills', held)).status).toBe(201);
    expect((await api.del('/held-bills/h-1')).status).toBe(204);
  });

  it('derives customer dues and the cash book from the posted records', async () => {
    await api.post('/customers', { id: 'cus-2', name: 'Sunil', isWalkIn: false });
    await api.post('/opening-dues', { customerId: 'cus-2', owedCents: 700 });
    await api.post('/sales', sale({ id: 's-credit', invoiceNo: 'AB1-0002', customerId: 'cus-2', customerName: 'Sunil', payments: [{ method: 'CREDIT', amountCents: 500, reference: '' }], paidCents: 0, creditCents: 500, changeCents: 0 }));
    await api.post('/due-payments', { id: 'dp-1', receiptNo: 'RC-1', customerId: 'cus-2', customerName: 'Sunil', amountCents: 200, method: 'CASH', reference: '', createdAt: '2026-11-23T12:00:00.000Z', takenByUserId: 'u', takenBy: 'U' });
    expect((await api.get('/customers/dues')).body.items).toEqual([{ customerId: 'cus-2', name: 'Sunil', owedCents: 1000 }]);

    await api.post('/sales', sale());
    await api.post('/sale-returns', saleReturn());
    await api.post('/day-openings', { date: '2026-11-23', amountCents: 10000, setByUserId: 'u', setBy: 'U', setAt: '2026-11-23T07:00:00.000Z', changeLog: [] });
    const book = (await api.get('/cash-book?date=2026-11-23')).body;
    expect(book.openingCents).toBe(10000);
    expect(book.cashInCents).toBe(500 + 200); // sale cash kept (1000 - 500 change) + due payment
    expect(book.cashOutCents).toBe(250);
    expect(book.expectedCents).toBe(10000 + 700 - 250);
    expect(book.rows.at(-1).balanceCents).toBe(book.expectedCents);
  });

  it('keeps a closed counter report locked', async () => {
    const report = { date: '2026-11-23', register: 'Counter 1', startTime: null, endTime: '18:00', totalSalesCents: 500, openingCents: 0, cashInCents: 500, cashOutCents: 0, expectedCents: 500, countedCents: 500, differenceCents: 0, handoverCents: 500, supervisorUserId: null, supervisorName: null, broughtForwardCents: 0, unaccountedCents: 0, note: '', closedByUserId: 'u', closedBy: 'U', closedAt: '2026-11-23T18:00:00.000Z', locked: true };
    expect((await api.post('/counter-reports', report)).status).toBe(201);
    expect((await api.put('/counter-reports/2026-11-23', { ...report, countedCents: 1 })).status).toBe(409);
    expect((await api.post('/counter-reports', { ...report, locked: false })).status).toBe(400);
  });

  it('lists by business date', async () => {
    await api.post('/sales', sale());
    await api.post('/sales', sale({ id: 'sale-2', invoiceNo: 'AB1-0002', date: '2026-11-24', createdAt: '2026-11-24T09:00:00.000Z' }));
    expect((await api.get('/sales?date=2026-11-24')).body.total).toBe(1);
    expect((await api.get('/sales?dateFrom=2026-11-23&dateTo=2026-11-24')).body.total).toBe(2);
    expect((await api.get('/sales?date=nope')).status).toBe(400);
    expect((await api.get('/sales?pageSize=1&page=2')).body.items).toHaveLength(1);
    expect((await api.get('/sales?pageSize=100000')).status).toBe(400);
  });
});

const employee = (overrides: Record<string, unknown> = {}) => ({
  id: 'emp-1', code: 'E001', name: 'Kamal Perera', jobTitle: 'Pharmacist', phone: '0771234567',
  status: 'ACTIVE', userId: null, salaryType: 'MONTHLY', basicSalaryCents: 8000000, allowances: [],
  createdAt: '2026-01-01T00:00:00.000Z', firstName: 'Kamal', ...overrides,
});

describe('S-3.3.5 HR', () => {
  it('keeps employees, refuses a repeated code and keeps unlisted fields', async () => {
    const saved = await api.post('/employees', employee());
    expect(saved.status).toBe(201);
    expect(saved.body.firstName).toBe('Kamal');
    expect((await api.post('/employees', employee({ id: 'emp-2', code: 'e001' }))).body.error.code).toBe('duplicate_employee_code');
    expect((await api.post('/employees', employee({ id: 'emp-3', code: 'E3', status: 'GONE' }))).status).toBe(400);
  });

  it('validates leave requests and entitlements', async () => {
    await api.post('/employees', employee());
    const request = { id: 'lv-1', employeeId: 'emp-1', leaveTypeId: 'lt-1', fromDate: '2026-12-01', toDate: '2026-12-03', days: 3, reason: 'Medical', comments: '', attachmentName: null, coveringEmployeeId: null, approverEmployeeId: 'emp-9', approverComment: '', status: 'PENDING', createdAt: '2026-11-23T08:00:00.000Z', decidedAt: null };
    expect((await api.post('/leave-requests', request)).status).toBe(201);
    const backwards = await api.post('/leave-requests', { ...request, id: 'lv-2', fromDate: '2026-12-05' });
    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details[0].message).toMatch(/end date/);
    const entitlement = { id: 'en-1', employeeId: 'emp-1', leaveTypeId: 'lt-1', year: 2026, days: 14 };
    expect((await api.post('/leave-entitlements', entitlement)).status).toBe(201);
    expect((await api.post('/leave-entitlements', { ...entitlement, id: 'en-2' })).body.error.code).toBe('duplicate_entitlement');
    expect((await api.post('/leave-types', { id: 'lt-1', name: 'Annual' })).status).toBe(201);
  });

  it('keeps salary advances, nopay, payroll inputs and payments', async () => {
    expect((await api.post('/salary-advances', { id: 'sa-1', employeeId: 'emp-1', counter: 'Counter 1', date: '2026-11-20', amountCents: 500000, createdAt: '2026-11-20T08:00:00.000Z' })).status).toBe(201);
    expect((await api.post('/salary-advances', { id: 'sa-2', employeeId: 'emp-1', counter: '', date: '2026-11-20', amountCents: 0, createdAt: '2026-11-20T08:00:00.000Z' })).status).toBe(400);
    expect((await api.post('/nopay-entries', { id: 'np-1', employeeId: 'emp-1', date: '2026-11-21', amountCents: 100000, reason: 'Absent', createdAt: '2026-11-21T08:00:00.000Z' })).status).toBe(201);
    const input = { id: 'pi-1', employeeId: 'emp-1', month: '2026-11', overtimeHours: 4, commissionBaseCents: 0, daysWorked: 22 };
    expect((await api.post('/payroll-inputs', input)).status).toBe(201);
    expect((await api.post('/payroll-inputs', { ...input, id: 'pi-2' })).body.error.code).toBe('duplicate_payroll_input');
    expect((await api.post('/payroll-inputs', { ...input, id: 'pi-3', month: '2026-13x' })).status).toBe(400);
    expect((await api.post('/payroll-payments', { id: 'pp-1', employeeId: 'emp-1', month: '2026-11', status: 'PAID' })).status).toBe(201);
    expect((await api.post('/attendance', { id: 'at-1', employeeId: 'emp-1', date: '2026-11-23', status: 'PRESENT', timeIn: '08:00' })).status).toBe(201);
    expect((await api.get('/attendance?date=2026-11-23')).body.total).toBe(1);
  });
});
