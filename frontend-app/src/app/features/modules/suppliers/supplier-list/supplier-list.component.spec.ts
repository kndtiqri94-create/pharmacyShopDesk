import { TestBed } from '@angular/core/testing';
import { GRN_SEED } from '../../../../core/services/data/in-memory/seed/grn.seed';
import { PURCHASE_ORDER_SEED } from '../../../../core/services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_SEED } from '../../../../core/services/data/in-memory/seed/supplier.seed';
import { toSupplierListItems } from '../../../../core/utils/supplier-list-filter.util';
import { SupplierListComponent } from './supplier-list.component';

describe('SupplierListComponent', () => {
  function render(selectedId: string | null = 'sup-002') {
    const fixture = TestBed.createComponent(SupplierListComponent);
    fixture.componentRef.setInput(
      'items',
      toSupplierListItems(SUPPLIER_SEED, GRN_SEED, PURCHASE_ORDER_SEED)
    );
    fixture.componentRef.setInput('selectedId', selectedId);
    const chosen: string[] = [];
    fixture.componentInstance.selected.subscribe(id => chosen.push(id));
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, chosen };
  }

  it('marks the selected supplier row and tells the page which supplier is chosen', () => {
    const { element, chosen } = render();
    const rows = element.querySelectorAll('tbody tr');
    expect(rows[1].getAttribute('aria-current')).toBe('true');
    expect(rows[1].querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    (rows[2].querySelector('button.supplier-cell__name') as HTMLElement).click();
    expect(chosen).toEqual(['sup-003']);
  });

  it('limits the search text and says plainly when nothing matches', () => {
    const { fixture, element } = render();
    const input = element.querySelector('input[type="search"]') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('100');
    input.value = 'x'.repeat(150);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.textContent).toContain('No suppliers match');
  });
});
