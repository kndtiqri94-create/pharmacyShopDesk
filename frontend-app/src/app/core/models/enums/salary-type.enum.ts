export const SalaryType = {
  MONTHLY: 'MONTHLY',
  DAILY: 'DAILY',
} as const;

export type SalaryType = (typeof SalaryType)[keyof typeof SalaryType];
