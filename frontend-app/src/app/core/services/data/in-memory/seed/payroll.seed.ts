import { NopayEntry } from '../../../../models/domain/nopay-entry.model';
import { PayrollInput } from '../../../../models/domain/payroll-input.model';
import { PayrollPayment } from '../../../../models/domain/payroll-payment.model';
import { PayrollSettings } from '../../../../models/domain/payroll-settings.model';
import { SalaryAdvance } from '../../../../models/domain/salary-advance.model';
import { PayrollPaymentStatus } from '../../../../models/enums/payroll-payment-status.enum';

export const PAYROLL_CURRENT_MONTH = '2026-09';

export const PAYROLL_SETTINGS_SEED: PayrollSettings = {
  epfEmployeeRate: 8,
  epfEmployerRate: 12,
  etfEmployerRate: 3,
  taxSlabs: [
    { upToCents: 10000000, rate: 0 },
    { upToCents: 15000000, rate: 6 },
    { upToCents: 20000000, rate: 12 },
    { upToCents: null, rate: 18 },
  ],
  dailyRateDivisor: 30,
  counters: ['Counter1', 'Counter2'],
  note: 'Sample values, not payroll law.',
};

const ACTIVE_EMPLOYEE_IDS = [
  'emp-001',
  'emp-002',
  'emp-003',
  'emp-004',
  'emp-005',
  'emp-006',
  'emp-007',
];
const MONTHS = ['2026-06', '2026-07', '2026-08', PAYROLL_CURRENT_MONTH];

interface InputSample {
  overtimeHours: number;
  commissionBaseCents: number;
  daysWorked: number;
}

const NONE: InputSample = { overtimeHours: 0, commissionBaseCents: 0, daysWorked: 0 };

const INPUT_SAMPLES: Record<string, readonly InputSample[]> = {
  'emp-001': [NONE, NONE, NONE, NONE],
  'emp-002': [
    { overtimeHours: 6, commissionBaseCents: 40000000, daysWorked: 0 },
    { overtimeHours: 8, commissionBaseCents: 52000000, daysWorked: 0 },
    { overtimeHours: 4, commissionBaseCents: 61000000, daysWorked: 0 },
    { overtimeHours: 10, commissionBaseCents: 58000000, daysWorked: 0 },
  ],
  'emp-003': [
    { overtimeHours: 5, commissionBaseCents: 0, daysWorked: 0 },
    NONE,
    { overtimeHours: 7.5, commissionBaseCents: 0, daysWorked: 0 },
    { overtimeHours: 12, commissionBaseCents: 0, daysWorked: 0 },
  ],
  'emp-004': [
    { overtimeHours: 3, commissionBaseCents: 0, daysWorked: 0 },
    { overtimeHours: 2, commissionBaseCents: 0, daysWorked: 0 },
    NONE,
    { overtimeHours: 4.5, commissionBaseCents: 0, daysWorked: 0 },
  ],
  'emp-005': [
    { overtimeHours: 0, commissionBaseCents: 9000000, daysWorked: 22 },
    { overtimeHours: 0, commissionBaseCents: 11000000, daysWorked: 24 },
    { overtimeHours: 0, commissionBaseCents: 8500000, daysWorked: 21 },
    { overtimeHours: 0, commissionBaseCents: 10000000, daysWorked: 20 },
  ],
  'emp-006': [
    { overtimeHours: 0, commissionBaseCents: 0, daysWorked: 20 },
    { overtimeHours: 0, commissionBaseCents: 0, daysWorked: 23 },
    { overtimeHours: 0, commissionBaseCents: 0, daysWorked: 22 },
    { overtimeHours: 0, commissionBaseCents: 0, daysWorked: 18 },
  ],
  'emp-007': [NONE, NONE, NONE, NONE],
};

export const PAYROLL_INPUT_SEED: readonly PayrollInput[] = ACTIVE_EMPLOYEE_IDS.flatMap(employeeId =>
  MONTHS.map((month, index) => ({
    id: `pin-${employeeId}-${month}`,
    employeeId,
    month,
    ...INPUT_SAMPLES[employeeId][index],
  }))
);

export const SALARY_ADVANCE_SEED: readonly SalaryAdvance[] = [
  {
    id: 'adv-001',
    employeeId: 'emp-003',
    counter: 'Counter1',
    date: '2026-08-12',
    amountCents: 1000000,
    createdAt: '2026-08-12T10:00:00.000Z',
  },
  {
    id: 'adv-002',
    employeeId: 'emp-004',
    counter: 'Counter2',
    date: '2026-09-08',
    amountCents: 500000,
    createdAt: '2026-09-08T11:30:00.000Z',
  },
  {
    id: 'adv-003',
    employeeId: 'emp-005',
    counter: 'Counter1',
    date: '2026-09-15',
    amountCents: 300000,
    createdAt: '2026-09-15T09:15:00.000Z',
  },
  {
    id: 'adv-004',
    employeeId: 'emp-002',
    counter: 'Counter2',
    date: '2026-07-20',
    amountCents: 2000000,
    createdAt: '2026-07-20T14:00:00.000Z',
  },
];

export const NOPAY_SEED: readonly NopayEntry[] = [
  {
    id: 'nop-001',
    employeeId: 'emp-004',
    date: '2026-09-03',
    amountCents: 250000,
    reason: 'Unpaid absence',
    createdAt: '2026-09-03T16:00:00.000Z',
  },
  {
    id: 'nop-002',
    employeeId: 'emp-003',
    date: '2026-08-18',
    amountCents: 400000,
    reason: 'Late arrivals',
    createdAt: '2026-08-18T16:30:00.000Z',
  },
  {
    id: 'nop-003',
    employeeId: 'emp-006',
    date: '2026-09-10',
    amountCents: 120000,
    reason: 'Short shift',
    createdAt: '2026-09-10T18:00:00.000Z',
  },
];

export const PAYROLL_PAYMENT_SEED: readonly PayrollPayment[] = ACTIVE_EMPLOYEE_IDS.flatMap(
  employeeId =>
    MONTHS.map(month => ({
      id: `pay-${employeeId}-${month}`,
      employeeId,
      month,
      status:
        month === PAYROLL_CURRENT_MONTH ? PayrollPaymentStatus.UNPAID : PayrollPaymentStatus.PAID,
    }))
);
