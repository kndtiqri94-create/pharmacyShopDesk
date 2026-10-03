import { ReloadStatus } from '../enums/reload-status.enum';
import { ReloadTransactionType } from '../enums/reload-transaction-type.enum';

export interface ReloadTransaction {
  id: string;
  occurredAt: string;
  provider: string;
  type: ReloadTransactionType;
  reference: string;
  amountCents: number;
  commissionCents: number;
  status: ReloadStatus;
}
