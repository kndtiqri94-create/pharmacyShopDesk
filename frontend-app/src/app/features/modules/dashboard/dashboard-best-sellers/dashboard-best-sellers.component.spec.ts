import { TestBed } from '@angular/core/testing';
import { BestSeller } from '../../../../core/models/domain/sales-summary.model';
import { DashboardBestSellersComponent } from './dashboard-best-sellers.component';

describe('DashboardBestSellersComponent', () => {
  function render(sellers: BestSeller[]) {
    const fixture = TestBed.createComponent(DashboardBestSellersComponent);
    fixture.componentRef.setInput('sellers', sellers);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each product with its unit count written as a number and a bar', () => {
    const element = render([
      { productId: 'a', productName: 'Paracetamol 500mg', unitsSold: 1240 },
      { productId: 'b', productName: 'Cetirizine 10mg', unitsSold: 620 },
    ]);
    const rows = Array.from(element.querySelectorAll('li'));
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Paracetamol 500mg');
    expect(rows[0].querySelector('.sd-num')?.textContent?.trim()).toBe('1,240');
    expect(rows.every(row => row.querySelector('app-progress-bar') !== null)).toBe(true);
  });

  it('shows a plain message when there are no sales', () => {
    const element = render([]);
    expect(element.textContent).toContain('No sales yet this week');
    expect(element.querySelector('li')).toBeNull();
  });
});
