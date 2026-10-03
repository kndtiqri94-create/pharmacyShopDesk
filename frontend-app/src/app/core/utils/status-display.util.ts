import { EmployeeStatus } from '../models/enums/employee-status.enum';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import { SyncState } from '../models/enums/sync-state.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { StatusDisplay } from '../models/shared/status-display.model';

export const PRODUCT_STATUS_DISPLAY: Record<ProductStatus, StatusDisplay> = {
  IN_STOCK: { label: 'In stock', tone: 'success' },
  LOW_STOCK: { label: 'Low stock', tone: 'warning' },
  EXPIRING_SOON: { label: 'Expiring soon', tone: 'warning' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
};

export const GRN_STATUS_DISPLAY: Record<GrnStatus, StatusDisplay> = {
  DRAFT: { label: 'Draft', tone: 'info' },
  RECEIVED: { label: 'Received', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const PAYMENT_STATUS_DISPLAY: Record<PaymentStatus, StatusDisplay> = {
  PAID: { label: 'Paid', tone: 'success' },
  PART_PAID: { label: 'Part paid', tone: 'info' },
  UNPAID: { label: 'Unpaid', tone: 'warning' },
};

export const PO_STATUS_DISPLAY: Record<PoStatus, StatusDisplay> = {
  DRAFT: { label: 'Draft', tone: 'info' },
  SENT: { label: 'Sent', tone: 'warning' },
  PART_RECEIVED: { label: 'Part received', tone: 'info' },
  RECEIVED: { label: 'Received', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const RELOAD_STATUS_DISPLAY: Record<ReloadStatus, StatusDisplay> = {
  SUCCESS: { label: 'Success', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

export const EMPLOYEE_STATUS_DISPLAY: Record<EmployeeStatus, StatusDisplay> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  ON_LEAVE: { label: 'On leave', tone: 'warning' },
};

export const USER_STATUS_DISPLAY: Record<UserStatus, StatusDisplay> = {
  ACTIVE: { label: 'Active', tone: 'success' },
  DISABLED: { label: 'Disabled', tone: 'neutral' },
};

export const SYNC_STATE_DISPLAY: Record<SyncState, StatusDisplay> = {
  ONLINE: { label: 'Online', tone: 'success' },
  SYNCING: { label: 'Syncing', tone: 'info' },
  OFFLINE: { label: 'Offline', tone: 'warning' },
};

export function getActiveDisplay(active: boolean): StatusDisplay {
  return active ? { label: 'Active', tone: 'success' } : { label: 'Inactive', tone: 'neutral' };
}
