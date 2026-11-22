export const EmployeeTitle = {
  MR: 'Mr.',
  MRS: 'Mrs.',
  MS: 'Ms.',
  MISS: 'Miss',
  DR: 'Dr.',
} as const;

export type EmployeeTitle = (typeof EmployeeTitle)[keyof typeof EmployeeTitle];

export const EMPLOYEE_TITLES: readonly EmployeeTitle[] = Object.values(EmployeeTitle);
