import { StockMovementType } from '../enums/stock-movement-type.enum';

export interface StockMovement {
  id: string;
  seq: number;
  productId: string;
  batchId: string;
  type: StockMovementType;
  qtyDelta: number;
  refId: string | null;
  userId: string | null;
  deviceCode: string;
  createdAt: string;
}

export interface StockChangeContext {
  type: StockMovementType;
  refId?: string | null;
  userId?: string | null;
}
