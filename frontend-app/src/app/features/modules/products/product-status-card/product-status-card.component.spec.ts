import { TestBed } from '@angular/core/testing';
import { ProductStatusCardComponent } from './product-status-card.component';

describe('ProductStatusCardComponent', () => {
  function render(disabled = false) {
    const fixture = TestBed.createComponent(ProductStatusCardComponent);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const switches = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[role="switch"]')
    );
    return { fixture, element, switches };
  }

  it('shows two labelled switches that start on, and the note', () => {
    const { element, switches } = render();
    expect(switches.length).toBe(2);
    expect(switches[0].textContent).toContain('Active, can be sold');
    expect(switches[1].textContent).toContain('Show in POS quick list');
    expect(switches.every(item => item.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(element.textContent).toContain(
      'Inactive products stay in reports but disappear from sales and new GRNs.'
    );
  });

  it('flips a switch and shows Off', () => {
    const { fixture, switches } = render();
    switches[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.active()).toBe(false);
    expect(switches[0].getAttribute('aria-checked')).toBe('false');
    expect(switches[0].textContent).toContain('Off');
  });

  it('disables both switches when disabled', () => {
    const { switches } = render(true);
    expect(switches.every(item => item.disabled)).toBe(true);
  });
});
