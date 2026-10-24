import { PosCustomer } from '../../../../models/domain/pos-customer.model';
import { SalesRep } from '../../../../models/domain/sales-rep.model';

export const WALK_IN_CUSTOMER_ID = 'cus-001';

export const POS_CUSTOMER_SEED: readonly PosCustomer[] = [
  { id: WALK_IN_CUSTOMER_ID, name: 'Walk-in Customer', isWalkIn: true },
  { id: 'cus-002', name: 'Sunil Rathnayake', isWalkIn: false },
  { id: 'cus-003', name: 'Anusha Wickramasinghe', isWalkIn: false },
  { id: 'cus-004', name: 'Galle Road Clinic', isWalkIn: false },
  { id: 'cus-005', name: 'Nadeesha Gunasekara', isWalkIn: false },
  { id: 'cus-006', name: 'Ravi Selvarajah', isWalkIn: false },
];

export const SALES_REP_SEED: readonly SalesRep[] = [
  { id: 'rep-001', name: 'Kamal Silva' },
  { id: 'rep-002', name: 'Dilani Fernando' },
  { id: 'rep-003', name: 'Ruwani Jayawardena' },
  { id: 'rep-004', name: 'Suresh Kumar' },
  { id: 'rep-005', name: 'Tharindu Silva' },
];
