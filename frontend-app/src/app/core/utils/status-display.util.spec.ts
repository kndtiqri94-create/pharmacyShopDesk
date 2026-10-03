import { GrnStatus } from '../models/enums/grn-status.enum';
import { PaymentStatus } from '../models/enums/payment-status.enum';
import { PoStatus } from '../models/enums/po-status.enum';
import { ProductStatus } from '../models/enums/product-status.enum';
import { ReloadStatus } from '../models/enums/reload-status.enum';
import {
  GRN_STATUS_DISPLAY,
  getActiveDisplay,
  PAYMENT_STATUS_DISPLAY,
  PO_STATUS_DISPLAY,
  PRODUCT_STATUS_DISPLAY,
  RELOAD_STATUS_DISPLAY,
} from './status-display.util';

describe('status-display.util', () => {
  it('uses the design status words and tones for products', () => {
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.IN_STOCK]).toEqual({
      label: 'In stock',
      tone: 'success',
    });
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.LOW_STOCK].tone).toBe('warning');
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.EXPIRING_SOON].label).toBe('Expiring soon');
    expect(PRODUCT_STATUS_DISPLAY[ProductStatus.OUT_OF_STOCK].tone).toBe('danger');
  });

  it('uses the design status words for GRN, payment, PO and reload', () => {
    expect(GRN_STATUS_DISPLAY[GrnStatus.DRAFT].tone).toBe('info');
    expect(PAYMENT_STATUS_DISPLAY[PaymentStatus.PART_PAID].label).toBe('Part paid');
    expect(PO_STATUS_DISPLAY[PoStatus.PART_RECEIVED].label).toBe('Part received');
    expect(RELOAD_STATUS_DISPLAY[ReloadStatus.PENDING].tone).toBe('warning');
  });

  it('never leaves a status without a word', () => {
    const all = [
      ...Object.values(PRODUCT_STATUS_DISPLAY),
      ...Object.values(GRN_STATUS_DISPLAY),
      ...Object.values(PAYMENT_STATUS_DISPLAY),
      ...Object.values(PO_STATUS_DISPLAY),
      ...Object.values(RELOAD_STATUS_DISPLAY),
    ];
    expect(all.every(display => display.label.length > 0)).toBeTrue();
  });

  it('shows an inactive product with a word and a neutral tone', () => {
    expect(getActiveDisplay(false)).toEqual({ label: 'Inactive', tone: 'neutral' });
    expect(getActiveDisplay(true).label).toBe('Active');
  });
});
