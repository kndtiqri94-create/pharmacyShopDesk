import { TestBed } from '@angular/core/testing';
import { ChipItem } from './chip-item.model';
import { ChipsComponent } from './chips.component';

describe('ChipsComponent', () => {
  const items: ChipItem[] = [
    { id: 'all', label: 'All', count: 10 },
    { id: 'low', label: 'Low stock', count: 3 },
    { id: 'out', label: 'Out of stock', count: 1 },
  ];

  function render() {
    const fixture = TestBed.createComponent(ChipsComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('ariaLabel', 'Filter products');
    fixture.componentRef.setInput('value', 'all');
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows each label with its live count', () => {
    const chips = render().element.querySelectorAll('button.chip');
    expect(chips).toHaveSize(3);
    expect(chips[1].textContent).toContain('Low stock');
    expect(chips[1].textContent).toContain('3');
  });

  it('lets the user pick one chip at a time', () => {
    const { fixture, element } = render();
    (element.querySelectorAll('button.chip')[1] as HTMLElement).click();
    fixture.detectChanges();
    const pressed = element.querySelectorAll('button[aria-pressed="true"]');
    expect(pressed).toHaveSize(1);
    expect(pressed[0].textContent).toContain('Low stock');
    expect(fixture.componentInstance.value()).toBe('low');
  });

  it('updates the counts when the data changes', () => {
    const { fixture, element } = render();
    fixture.componentRef.setInput('items', [
      { id: 'all', label: 'All', count: 11 },
      ...items.slice(1),
    ]);
    fixture.detectChanges();
    expect(element.querySelector('button.chip')?.textContent).toContain('11');
  });

  it('is a labelled group', () => {
    expect(render().element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Filter products'
    );
  });
});
