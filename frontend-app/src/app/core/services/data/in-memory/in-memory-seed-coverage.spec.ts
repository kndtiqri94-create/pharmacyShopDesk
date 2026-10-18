import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AttendanceStatus } from '../../../models/enums/attendance-status.enum';
import { EmployeeStatus } from '../../../models/enums/employee-status.enum';
import { SalaryType } from '../../../models/enums/salary-type.enum';
import { GrnStatus } from '../../../models/enums/grn-status.enum';
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
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { ReloadDataService } from '../reload-data.service';
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

  it('has attendance for today for every employee, one leave record and seeded payments', async () => {
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
    const leave = await firstValueFrom(TestBed.inject(LeaveDataService).getAll());
    expect(leave.map(record => record.employeeId)).toEqual(['emp-007']);
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
});
