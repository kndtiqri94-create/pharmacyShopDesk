import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { GrnStatus } from '../../../models/enums/grn-status.enum';
import { PaymentStatus } from '../../../models/enums/payment-status.enum';
import { PoStatus } from '../../../models/enums/po-status.enum';
import { ReloadStatus } from '../../../models/enums/reload-status.enum';
import { UserRole } from '../../../models/enums/user-role.enum';
import { isPurchaseOrderOverdue } from '../../../utils/purchase-order-overdue.util';
import { SAMPLE_TODAY } from '../../clock.service';
import { provideDataServices } from '../data-providers';
import { EmployeeDataService } from '../employee-data.service';
import { GrnDataService } from '../grn-data.service';
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { ReloadDataService } from '../reload-data.service';
import { SettingsDataService } from '../settings-data.service';
import { SupplierDataService } from '../supplier-data.service';
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
    expect(suppliers.some(supplier => supplier.outstandingCents > 0)).toBeTrue();
    expect(suppliers.some(supplier => !supplier.active)).toBeTrue();
    expect(suppliers.map(supplier => supplier.name)).toEqual([
      'Lanka Pharma',
      'City Medicals',
      'Health Plus Ltd',
      'MediCare Distributors',
      'Ceylon Surgical',
    ]);
    const owing = suppliers.reduce((total, supplier) => total + supplier.outstandingCents, 0);
    expect(owing).toBe(14_260_000);
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
