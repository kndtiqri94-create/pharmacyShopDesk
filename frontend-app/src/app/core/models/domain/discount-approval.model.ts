import { DiscountScope } from '../enums/discount-scope.enum';

export interface DiscountApproval {
  scope: DiscountScope;
  productId: string | null;
  percent: number;
  approverUserId: string;
  approverName: string;
  approvedAt: string;
}
