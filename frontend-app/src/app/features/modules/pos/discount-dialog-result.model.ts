import { DiscountApproval } from '../../../core/models/domain/discount-approval.model';

export type DiscountDialogResult =
  { kind: 'APPROVED'; approval: DiscountApproval } | { kind: 'REJECTED'; message: string };
