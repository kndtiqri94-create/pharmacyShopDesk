import { TestBed } from '@angular/core/testing';
import { Supplier } from '../../../../core/models/domain/supplier.model';
import { SUPPLIER_SEED } from '../../../../core/services/data/in-memory/seed/supplier.seed';
import { SupplierSideCardComponent } from './supplier-side-card.component';

describe('SupplierSideCardComponent', () => {
  function render(supplier: Supplier | null, owedCents: number): HTMLElement {
    const fixture = TestBed.createComponent(SupplierSideCardComponent);
    fixture.componentRef.setInput('supplier', supplier);
    fixture.componentRef.setInput('owedCents', owedCents);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the chosen supplier details and what is owed', () => {
    const supplier = SUPPLIER_SEED[0];
    const element = render(supplier, 250_000);
    const content = element.textContent ?? '';
    expect(content).toContain(supplier.name);
    expect(content).toContain(`Supplier since ${supplier.sinceYear}`);
    expect(content).toContain(supplier.phone);
    expect(content).toContain(`${supplier.creditDays} days credit`);
    expect(content).toContain(supplier.deliveryDays);
    expect(element.querySelector('[data-testid="supplier-owed"]')?.textContent?.trim()).toBe(
      'You owe them Rs. 2,500'
    );
  });

  it('asks to choose a supplier when none is chosen', () => {
    const element = render(null, 0);
    expect(element.textContent).toContain('Choose a supplier');
    expect(element.querySelector('[data-testid="supplier-owed"]')).toBeNull();
  });
});
