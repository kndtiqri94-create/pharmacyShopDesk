import { TestBed } from '@angular/core/testing';
import { PaymentStatus } from '../../../../core/models/enums/payment-status.enum';
import { PaymentStatusBadgeComponent } from './payment-status-badge.component';

describe('PaymentStatusBadgeComponent', () => {
  function render(status: PaymentStatus): HTMLElement {
    const fixture = TestBed.createComponent(PaymentStatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a word and the right tone for every status', () => {
    const expected: [PaymentStatus, string, string][] = [
      [PaymentStatus.PAID, 'Paid', 'success'],
      [PaymentStatus.PART_PAID, 'Part paid', 'info'],
      [PaymentStatus.UNPAID, 'Unpaid', 'warning'],
    ];
    for (const [status, label, tone] of expected) {
      const element = render(status);
      expect(element.textContent?.trim()).toBe(label);
      expect(element.querySelector('.badge')?.getAttribute('data-tone')).toBe(tone);
    }
  });
});
