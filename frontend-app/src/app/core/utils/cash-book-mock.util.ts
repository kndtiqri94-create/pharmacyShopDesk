export interface CashBookMockFigures {
  totalExpensesCents: number;
  advanceSalaryCents: number;
  employeeLoanSettlementCents: number;
  incomesCents: number;
  grnsCents: number;
  grnReturnsCents: number;
  cashBackCents: number;
  bankDepositCents: number;
}

export const ZERO_MOCK_FIGURES: CashBookMockFigures = {
  totalExpensesCents: 0,
  advanceSalaryCents: 0,
  employeeLoanSettlementCents: 0,
  incomesCents: 0,
  grnsCents: 0,
  grnReturnsCents: 0,
  cashBackCents: 0,
  bankDepositCents: 0,
};

const MOCK_STEP_CENTS = 25_000;

function seedOf(date: string): number {
  return [...date].reduce((total, char) => total + (char.codePointAt(0) ?? 0), 0);
}

function pick(seed: number, base: number, spread: number): number {
  return (base + (seed % spread)) * MOCK_STEP_CENTS;
}

export function mockFiguresForDay(date: string): CashBookMockFigures {
  const seed = seedOf(date);
  return {
    totalExpensesCents: pick(seed, 4, 5),
    advanceSalaryCents: pick(seed + 1, 2, 4),
    employeeLoanSettlementCents: pick(seed + 2, 1, 3),
    incomesCents: pick(seed + 3, 3, 4),
    grnsCents: pick(seed + 4, 8, 6),
    grnReturnsCents: pick(seed + 5, 1, 2),
    cashBackCents: pick(seed + 6, 1, 2),
    bankDepositCents: pick(seed + 7, 6, 5),
  };
}

export function mockFiguresForDays(dates: readonly string[]): CashBookMockFigures {
  return dates.reduce<CashBookMockFigures>((total, date) => {
    const day = mockFiguresForDay(date);
    return {
      totalExpensesCents: total.totalExpensesCents + day.totalExpensesCents,
      advanceSalaryCents: total.advanceSalaryCents + day.advanceSalaryCents,
      employeeLoanSettlementCents:
        total.employeeLoanSettlementCents + day.employeeLoanSettlementCents,
      incomesCents: total.incomesCents + day.incomesCents,
      grnsCents: total.grnsCents + day.grnsCents,
      grnReturnsCents: total.grnReturnsCents + day.grnReturnsCents,
      cashBackCents: total.cashBackCents + day.cashBackCents,
      bankDepositCents: total.bankDepositCents + day.bankDepositCents,
    };
  }, ZERO_MOCK_FIGURES);
}
