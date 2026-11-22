import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TEST_PROVIDERS } from '../../../testing/auth-test.util';
import { PayrollPaymentStatus } from '../models/enums/payroll-payment-status.enum';
import { defaultPayrollFilters } from '../utils/payroll-list.util';
import { PayrollService } from './payroll.service';

const FILTERS = defaultPayrollFilters('2026-09-21');

describe('PayrollService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: TEST_PROVIDERS }));

  const rows = (tab: 'monthly' | 'daily', filters = FILTERS) =>
    firstValueFrom(TestBed.inject(PayrollService).getPayrollRows(tab, filters));

  it('builds the Monthly rows for the current month without Inactive employees', async () => {
    const list = await rows('monthly');
    expect(list.map(row => row.employee.id)).toEqual([
      'emp-007',
      'emp-003',
      'emp-002',
      'emp-001',
      'emp-004',
    ]);
    const kamal = list.find(row => row.employee.id === 'emp-002');
    expect(kamal?.pay.grossCents).toBe(18910000);
    expect(kamal?.pay.paymentStatus).toBe(PayrollPaymentStatus.UNPAID);
  });

  it('lists the advances and approved leave of one employee for one month, read-only', async () => {
    const records = await firstValueFrom(
      TestBed.inject(PayrollService).getRecords('emp-004', '2026-09')
    );
    expect(records.advances.every(item => item.employeeId === 'emp-004')).toBeTrue();
    expect(records.advances.every(item => item.date.startsWith('2026-09'))).toBeTrue();
    expect(records.leaves.every(item => item.daysInMonth > 0)).toBeTrue();
  });

  it('builds the Daily rows with days worked', async () => {
    const list = await rows('daily');
    expect(list.map(row => row.employee.id)).toEqual(['emp-005', 'emp-006']);
    expect(list[0].pay.daysWorked).toBe(20);
    expect(list[0].pay.netCents).toBe(4880000);
  });

  it('uses the chosen month for inputs, advances, nopay and paid status', async () => {
    const list = await rows('monthly', { ...FILTERS, month: 8 });
    const dilani = list.find(row => row.employee.id === 'emp-003');
    expect(dilani?.pay.totalNopayCents).toBe(400000);
    expect(dilani?.pay.salaryAdvanceCents).toBe(1000000);
    expect(dilani?.pay.netCents).toBe(11823000);
    expect(dilani?.pay.paymentStatus).toBe(PayrollPaymentStatus.PAID);
  });

  it('defaults to Unpaid and zero inputs for a month with no records', async () => {
    const list = await rows('monthly', { ...FILTERS, year: 2027, month: 1 });
    expect(list.length).toBe(5);
    expect(list.every(row => row.pay.paymentStatus === PayrollPaymentStatus.UNPAID)).toBeTrue();
    expect(list.every(row => row.pay.overTimeCents === 0)).toBeTrue();
  });

  it('applies the keyword and location filters', async () => {
    expect((await rows('monthly', { ...FILTERS, keyword: 'nimal' })).length).toBe(1);
    expect(await rows('monthly', { ...FILTERS, location: 'Nowhere' })).toEqual([]);
  });

  it('lists the employee locations', async () => {
    const locations = await firstValueFrom(TestBed.inject(PayrollService).getLocations());
    expect(locations).toContain('Main Pharmacy');
  });
});
