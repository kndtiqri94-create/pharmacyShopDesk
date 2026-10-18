import { AppUser } from '../models/domain/app-user.model';
import { Employee } from '../models/domain/employee.model';

export function hasLinkedUser(employee: Employee, users: readonly AppUser[]): boolean {
  return employee.userId !== null || users.some(user => user.employeeId === employee.id);
}

export function hasHistory(
  employee: Employee,
  users: readonly AppUser[],
  payrollEmployeeIds: readonly string[] = []
): boolean {
  return hasLinkedUser(employee, users) || payrollEmployeeIds.includes(employee.id);
}
