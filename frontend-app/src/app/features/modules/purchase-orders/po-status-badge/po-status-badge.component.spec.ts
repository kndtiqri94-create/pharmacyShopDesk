import { TestBed } from '@angular/core/testing';
import { PoStatus } from '../../../../core/models/enums/po-status.enum';
import { PoStatusBadgeComponent } from './po-status-badge.component';

describe('PoStatusBadgeComponent', () => {
  function render(status: PoStatus): HTMLElement {
    const fixture = TestBed.createComponent(PoStatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a word and the right tone for every status', () => {
    const expected: [PoStatus, string, string][] = [
      [PoStatus.DRAFT, 'Draft', 'info'],
      [PoStatus.SENT, 'Sent', 'warning'],
      [PoStatus.PART_RECEIVED, 'Part received', 'info'],
      [PoStatus.RECEIVED, 'Received', 'success'],
      [PoStatus.CANCELLED, 'Cancelled', 'danger'],
    ];
    for (const [status, label, tone] of expected) {
      const element = render(status);
      expect(element.textContent?.trim()).toBe(label);
      expect(element.querySelector('.badge')?.getAttribute('data-tone')).toBe(tone);
    }
  });
});
