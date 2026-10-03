import { TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  function render(tone: string) {
    const fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('label', 'Low stock');
    fixture.componentRef.setInput('value', '14 items');
    fixture.componentRef.setInput('note', 'Below reorder level');
    fixture.componentRef.setInput('icon', 'package');
    fixture.componentRef.setInput('tone', tone);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows label, value and note', () => {
    const text = render('warning').textContent;
    expect(text).toContain('Low stock');
    expect(text).toContain('14 items');
    expect(text).toContain('Below reorder level');
  });

  it('applies the tone to the icon chip only', () => {
    const element = render('warning');
    expect(element.querySelector('.stat__chip')?.getAttribute('data-tone')).toBe('warning');
    expect(element.querySelector('.stat')?.getAttribute('data-tone')).toBeNull();
  });
});
