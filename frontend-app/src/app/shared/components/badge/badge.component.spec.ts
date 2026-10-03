import { TestBed } from '@angular/core/testing';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(BadgeComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('always shows the status word', () => {
    expect(render({ label: 'Low stock', tone: 'warning' }).textContent).toContain('Low stock');
  });

  it('shows a dot with the word by default', () => {
    expect(render({ label: 'Paid', tone: 'success' }).querySelector('.badge__dot')).not.toBeNull();
  });

  it('has no dot in plain mode but still shows its text', () => {
    const element = render({ label: '12', plain: true });
    expect(element.querySelector('.badge__dot')).toBeNull();
    expect(element.textContent).toContain('12');
  });

  it('sets the tone', () => {
    const element = render({ label: 'Failed', tone: 'danger' });
    expect(element.querySelector('.badge')?.getAttribute('data-tone')).toBe('danger');
  });
});
