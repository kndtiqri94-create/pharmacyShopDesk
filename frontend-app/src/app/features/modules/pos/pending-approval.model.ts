import { BillDiscountInput } from '../../../core/models/domain/bill-discount.model';
import { DiscountChangeRequest } from '../../../core/services/pos-discount-approval.service';

export interface PendingApproval {
  request: DiscountChangeRequest;
  billInput: BillDiscountInput | null;
}
