import { TestBed } from '@angular/core/testing';
import { ToggleComponent } from './toggle.component';

describe('ToggleComponent', () => {
  function render(checked = false) {
    const fixture = TestBed.createComponent(ToggleComponent);
    fixture.componentRef.setInput('label', 'Sync automatically when online');
    fixture.componentRef.setInput('checked', checked);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  it('is a labelled switch', () => {
    const { button } = render();
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.textContent).toContain('Sync automatically when online');
  });

  it('shows clearly whether it is on or off', () => {
    const off = render(false);
    expect(off.button.getAttribute('aria-checked')).toBe('false');
    expect(off.button.textContent).toContain('Off');
    const on = render(true);
    expect(on.button.getAttribute('aria-checked')).toBe('true');
    expect(on.button.textContent).toContain('On');
  });

  it('flips on click', () => {
    const { fixture, button } = render(false);
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.checked()).toBeTrue();
  });

  it('does not flip when disabled', () => {
    const { fixture, button } = render(false);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    button.click();
    expect(fixture.componentInstance.checked()).toBeFalse();
  });
});
