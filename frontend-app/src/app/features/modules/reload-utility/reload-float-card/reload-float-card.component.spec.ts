import { TestBed } from '@angular/core/testing';
import { ReloadFloat } from '../../../../core/models/domain/reload-float.model';
import { ReloadFloatCardComponent } from './reload-float-card.component';

describe('ReloadFloatCardComponent', () => {
  const sample: ReloadFloat = {
    date: '2026-09-21',
    availableCents: 620_000,
    reloadsCount: 38,
    billsCount: 9,
    commissionCents: 124_000,
  };

  function render(float: ReloadFloat | null, lowFloatCents = 1_000_000) {
    const fixture = TestBed.createComponent(ReloadFloatCardComponent);
    fixture.componentRef.setInput('float', float);
    fixture.componentRef.setInput('lowFloatCents', lowFloatCents);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const text = (id: string) =>
      element.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    return { fixture, element, text };
  }

  it('shows the first-time figures: Rs. 6,200, 38, 9 and Rs. 1,240.00', () => {
    const { element, text } = render(sample);
    expect(element.querySelector('h2')?.textContent).toBe('Reload float');
    expect(text('available-float')).toBe('Rs. 6,200');
    expect(text('reloads-today')).toBe('38');
    expect(text('bills-today')).toBe('9');
    expect(text('commission-today')).toBe('Rs. 1,240.00');
  });

  it('shows the progress against a full float of Rs. 20,000', () => {
    const { element } = render(sample);
    const progress = element.querySelector('progress') as HTMLProgressElement;
    expect(progress.value).toBe(620_000);
    expect(progress.max).toBe(2_000_000);
    expect(progress.getAttribute('aria-label')).toBe(
      'Available float against a full float of Rs. 20,000'
    );
  });

  it('shows the full bar at or above the full float and never more', () => {
    const { element } = render({ ...sample, availableCents: 3_000_000 });
    expect((element.querySelector('progress') as HTMLProgressElement).value).toBe(2_000_000);
  });

  it('warns with the level from Settings when the float is below it', () => {
    const { element } = render(sample);
    expect(element.querySelector('app-alert')?.textContent).toContain(
      'Float is below Rs. 10,000. Top up before the evening rush.'
    );
    const changed = render(sample, 1_250_000);
    expect(changed.element.querySelector('app-alert')?.textContent).toContain(
      'Float is below Rs. 12,500.'
    );
  });

  it('shows no warning at the level or above it', () => {
    const atLevel = render({ ...sample, availableCents: 1_000_000 });
    expect(atLevel.element.querySelector('app-alert')).toBeNull();
    const above = render({ ...sample, availableCents: 1_000_001 });
    expect(above.element.querySelector('app-alert')).toBeNull();
    expect(render(sample, 620_000).element.querySelector('app-alert')).toBeNull();
  });

  it('updates the warning when the float or the level changes', () => {
    const { fixture, element } = render(sample);
    expect(element.querySelector('app-alert')).not.toBeNull();
    fixture.componentRef.setInput('float', { ...sample, availableCents: 1_120_000 });
    fixture.detectChanges();
    expect(element.querySelector('app-alert')).toBeNull();
    fixture.componentRef.setInput('lowFloatCents', 1_500_000);
    fixture.detectChanges();
    expect(element.querySelector('app-alert')?.textContent).toContain('Rs. 15,000');
  });

  it('shows cents when the float is not a whole rupee amount', () => {
    expect(render({ ...sample, availableCents: 569_950 }).text('available-float')).toBe(
      'Rs. 5,699.50'
    );
  });

  it('says so when there is no float on record', () => {
    const { element } = render(null);
    expect(element.textContent).toContain('There is no float on record yet.');
    expect(element.querySelector('progress')).toBeNull();
  });
});
