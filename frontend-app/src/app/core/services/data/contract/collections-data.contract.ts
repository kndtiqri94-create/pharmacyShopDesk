import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AttendanceDataService } from '../attendance-data.service';
import { BankAccountDataService } from '../bank-account-data.service';
import { DuplicateBankAccountError } from '../duplicate-bank-account.error';
import { EmployeeDataService } from '../employee-data.service';
import { GrnDataService } from '../grn-data.service';
import { LeaveDataService } from '../leave-data.service';
import { PayrollDataService } from '../payroll-data.service';
import { PurchaseOrderDataService } from '../purchase-order-data.service';
import { SettingsDataService } from '../settings-data.service';
import { SupplierDataService } from '../supplier-data.service';
import { SupplierPaymentDataService } from '../supplier-payment-data.service';
import { UserDataService } from '../user-data.service';

export function describeCollectionsDataContract(label: string, providers: () => Provider[]): void {
  describe(label, () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: providers() }));

    describe('suppliers', () => {
      it('adds, edits and finds a supplier by id', async () => {
        const service = TestBed.inject(SupplierDataService);
        const before = await firstValueFrom(service.getAll());
        await firstValueFrom(service.save({ ...before[0], name: 'Renamed Supplier' }));
        await firstValueFrom(service.save({ ...before[0], id: 'sup-new', name: 'Brand New' }));
        const after = await firstValueFrom(service.getAll());
        expect(after).toHaveSize(before.length + 1);
        expect(after[0].name).toBe('Renamed Supplier');
        expect(after.at(-1)?.id).toBe('sup-new');
        expect((await firstValueFrom(service.getById('sup-new')))?.name).toBe('Brand New');
        expect(await firstValueFrom(service.getById('missing'))).toBeNull();
      });
    });

    describe('goods received notes and purchase orders', () => {
      it('keeps a saved GRN and returns copies', async () => {
        const service = TestBed.inject(GrnDataService);
        const first = (await firstValueFrom(service.getAll()))[0];
        await firstValueFrom(service.save({ ...first, invoiceNo: 'INV-CHECKED' }));
        const stored = (await firstValueFrom(service.getById(first.id)))!;
        expect(stored.invoiceNo).toBe('INV-CHECKED');
        stored.invoiceNo = 'CHANGED';
        expect((await firstValueFrom(service.getById(first.id)))?.invoiceNo).toBe('INV-CHECKED');
      });

      it('keeps a saved purchase order', async () => {
        const service = TestBed.inject(PurchaseOrderDataService);
        const first = (await firstValueFrom(service.getAll()))[0];
        await firstValueFrom(service.save({ ...first, notes: 'Call before delivery' }));
        expect((await firstValueFrom(service.getById(first.id)))?.notes).toBe(
          'Call before delivery'
        );
      });

      it('keeps a saved supplier payment', async () => {
        const service = TestBed.inject(SupplierPaymentDataService);
        const before = await firstValueFrom(service.getAll());
        await firstValueFrom(service.save({ ...before[0], id: 'spay-new' }));
        const after = await firstValueFrom(service.getAll());
        expect(after).toHaveSize(before.length + 1);
        expect(after.at(-1)?.id).toBe('spay-new');
      });
    });

    describe('employees, attendance, leave and payroll', () => {
      it('saves, finds and deletes an employee', async () => {
        const service = TestBed.inject(EmployeeDataService);
        const first = (await firstValueFrom(service.getAll()))[0];
        const saved = await firstValueFrom(service.save({ ...first, id: 'emp-new' }));
        expect(saved.id).toBe('emp-new');
        expect((await firstValueFrom(service.getById('emp-new')))?.id).toBe('emp-new');
        expect(await firstValueFrom(service.delete('emp-new'))).toBeTrue();
        expect(await firstValueFrom(service.delete('emp-new'))).toBeFalse();
        expect(await firstValueFrom(service.getById('emp-new'))).toBeNull();
      });

      it('lists attendance for the asked date only', async () => {
        const service = TestBed.inject(AttendanceDataService);
        const employees = await firstValueFrom(TestBed.inject(EmployeeDataService).getAll());
        expect(employees.length).toBeGreaterThan(0);
        const date = '2026-09-21';
        const records = await firstValueFrom(service.getForDate(date));
        expect(records.length).toBeGreaterThan(0);
        expect(records.every(record => record.date === date)).toBeTrue();
        expect(await firstValueFrom(service.getForDate('1999-01-01'))).toEqual([]);
      });

      it('keeps a saved leave request', async () => {
        const service = TestBed.inject(LeaveDataService);
        const before = await firstValueFrom(service.getRequests());
        await firstValueFrom(service.saveRequest({ ...before[0], id: 'lreq-new' }));
        const after = await firstValueFrom(service.getRequests());
        expect(after).toHaveSize(before.length + 1);
        expect(after.at(-1)?.id).toBe('lreq-new');
      });

      it('keeps saved salary advances and nopay entries', async () => {
        const service = TestBed.inject(PayrollDataService);
        const advances = await firstValueFrom(service.getAdvances());
        const nopay = await firstValueFrom(service.getNopayEntries());
        await firstValueFrom(service.saveAdvance({ ...advances[0], id: 'adv-new' }));
        await firstValueFrom(service.saveNopay({ ...nopay[0], id: 'nop-new' }));
        expect(await firstValueFrom(service.getAdvances())).toHaveSize(advances.length + 1);
        expect(await firstValueFrom(service.getNopayEntries())).toHaveSize(nopay.length + 1);
        expect((await firstValueFrom(service.getSettings())).taxSlabs.length).toBeGreaterThan(0);
        expect((await firstValueFrom(service.getInputs())).length).toBeGreaterThan(0);
        expect((await firstValueFrom(service.getPayments())).length).toBeGreaterThan(0);
      });
    });

    describe('bank accounts', () => {
      it('adds an account and refuses the same bank and account number again', async () => {
        const service = TestBed.inject(BankAccountDataService);
        const before = await firstValueFrom(service.getAll());
        const added = await firstValueFrom(
          service.create({ ...before[0], id: 'bank-new', accountNo: '99887766' })
        );
        expect(added.id).toBe('bank-new');
        await expectAsync(
          firstValueFrom(service.create({ ...before[0], id: 'bank-other', accountNo: '99887766' }))
        ).toBeRejectedWithError(DuplicateBankAccountError);
        expect(await firstValueFrom(service.getAll())).toHaveSize(before.length + 1);
      });

      it('allows the same account number at a different bank', async () => {
        const service = TestBed.inject(BankAccountDataService);
        const first = (await firstValueFrom(service.getAll()))[0];
        const added = await firstValueFrom(
          service.create({ ...first, id: 'bank-other-bank', bank: 'Another Bank' })
        );
        expect(added.id).toBe('bank-other-bank');
      });
    });

    describe('settings and users', () => {
      it('keeps saved settings', async () => {
        const service = TestBed.inject(SettingsDataService);
        const settings = await firstValueFrom(service.get());
        await firstValueFrom(service.save({ ...settings, shopName: 'Corner Pharmacy' }));
        expect((await firstValueFrom(service.get())).shopName).toBe('Corner Pharmacy');
      });

      it('saves a user and finds them by id and username', async () => {
        const service = TestBed.inject(UserDataService);
        const first = (await firstValueFrom(service.getAll()))[0];
        await firstValueFrom(service.save({ ...first, displayName: 'Changed Name' }));
        expect((await firstValueFrom(service.getById(first.id)))?.displayName).toBe('Changed Name');
        expect((await firstValueFrom(service.getByUsername(first.username)))?.id).toBe(first.id);
      });
    });
  });
}
