import { BudgetRequestStatus } from '../../enums/budget-request-status.enum';

export class SearchBudgetRequestsDto {
  page: number = 1;
  pageSize: number = 10;
  departmentId?: number;
  fiscalYear?: number;
  requestedBy?: number;
  status?: BudgetRequestStatus;
  departmentManagerApprovedBy?: number;
  financeApprovedBy?: number;
}
