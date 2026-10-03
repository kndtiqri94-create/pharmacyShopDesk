import { ReloadFloat } from '../../../../models/domain/reload-float.model';
import { ReloadTransaction } from '../../../../models/domain/reload-transaction.model';
import { ReloadStatus } from '../../../../models/enums/reload-status.enum';
import { ReloadTransactionType } from '../../../../models/enums/reload-transaction-type.enum';

export const RELOAD_TRANSACTION_SEED: readonly ReloadTransaction[] = [
  {
    id: 'rt-001',
    occurredAt: '2026-09-21T09:12:00',
    provider: 'Dialog',
    type: ReloadTransactionType.RELOAD,
    reference: '077 123 4567',
    amountCents: 50_000,
    commissionCents: 1250,
    status: ReloadStatus.SUCCESS,
  },
  {
    id: 'rt-002',
    occurredAt: '2026-09-21T09:40:00',
    provider: 'Mobitel',
    type: ReloadTransactionType.RELOAD,
    reference: '071 555 0101',
    amountCents: 20_000,
    commissionCents: 500,
    status: ReloadStatus.SUCCESS,
  },
  {
    id: 'rt-003',
    occurredAt: '2026-09-21T10:05:00',
    provider: 'Electricity (CEB)',
    type: ReloadTransactionType.BILL_PAYMENT,
    reference: 'Account 0123456789',
    amountCents: 450_000,
    commissionCents: 1500,
    status: ReloadStatus.SUCCESS,
  },
  {
    id: 'rt-004',
    occurredAt: '2026-09-21T10:30:00',
    provider: 'Hutch',
    type: ReloadTransactionType.RELOAD,
    reference: '078 222 3344',
    amountCents: 10_000,
    commissionCents: 250,
    status: ReloadStatus.PENDING,
  },
  {
    id: 'rt-005',
    occurredAt: '2026-09-21T10:52:00',
    provider: 'Airtel',
    type: ReloadTransactionType.RELOAD,
    reference: '075 888 9900',
    amountCents: 100_000,
    commissionCents: 2500,
    status: ReloadStatus.FAILED,
  },
];

export const RELOAD_FLOAT_SEED: readonly ReloadFloat[] = [
  {
    date: '2026-09-19',
    availableCents: 1_840_000,
    reloadsCount: 41,
    billsCount: 7,
    commissionCents: 131_000,
  },
  {
    date: '2026-09-20',
    availableCents: 1_230_000,
    reloadsCount: 44,
    billsCount: 8,
    commissionCents: 142_500,
  },
  {
    date: '2026-09-21',
    availableCents: 620_000,
    reloadsCount: 38,
    billsCount: 9,
    commissionCents: 124_000,
  },
];
