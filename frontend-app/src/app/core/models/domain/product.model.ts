import { Batch } from './batch.model';

export interface Product {
  id: string;
  name: string;
  genericName: string;
  category: string;
  form: string;
  unit: string;
  sku: string;
  barcode: string;
  manufacturer: string;
  costCents: number;
  priceCents: number;
  reorderLevel: number;
  trackBatches: boolean;
  stockOnHand: number;
  prescriptionRequired: boolean;
  active: boolean;
  taxRatePercent: number;
  shelfLocation: string;
  showInPosQuickList: boolean;
  batches: Batch[];
}
