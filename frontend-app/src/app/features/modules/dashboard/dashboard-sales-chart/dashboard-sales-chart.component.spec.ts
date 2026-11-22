import { TestBed } from '@angular/core/testing';
import { SALES_SEED } from '../../../../core/services/data/in-memory/seed/sales.seed';
import { DashboardSalesChartComponent } from './dashboard-sales-chart.component';

describe('DashboardSalesChartComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(DashboardSalesChartComponent);
    fixture.componentRef.setInput('points', SALES_SEED);
    fixture.componentRef.setInput('today', '2026-09-21');
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const chip = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll('button.chip')).find(button =>
      button.textContent?.includes(label)
    ) as HTMLButtonElement;

  it('is titled for 7 days with one bar per day', () => {
    const { element } = render();
    expect(element.querySelector('h2')?.textContent).toBe('Sales, last 7 days');
    expect(element.querySelectorAll('.chart__bar')).toHaveSize(7);
  });

  it('makes today darker and labels only the highest day and today', () => {
    const { element } = render();
    expect(element.querySelectorAll('.chart__bar--today')).toHaveSize(1);
    expect(element.querySelectorAll('.chart__bar')[6].classList).toContain('chart__bar--today');
    const visibleLabels = Array.from(
      element.querySelectorAll('.chart__value:not(.chart__value--hidden)')
    );
    expect(visibleLabels.map(label => label.textContent?.trim())).toEqual(['96.5', '84.3']);
  });

  it('switches to 30 days and back with exactly one choice selected', () => {
    const { fixture, element } = render();
    chip(element, '30 days').click();
    fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('Sales, last 30 days');
    expect(element.querySelectorAll('.chart__bar')).toHaveSize(30);
    expect(element.querySelectorAll('button.chip[aria-pressed="true"]')).toHaveSize(1);
    expect(chip(element, '30 days').getAttribute('aria-pressed')).toBe('true');
    chip(element, '7 days').click();
    fixture.detectChanges();
    expect(element.querySelector('h2')?.textContent).toBe('Sales, last 7 days');
    expect(chip(element, '7 days').getAttribute('aria-pressed')).toBe('true');
  });

  it('gives every day a readable text value, not only a bar height', () => {
    const { element } = render();
    const texts = Array.from(element.querySelectorAll('.chart__item .sd-sr-only')).map(node =>
      node.textContent?.trim()
    );
    expect(texts).toHaveSize(7);
    expect(texts.at(-1)).toBe('21 Sep 2026: Rs. 84,250, today');
    expect(texts[0]).toBe('15 Sep 2026: Rs. 62,000');
  });
});
