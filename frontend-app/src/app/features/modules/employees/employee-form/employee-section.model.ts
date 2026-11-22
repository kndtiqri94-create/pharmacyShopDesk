import { EmployeeFormInput } from '../../../../core/utils/employee-validation.util';

export type EmployeeDraftPatch = Partial<EmployeeFormInput>;

export const EMPLOYEE_FIELD_ID_PREFIX = 'employee-';

export function employeeFieldId(key: string): string {
  return `${EMPLOYEE_FIELD_ID_PREFIX}${key}`;
}

export function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}
