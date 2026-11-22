import { FormControl, FormGroup } from '@angular/forms';
import { PurchaseOrderLineInput } from '../../../../core/utils/purchase-order-validation.util';

export type PurchaseOrderLineGroup = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<string>;
  unitCost: FormControl<string>;
}>;

function textControl(value: string): FormControl<string> {
  return new FormControl(value, { nonNullable: true });
}

export function createPurchaseOrderLineGroup(
  input: PurchaseOrderLineInput
): PurchaseOrderLineGroup {
  return new FormGroup({
    productId: textControl(input.productId),
    quantity: textControl(input.quantity),
    unitCost: textControl(input.unitCost),
  });
}
