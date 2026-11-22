export interface CounterReport {
  date: string;
  register: string;
  startTime: string | null;
  endTime: string;
  totalSalesCents: number;
  openingCents: number;
  cashInCents: number;
  cashOutCents: number;
  expectedCents: number;
  countedCents: number;
  differenceCents: number;
  handoverCents: number;
  supervisorUserId: string | null;
  supervisorName: string | null;
  broughtForwardCents: number;
  unaccountedCents: number;
  note: string;
  closedByUserId: string;
  closedBy: string;
  closedAt: string;
  locked: true;
}
