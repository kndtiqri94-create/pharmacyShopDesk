import { FormArray } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PRODUCT_SEED } from '../../../../core/services/data/in-memory/seed/product.seed';
import { GrnFieldErrors } from '../../../../core/utils/grn-validation.util';
import { createGrnLineGroup, GrnLineGroup } from '../grn-form/grn-line-form';
import { GrnItemsTableComponent } from './grn-items-table.component';

interface RenderOptions {
  errors?: GrnFieldErrors;
  shortDated?: ReadonlySet<number>;
  readOnly?: boolean;
  ordered?: ReadonlyMap<string, number>;
}

describe('GrnItemsTableComponent', () => {
  const product = PRODUCT_SEED[0];

  function buildLines(): FormArray<GrnLineGroup> {
    return new FormArray([
      createGrnLineGroup({
        productId: product.id,
        batchNo: 'B-1',
        expiry: '03/2028',
        received: '10',
        free: '0',
        cost: '12.50',
        price: '20.00',
      }),
    ]);
  }

  function create(options: RenderOptions = {}): ComponentFixture<GrnItemsTableComponent> {
    const fixture = TestBed.createComponent(GrnItemsTableComponent);
    fixture.componentRef.setInput('lines', buildLines());
    fixture.componentRef.setInput('productsById', new Map([[product.id, product]]));
    fixture.componentRef.setInput('orderedByProduct', options.ordered ?? new Map());
    fixture.componentRef.setInput('lineTotals', [12_500]);
    fixture.componentRef.setInput('errors', options.errors ?? {});
    fixture.componentRef.setInput('shortDated', options.shortDated ?? new Set<number>());
    fixture.componentRef.setInput('readOnly', options.readOnly ?? false);
    fixture.detectChanges();
    return fixture;
  }

  function render(options: RenderOptions = {}): HTMLElement {
    return create(options).nativeElement as HTMLElement;
  }

  it('shows the product, its sku, the price and the line total', () => {
    const element = render();
    expect(element.querySelector('.cell-product')?.textContent).toContain(product.name);
    expect(element.querySelector('.cell-sub')?.textContent?.trim()).toBe(product.sku);
    const cells = Array.from(element.querySelectorAll('td.is-right.sd-num'));
    expect(cells.map(cell => cell.textContent?.trim())).toEqual(['20.00', '125.00']);
  });

  it('shows the ordered quantity next to the sku when the line comes from an order', () => {
    const element = render({ ordered: new Map([[product.id, 40]]) });
    expect(element.querySelector('.cell-sub')?.textContent).toContain('ordered 40');
  });

  it('links a field error to its input and marks it invalid', () => {
    const element = render({ errors: { 'line-0-received': 'Enter the quantity received' } });
    const input = element.querySelector<HTMLInputElement>('#grn-line-0-received');
    const message = element.querySelector('#grn-line-0-received-error');
    expect(message?.textContent?.trim()).toBe('Enter the quantity received');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe('grn-line-0-received-error');
  });

  it('marks a short-dated expiry without an error message', () => {
    const element = render({ shortDated: new Set([0]) });
    const box = element.querySelector('#grn-line-0-expiry')?.parentElement;
    expect(box?.classList).toContain('sd-field-box--error');
    expect(element.querySelector('#grn-line-0-expiry-error')).toBeNull();
  });

  it('emits the line index when remove is pressed', () => {
    const fixture = create();
    const removed: number[] = [];
    fixture.componentInstance.removeLine.subscribe(index => removed.push(index));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`button[aria-label="Remove ${product.name}"]`)
      ?.click();
    expect(removed).toEqual([0]);
  });

  it('hides the remove button when read only', () => {
    expect(render({ readOnly: true }).querySelector('button')).toBeNull();
  });
});
