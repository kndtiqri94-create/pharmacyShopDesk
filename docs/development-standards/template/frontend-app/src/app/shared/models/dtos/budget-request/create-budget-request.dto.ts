import { BudgetRequestStatus } from '../../enums/budget-request-status.enum';

export class CreateBudgetRequestDto {
  id?: number;
  departmentId!: number;
  fiscalYear!: number;
  requestedBy!: number;
  status!: BudgetRequestStatus;
  departmentManagerApprovedBy?: number;
  departmentManagerApprovedAt?: Date;
  requestAuditLogs?: string;
  monthlyRequests!: CreateMonthlyBudgetRequestDto[];
}

export class CreateMonthlyBudgetRequestDto {
  id?: number;
  budgetSubCategoryId!: number;
  requestedAmount!: number;
  reason!: string;
  month!: number;
}
