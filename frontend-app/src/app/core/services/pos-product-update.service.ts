import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/domain/product.model';
import { ProductAdjustment } from '../models/domain/product-adjustment.model';
import { nextRecordId } from '../utils/document-number.util';
import { searchProducts } from '../utils/pos-search.util';
import {
  NOTHING_CHANGED_MESSAGE,
  ProductUpdateDiff,
  applyProductUpdate,
  diffProductUpdate,
  validateProductUpdate,
} from '../utils/pos-product-update.util';
import { ClockService } from './clock.service';
import { ProductDataService } from './data/product-data.service';
import { SalesDataService } from './data/sales-data.service';
import { PosFailureResult } from './pos-sale.service';
import { PosWriteGuard, posFailure } from './pos-write-guard.service';

export type ProductUpdateResult =
  | { ok: true; product: Product; adjustment: ProductAdjustment; diff: ProductUpdateDiff }
  | PosFailureResult;

const DENIED_MESSAGE = 'You do not have access to change products at the till.';

@Injectable({ providedIn: 'root' })
export class PosProductUpdateService {
  private readonly clockService = inject(ClockService);
  private readonly productDataService = inject(ProductDataService);
  private readonly salesDataService = inject(SalesDataService);
  private readonly writeGuard = inject(PosWriteGuard);

  async search(text: string): Promise<Product[]> {
    return searchProducts(await firstValueFrom(this.productDataService.getAll()), text);
  }

  save(
    productId: string,
    priceText: string,
    stockText: string,
    confirmed: boolean
  ): Promise<ProductUpdateResult> {
    return this.writeGuard.run('pos-stock', DENIED_MESSAGE, async user => {
      const validation = validateProductUpdate(priceText, stockText);
      const firstError = validation.errors.price ?? validation.errors.stock;
      if (validation.values === null) return posFailure('invalid', firstError ?? '');
      const product = await firstValueFrom(this.productDataService.getById(productId));
      if (product === null) return posFailure('not-found', 'That product is no longer there.');
      const diff = diffProductUpdate(product, validation.values);
      if (!diff.priceChanged && !diff.stockChanged) {
        return posFailure('invalid', NOTHING_CHANGED_MESSAGE);
      }
      if (!confirmed) return posFailure('invalid', 'Confirm the change to save it.');
      const updated = applyProductUpdate(product, validation.values, this.clockService.today());
      const adjustments = await firstValueFrom(this.salesDataService.getProductAdjustments());
      const adjustment: ProductAdjustment = {
        id: nextRecordId(
          'adj',
          adjustments.map(existing => existing.id)
        ),
        productId: product.id,
        productName: product.name,
        oldPriceCents: diff.oldPriceCents,
        newPriceCents: diff.newPriceCents,
        oldStock: diff.oldStock,
        newStock: diff.newStock,
        byUserId: user.id,
        by: user.displayName,
        at: this.clockService.now(),
      };
      const [saved] = await firstValueFrom(this.productDataService.saveAll([updated]));
      const recorded = await firstValueFrom(
        this.salesDataService.saveProductAdjustment(adjustment)
      );
      return { ok: true as const, product: saved, adjustment: recorded, diff };
    });
  }
}
