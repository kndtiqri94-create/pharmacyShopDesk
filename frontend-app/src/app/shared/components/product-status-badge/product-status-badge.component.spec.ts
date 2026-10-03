import { TestBed } from '@angular/core/testing';
import { ProductStatus } from '../../../core/models/enums/product-status.enum';
import { ProductStatusBadgeComponent } from './product-status-badge.component';

describe('ProductStatusBadgeComponent', () => {
  function render(status: ProductStatus): HTMLElement {
    const fixture = TestBed.createComponent(ProductStatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a word and the right tone for every status', () => {
    const expected: [ProductStatus, string, string][] = [
      [ProductStatus.IN_STOCK, 'In stock', 'success'],
      [ProductStatus.LOW_STOCK, 'Low stock', 'warning'],
      [ProductStatus.EXPIRING_SOON, 'Expiring soon', 'warning'],
      [ProductStatus.OUT_OF_STOCK, 'Out of stock', 'danger'],
    ];
    for (const [status, label, tone] of expected) {
      const element = render(status);
      expect(element.textContent?.trim()).toBe(label);
      expect(element.querySelector('.badge')?.getAttribute('data-tone')).toBe(tone);
    }
  });
});
