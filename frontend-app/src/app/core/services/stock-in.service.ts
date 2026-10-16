import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Grn } from '../models/domain/grn.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { nextDocumentNumber, nextRecordId } from '../utils/document-number.util';
import { applyGrnToOrder, applyGrnToProducts } from '../utils/grn-receiving.util';
import {
  GrnFieldErrors,
  GrnFormInput,
  ValidatedGrn,
  validateGrn,
} from '../utils/grn-validation.util';
import { AuthService } from './auth/auth.service';
import { GrnDataService } from './data/grn-data.service';
import { ProductDataService } from './data/product-data.service';
import { PurchaseOrderDataService } from './data/purchase-order-data.service';
import { SupplierDataService } from './data/supplier-data.service';
import { PermissionService } from './permission.service';

export type StockInFailure = 'denied' | 'not-found' | 'already-received' | 'invalid';

export type StockInResult =
  | { ok: true; grn: Grn }
  | { ok: false; reason: StockInFailure; errors: GrnFieldErrors; firstErrorField: string | null };

const NO_ERRORS: GrnFieldErrors = {};

function failure(reason: StockInFailure): StockInResult {
  return { ok: false, reason, errors: NO_ERRORS, firstErrorField: null };
}

@Injectable({ providedIn: 'root' })
export class StockInService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly grnDataService = inject(GrnDataService);
  private readonly productDataService = inject(ProductDataService);
  private readonly purchaseOrderDataService = inject(PurchaseOrderDataService);
  private readonly supplierDataService = inject(SupplierDataService);

  async saveDraft(input: GrnFormInput, existingId: string | null): Promise<StockInResult> {
    const prepared = await this.prepare(input, existingId, false);
    if ('ok' in prepared) return prepared;
    const saved = await firstValueFrom(
      this.grnDataService.save(this.buildGrn(prepared, GrnStatus.DRAFT))
    );
    return { ok: true, grn: saved };
  }

  async receiveGrn(input: GrnFormInput, existingId: string | null): Promise<StockInResult> {
    const prepared = await this.prepare(input, existingId, true);
    if ('ok' in prepared) return prepared;
    const grn = this.buildGrn(prepared, GrnStatus.RECEIVED);
    const products = applyGrnToProducts(grn.lines, prepared.products);
    const linked = prepared.orders.find(order => order.number === grn.purchaseOrderNumber);
    const order = linked ? applyGrnToOrder(grn.lines, linked) : null;
    for (const product of products) await firstValueFrom(this.productDataService.save(product));
    if (order) await firstValueFrom(this.purchaseOrderDataService.save(order));
    const saved = await firstValueFrom(this.grnDataService.save(grn));
    return { ok: true, grn: saved };
  }

  private async prepare(input: GrnFormInput, existingId: string | null, strict: boolean) {
    const user = this.authService.currentUser();
    if (user === null || !this.permissionService.canWrite(ModuleKey.GRN)) return failure('denied');
    const [grns, products, orders, suppliers] = await Promise.all([
      firstValueFrom(this.grnDataService.getAll()),
      firstValueFrom(this.productDataService.getAll()),
      firstValueFrom(this.purchaseOrderDataService.getAll()),
      firstValueFrom(this.supplierDataService.getAll()),
    ]);
    const existing = existingId === null ? null : grns.find(grn => grn.id === existingId);
    if (existing === undefined) return failure('not-found');
    if (existing !== null && existing.status !== GrnStatus.DRAFT)
      return failure('already-received');
    const result = validateGrn(input, { products, suppliers, orders, strict });
    if (result.values === null) {
      return {
        ok: false,
        reason: 'invalid',
        errors: result.errors,
        firstErrorField: result.firstErrorField,
      } satisfies StockInResult;
    }
    return {
      values: result.values,
      existing,
      grns,
      products,
      orders,
      receivedBy: user.displayName,
    };
  }

  private buildGrn(
    prepared: {
      values: ValidatedGrn;
      existing: Grn | null;
      grns: readonly Grn[];
      receivedBy: string;
    },
    status: GrnStatus
  ): Grn {
    const { values, existing, grns, receivedBy } = prepared;
    return {
      ...values,
      id:
        existing?.id ??
        nextRecordId(
          'grn',
          grns.map(grn => grn.id)
        ),
      number:
        existing?.number ??
        nextDocumentNumber(
          'GRN',
          grns.map(grn => grn.number)
        ),
      receivedBy,
      status,
    };
  }
}
