export interface BilingualLabel {
  english: string;
  sinhala: string;
}

/** The only labels on this screen that carry Sinhala (AC-74). Every other label is English only. */
export const COUNTER_CLOSE_LABELS = {
  shiftSummary: {
    english: 'Shift Summary',
    sinhala: 'සාරාංශය',
  },
  salesBreakdown: {
    english: 'Sales Breakdown',
    sinhala: 'විකුණුම් විස්තරය',
  },
  cashCount: {
    english: 'Cash Count',
    sinhala: 'මුදල් ගණන',
  },
  expectedCash: {
    english: 'Expected Cash',
    sinhala: 'අපේක්ෂිත මුදල් ප්‍රමාණය',
  },
  countedCash: {
    english: 'Count all cash in drawer',
    sinhala: 'ලාච්චුවේ ඇති මුදල්',
  },
  handover: {
    english: 'Cash Handover to Supervisor',
    sinhala: 'අධීක්ෂකට බාරදුන් මුදල්',
  },
  broughtForward: {
    english: 'BF (Brought Forward) Balance for Next Shift',
    sinhala: 'ඉදිරි සැසිය සඳහා ඉදිරියට ගෙනා ශේෂය',
  },
  reconciliation: {
    english: 'Cash Reconciliation',
    sinhala: 'මුදල් ගැලපුම් පරීක්ෂාව',
  },
} as const satisfies Record<string, BilingualLabel>;

export function bilingualText(label: BilingualLabel): string {
  return `${label.english} (${label.sinhala})`;
}
