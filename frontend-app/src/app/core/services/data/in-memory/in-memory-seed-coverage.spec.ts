import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AttendanceStatus } from '../../../models/enums/attendance-status.enum';
import { EmployeeStatus } from '../../../models/enums/employee-status.enum';
import { SalaryType } from '../../../models/enums/salary-type.enum';
import { GrnStatus } from '../../../models/enums/grn-status.enum';
import { LeaveStatus } from '../../../models/enums/leave-status.enum';
import { PayrollPaymentStatus } from '../../../models/enums/payroll-payment-status.enum';
import { PaymentStatus } from '../../../models/enums/payment-status.enum';
import { PoStatus } from '../../../models/enums/po-status.enum';
import { ReloadStatus } from '../../../models/enums/reload-status.enum';
import { UserRole } from '../../../models/enums/user-role.enum';
import { isPurchaseOrderOverdue } from '../../../utils/purchase-order-overdue.util';
import { amountOwedToSupplier } from '../../../utils/supplier-owed.util';
import { SAMPLE_TODAY } from '../../clock.service';
import { provideDataServices } from '../data-providers';
import { AttendanceDataService } from '../attendance-data.service';
import { EmployeeDataService } from '../employee-data.service';
import { GrnDataService } from '../grn-data.service';
import { LeaveDataService } from '../leave-data.service';
import { PayrollDataService } from '../payroll-data.service';
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { ReloadDataService } from '../reload-data.service';
import { SalesDataService } from '../sales-data.service';
import { SettingsDataService } from '../settings-data.service';
import { SupplierDataService } from '../supplier-data.service';
import { SupplierPaymentDataService } from '../supplier-payment-data.service';
import { UserDataService } from '../user-data.service';

describe('in-memory seed coverage', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  it('has a purchase order in every status and at least one overdue', async () => {
    const orders = await firstValueFrom(TestBed.inject(PurchaseOrderDataService).getAll());
    expect(new Set(orders.map(order => order.status))).toEqual(new Set(Object.values(PoStatus)));
    expect(orders.some(order => isPurchaseOrderOverdue(order, SAMPLE_TODAY))).toBeTrue();
  });

  it('has GRNs in every status and payment state', async () => {
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    expect(new Set(grns.map(grn => grn.status))).toEqual(new Set(Object.values(GrnStatus)));
    expect(new Set(grns.map(grn => grn.paymentStatus))).toEqual(
      new Set(Object.values(PaymentStatus))
    );
  });

  it('has an owing supplier and an inactive supplier, and the named suppliers', async () => {
    const suppliers = await firstValueFrom(TestBed.inject(SupplierDataService).getAll());
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    const owedBy = (id: string) => amountOwedToSupplier(grns, id);
    expect(suppliers.filter(supplier => owedBy(supplier.id) > 0).length).toBeGreaterThanOrEqual(2);
    expect(suppliers.some(supplier => !supplier.active)).toBeTrue();
    expect(suppliers.map(supplier => supplier.name)).toEqual([
      'Lanka Pharma',
      'City Medicals',
      'Health Plus Ltd',
      'MediCare Distributors',
      'Ceylon Surgical',
    ]);
    expect(owedBy('sup-001')).toBe(1_160_000);
    expect(owedBy('sup-003')).toBe(280_000);
  });

  it('has a supplier with several unpaid received GRNs of different dates', async () => {
    const grns = await firstValueFrom(TestBed.inject(GrnDataService).getAll());
    const unpaid = grns.filter(
      grn =>
        grn.supplierId === 'sup-001' &&
        grn.status === GrnStatus.RECEIVED &&
        grn.paidCents < grn.totalCents
    );
    expect(unpaid.length).toBeGreaterThanOrEqual(3);
    expect(new Set(unpaid.map(grn => grn.receivedDate)).size).toBe(unpaid.length);
  });

  it('has attendance for today for every employee, approved leave covering today and seeded payments', async () => {
    const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
    const attendance = await firstValueFrom(
      TestBed.inject(AttendanceDataService).getForDate(SAMPLE_TODAY)
    );
    expect(attendance.map(record => record.employeeId).sort()).toEqual(
      employees.map(employee => employee.id).sort()
    );
    expect(new Set(attendance.map(record => record.status))).toEqual(
      new Set(Object.values(AttendanceStatus))
    );
    const leave = await firstValueFrom(TestBed.inject(LeaveDataService).getRequests());
    expect(
      leave.some(
        request =>
          request.employeeId === 'emp-007' &&
          request.status === LeaveStatus.APPROVED &&
          request.fromDate <= SAMPLE_TODAY &&
          SAMPLE_TODAY <= request.toDate
      )
    ).toBeTrue();
    const payments = await firstValueFrom(TestBed.inject(SupplierPaymentDataService).getAll());
    expect(payments.length).toBeGreaterThan(0);
  });

  it('has complete employee records with unique codes, both salary types and one inactive employee', async () => {
    const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
    const codes = employees.map(employee => employee.code.toLowerCase());
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(employees.map(employee => employee.salaryType))).toEqual(
      new Set(Object.values(SalaryType))
    );
    expect(employees.filter(employee => employee.status === EmployeeStatus.INACTIVE).length).toBe(
      1
    );
    expect(employees.some(employee => employee.allowances.length > 0)).toBeTrue();
    expect(employees.some(employee => employee.calculateEpf && employee.calculateEtf)).toBeTrue();
    expect(new Set(employees.map(employee => employee.createdAt)).size).toBe(employees.length);
    for (const employee of employees) {
      expect(employee.name).toBe(`${employee.firstName} ${employee.lastName}`);
    }
  });

  it('deletes an employee and returns copies from the employee data service', async () => {
    const service = TestBed.inject(EmployeeDataService);
    const first = (await firstValueFrom(service.getAll()))[0];
    first.name = 'Changed';
    expect((await firstValueFrom(service.getById('emp-001')))?.name).toBe('Nimal Perera');
    expect(await firstValueFrom(service.delete('emp-005'))).toBeTrue();
    expect(await firstValueFrom(service.getById('emp-005'))).toBeNull();
    expect(await firstValueFrom(service.delete('emp-005'))).toBeFalse();
  });

  it('has the named employees', async () => {
    const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
    const names = employees.map(employee => employee.name);
    for (const name of [
      'Kamal Silva',
      'Dilani Fernando',
      'Ruwani Jayawardena',
      'Suresh Kumar',
      'Tharindu Silva',
    ]) {
      expect(names).toContain(name);
    }
  });

  it('has exactly one user per role, with Nimal Perera as the admin', async () => {
    const users = await firstValueFrom(TestBed.inject(UserDataService).getAll());
    expect(users.map(user => user.role).sort()).toEqual(Object.values(UserRole).sort());
    const admin = users.find(user => user.role === UserRole.ADMIN);
    expect(admin?.displayName).toBe('Nimal Perera');
    expect(admin?.initials).toBe('NP');
  });

  it('has reload transactions in each status and a float above and below the low level', async () => {
    const reload = TestBed.inject(ReloadDataService);
    const transactions = await firstValueFrom(reload.getTransactions());
    expect(new Set(transactions.map(transaction => transaction.status))).toEqual(
      new Set(Object.values(ReloadStatus))
    );
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    const floats = await firstValueFrom(reload.getFloatHistory());
    expect(floats.some(entry => entry.availableCents > settings.lowFloatCents)).toBeTrue();
    expect(floats.some(entry => entry.availableCents < settings.lowFloatCents)).toBeTrue();
  });

  it('has the default settings values', async () => {
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    expect(settings.expiryAlertDays).toBe(60);
    expect(settings.lowFloatCents).toBe(1_000_000);
    expect(settings.defaultReorderLevel).toBe(20);
    expect(settings.showLowStockCountInSidebar).toBeTrue();
  });

  it('has the point of sale sample settings: no default discount, a 20 percent cap, sidebar hidden', async () => {
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    expect(settings.posLineDiscountEnabled).toBeTrue();
    expect(settings.posBillDiscountEnabled).toBeTrue();
    expect(settings.posDefaultDiscountPercent).toBe(0);
    expect(settings.posMaxDiscountPercent).toBe(20);
    expect(settings.posHideSidebar).toBeTrue();
  });

  it('has sample customers with one Walk-in Customer, sample reps and no sales or held bills yet', async () => {
    const sales = TestBed.inject(SalesDataService);
    const customers = await firstValueFrom(sales.getCustomers());
    expect(customers.filter(customer => customer.isWalkIn).map(customer => customer.name)).toEqual([
      'Walk-in Customer',
    ]);
    expect(customers.length).toBeGreaterThan(2);
    expect((await firstValueFrom(sales.getReps())).length).toBeGreaterThan(1);
    expect(await firstValueFrom(sales.getSales())).toEqual([]);
    expect(await firstValueFrom(sales.getHeldBills())).toEqual([]);
  });

  it('has the shop profile sample values', async () => {
    const settings = await firstValueFrom(TestBed.inject(SettingsDataService).get());
    expect(settings.shopName).toBe('ShopDesk');
    expect(settings.branchLabel).toBe('Main Shop');
    for (const value of [
      settings.registrationNo,
      settings.address,
      settings.phone,
      settings.email,
    ]) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('keeps a saved settings change for the session only', async () => {
    const settingsService = TestBed.inject(SettingsDataService);
    const settings = await firstValueFrom(settingsService.get());
    await firstValueFrom(settingsService.save({ ...settings, expiryAlertDays: 30 }));
    expect((await firstValueFrom(settingsService.get())).expiryAlertDays).toBe(30);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect((await firstValueFrom(TestBed.inject(SettingsDataService).get())).expiryAlertDays).toBe(
      60
    );
  });

  it('has leave types, entitlements and requests in every status across years', async () => {
    const service = TestBed.inject(LeaveDataService);
    const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
    const users = await firstValueFrom(TestBed.inject(UserDataService).getAll());
    const types = await firstValueFrom(service.getTypes());
    expect(types.map(type => type.name)).toEqual([
      'Annual Leave',
      'Carry Forward - Annual Leave',
      'Casual Leave',
      'Christmas Day',
      'Medical Leave',
    ]);
    const entitlements = await firstValueFrom(service.getEntitlements());
    expect(entitlements.length).toBe(employees.length * types.length * 3);
    const forEmployee = entitlements.filter(
      entitlement => entitlement.employeeId === 'emp-001' && entitlement.year === 2026
    );
    expect(forEmployee.map(entitlement => entitlement.days)).toEqual([14, 0, 7, 1, 7]);
    const requests = await firstValueFrom(service.getRequests());
    expect(new Set(requests.map(request => request.status))).toEqual(
      new Set(Object.values(LeaveStatus))
    );
    expect(new Set(requests.map(request => request.fromDate.slice(0, 4))).size).toBeGreaterThan(1);
    const approverRoles = new Set<string>([UserRole.ADMIN, UserRole.MANAGER]);
    for (const request of requests) {
      const approver = users.find(user => user.employeeId === request.approverEmployeeId);
      expect(approver && approverRoles.has(approver.role)).toBeTrue();
    }
  });

  it('saves a leave request as an upsert and returns copies', async () => {
    const service = TestBed.inject(LeaveDataService);
    const first = (await firstValueFrom(service.getRequests()))[0];
    first.comments = 'Changed';
    const stored = (await firstValueFrom(service.getRequests()))[0];
    expect(stored.comments).toBe('');
    await firstValueFrom(service.saveRequest({ ...stored, status: LeaveStatus.CANCELLED }));
    const after = await firstValueFrom(service.getRequests());
    expect(after.length).toBe(10);
    expect(after[0].status).toBe(LeaveStatus.CANCELLED);
  });

  it('has payroll settings, inputs, advances, nopay and payments covering the sample employees', async () => {
    const service = TestBed.inject(PayrollDataService);
    const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
    const settings = await firstValueFrom(service.getSettings());
    expect(settings.epfEmployeeRate).toBe(8);
    expect(settings.epfEmployerRate).toBe(12);
    expect(settings.etfEmployerRate).toBe(3);
    expect(settings.dailyRateDivisor).toBe(30);
    expect(settings.counters).toEqual(['Counter1', 'Counter2']);
    expect(settings.note.toLowerCase()).toContain('not payroll law');
    expect(settings.taxSlabs[settings.taxSlabs.length - 1].upToCents).toBeNull();

    const active = employees.filter(employee => employee.status !== EmployeeStatus.INACTIVE);
    expect(active.some(employee => employee.salaryType === SalaryType.DAILY)).toBeTrue();
    expect(
      active.some(employee => employee.basicSalaryCents === 0 && employee.allowances.length === 0)
    ).toBeTrue();
    expect(
      active.some(
        employee =>
          employee.salaryType === SalaryType.MONTHLY &&
          employee.basicSalaryCents + employee.allowances.reduce((s, a) => s + a.amountCents, 0) >
            (settings.taxSlabs[0].upToCents ?? 0)
      )
    ).toBeTrue();
    expect(active.some(employee => employee.calculateEpf && !employee.calculateEtf)).toBeTrue();
    expect(active.some(employee => !employee.calculateEpf && !employee.calculateEtf)).toBeTrue();

    const inputs = await firstValueFrom(service.getInputs());
    const payments = await firstValueFrom(service.getPayments());
    const months = new Set(inputs.map(input => input.month));
    expect(months.has(SAMPLE_TODAY.slice(0, 7))).toBeTrue();
    expect(months.size).toBeGreaterThan(2);
    for (const employee of active) {
      expect(inputs.filter(input => input.employeeId === employee.id).length).toBe(months.size);
      expect(payments.filter(payment => payment.employeeId === employee.id).length).toBe(
        months.size
      );
    }
    for (const payment of payments) {
      expect(payment.status).toBe(
        payment.month === SAMPLE_TODAY.slice(0, 7)
          ? PayrollPaymentStatus.UNPAID
          : PayrollPaymentStatus.PAID
      );
    }
    expect((await firstValueFrom(service.getAdvances())).length).toBeGreaterThan(0);
    expect((await firstValueFrom(service.getNopayEntries())).length).toBeGreaterThan(0);
  });

  it('saves payroll advances and nopay as upserts and returns copies', async () => {
    const service = TestBed.inject(PayrollDataService);
    const advance = (await firstValueFrom(service.getAdvances()))[0];
    advance.amountCents = 1;
    expect((await firstValueFrom(service.getAdvances()))[0].amountCents).not.toBe(1);
    const before = (await firstValueFrom(service.getAdvances())).length;
    await firstValueFrom(service.saveAdvance({ ...advance, id: 'adv-new' }));
    expect((await firstValueFrom(service.getAdvances())).length).toBe(before + 1);
    const nopayBefore = (await firstValueFrom(service.getNopayEntries())).length;
    const entry = (await firstValueFrom(service.getNopayEntries()))[0];
    await firstValueFrom(service.saveNopay({ ...entry, id: 'nop-new' }));
    expect((await firstValueFrom(service.getNopayEntries())).length).toBe(nopayBefore + 1);
    const settings = await firstValueFrom(service.getSettings());
    settings.epfEmployeeRate = 99;
    expect((await firstValueFrom(service.getSettings())).epfEmployeeRate).toBe(8);
  });
});
