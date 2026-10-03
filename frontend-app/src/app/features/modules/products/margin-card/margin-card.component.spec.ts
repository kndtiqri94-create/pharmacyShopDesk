import { TestBed } from '@angular/core/testing';
import { MarginResult } from '../../../../core/utils/margin.util';
import { MarginCardComponent } from './margin-card.component';

describe('MarginCardComponent', () => {
  function render(margin: MarginResult, unit = 'tablet') {
    const fixture = TestBed.createComponent(MarginCardComponent);
    fixture.componentRef.setInput('margin', margin);
    fixture.componentRef.setInput('unit', unit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (element: HTMLElement, id: string) =>
    element.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

  it('shows the percentage, profit per unit and a bar for a profit', () => {
    const element = render({ kind: 'profit', percent: 30, profitCents: 90 });
    expect(text(element, 'margin-percent')).toBe('30%');
    expect(text(element, 'margin-profit')).toBe('Rs. 0.90 profit per tablet');
    expect(element.querySelector('app-progress-bar')).not.toBeNull();
  });

  it('shows a neutral message when there is no margin yet', () => {
    const element = render({ kind: 'none', percent: 0, profitCents: 0 });
    expect(text(element, 'margin-none')).toBe('No margin yet');
    expect(element.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('words a loss in plain language without a broken figure', () => {
    const element = render({ kind: 'loss', percent: -20, profitCents: -50 }, 'capsule');
    expect(text(element, 'margin-loss')).toBe('Selling below cost');
    expect(element.textContent).toContain('You lose Rs. 0.50 on every capsule sold.');
    expect(element.textContent).not.toMatch(/NaN|Infinity/);
  });
});
