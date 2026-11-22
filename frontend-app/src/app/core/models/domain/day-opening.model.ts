export interface OpeningChange {
  oldCents: number;
  newCents: number;
  byUserId: string;
  by: string;
  at: string;
}

export interface DayOpening {
  date: string;
  amountCents: number;
  setByUserId: string;
  setBy: string;
  setAt: string;
  changeLog: OpeningChange[];
}
