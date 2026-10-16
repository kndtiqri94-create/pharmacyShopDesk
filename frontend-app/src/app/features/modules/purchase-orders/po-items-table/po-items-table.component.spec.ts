import { FormArray } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PRODUCT_SEED } from '../../../../core/services/data/in-memory/seed/product.seed';
import { formatCount } from '../../../../core/utils/money.util';
import { PurchaseOrderFieldErrors } from '../../../../core/utils/purchase-order-validation.util';
import { getStockOnHand } from '../../../../core/utils/stock-status.util';
import {
  createPurchaseOrderLineGroup,
  PurchaseOrderLineGroup,
} from '../purchase-order-form/purchase-order-line-form';
import { PoItemsTableComponent } from './po-items-table.component';

describe('PoItemsTableComponent', () => {
  const product = PRODUCT_SEED[0];

  function buildLines(): FormArray<PurchaseOrderLineGroup> {
    return new FormArray([
      createPurchaseOrderLineGroup({ productId: product.id, quantity: '20', unitCost: '5.00' }),
    ]);
  }

  function create(
    errors: PurchaseOrderFieldErrors,
    readOnly: boolean
  ): ComponentFixture<PoItemsTableComponent> {
    const fixture = TestBed.createComponent(PoItemsTableComponent);
    fixture.componentRef.setInput('lines', buildLines());
    fixture.componentRef.setInput('productsById', new Map([[product.id, product]]));
    fixture.componentRef.setInput('lineTotals', [10_000]);
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the product, stock, reorder level and line total', () => {
    const element = create({}, false).nativeElement as HTMLElement;
    expect(element.querySelector('.cell-product')?.textContent).toContain(product.name);
    expect(element.querySelector('.cell-sub')?.textContent?.trim()).toBe(product.sku);
    const cells = Array.from(element.querySelectorAll('td.cell-static')).map(cell =>
      cell.textContent?.trim()
    );
    expect(cells).toEqual([
      formatCount(getStockOnHand(product)),
      formatCount(product.reorderLevel),
      '100.00',
    ]);
  });

  it('links a quantity error to its input and marks it invalid', () => {
    const element = create({ 'line-0-quantity': 'Enter an order quantity above 0' }, false)
      .nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#po-line-0-quantity');
    expect(element.querySelector('#po-line-0-quantity-error')?.textContent?.trim()).toBe(
      'Enter an order quantity above 0'
    );
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe('po-line-0-quantity-error');
    expect(element.querySelector('#po-line-0-unitCost')?.getAttribute('aria-invalid')).toBeNull();
  });

  it('emits the line index when remove is pressed', () => {
    const fixture = create({}, false);
    const removed: number[] = [];
    fixture.componentInstance.removeLine.subscribe(index => removed.push(index));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`button[aria-label="Remove ${product.name}"]`)
      ?.click();
    expect(removed).toEqual([0]);
  });

  it('hides the remove button when read only', () => {
    const element = create({}, true).nativeElement as HTMLElement;
    expect(element.querySelector('button')).toBeNull();
  });
});
