import { EmployeeStatus } from '../enums/employee-status.enum';

export interface Employee {
  id: string;
  code: string;
  name: string;
  jobTitle: string;
  phone: string;
  shift: string;
  employmentType: string;
  status: EmployeeStatus;
  userId: string | null;
}
