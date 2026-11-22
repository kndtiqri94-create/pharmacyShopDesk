import { FormControl, FormGroup } from '@angular/forms';
import { GrnLineInput } from '../../../../core/utils/grn-validation.util';

export type GrnLineGroup = FormGroup<{
  productId: FormControl<string>;
  batchNo: FormControl<string>;
  expiry: FormControl<string>;
  received: FormControl<string>;
  free: FormControl<string>;
  cost: FormControl<string>;
  price: FormControl<string>;
}>;

function textControl(value: string): FormControl<string> {
  return new FormControl(value, { nonNullable: true });
}

export function createGrnLineGroup(input: GrnLineInput): GrnLineGroup {
  return new FormGroup({
    productId: textControl(input.productId),
    batchNo: textControl(input.batchNo),
    expiry: textControl(input.expiry),
    received: textControl(input.received),
    free: textControl(input.free),
    cost: textControl(input.cost),
    price: textControl(input.price),
  });
}
