import { CashEntryKind } from '../enums/cash-entry-kind.enum';

export type CashDirection = 'IN' | 'OUT';

export interface CashEntry {
  id: string;
  date: string;
  time: string;
  createdAt: string;
  kind: CashEntryKind;
  direction: CashDirection;
  amountCents: number;
  description: string;
  refId: string;
}
