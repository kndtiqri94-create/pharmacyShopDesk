import { TestBed } from '@angular/core/testing';
import { GrnStatus } from '../../../../core/models/enums/grn-status.enum';
import { GrnStatusBadgeComponent } from './grn-status-badge.component';

describe('GrnStatusBadgeComponent', () => {
  function render(status: GrnStatus): HTMLElement {
    const fixture = TestBed.createComponent(GrnStatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a word and the right tone for every status', () => {
    const expected: [GrnStatus, string, string][] = [
      [GrnStatus.DRAFT, 'Draft', 'info'],
      [GrnStatus.RECEIVED, 'Received', 'success'],
      [GrnStatus.CANCELLED, 'Cancelled', 'danger'],
    ];
    for (const [status, label, tone] of expected) {
      const element = render(status);
      expect(element.textContent?.trim()).toBe(label);
      expect(element.querySelector('.badge')?.getAttribute('data-tone')).toBe(tone);
    }
  });
});
