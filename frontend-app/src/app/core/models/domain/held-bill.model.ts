import { Bill } from './bill.model';

export interface HeldBill {
  id: string;
  holdNo: string;
  heldAt: string;
  customerName: string;
  itemCount: number;
  totalCents: number;
  bill: Bill;
}
