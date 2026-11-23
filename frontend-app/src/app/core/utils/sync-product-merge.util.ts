import { Product } from '../models/domain/product.model';

export function mergePulledProduct(local: Product | undefined, server: Product): Product {
  if (local === undefined) return server;
  const localQuantities = new Map(local.batches.map(batch => [batch.id, batch.quantity]));
  return {
    ...server,
    stockOnHand: local.stockOnHand,
    batches: server.batches.map(batch => ({
      ...batch,
      quantity: localQuantities.get(batch.id) ?? batch.quantity,
    })),
  };
}
