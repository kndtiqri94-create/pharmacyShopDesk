import { TestBed } from '@angular/core/testing';
import { OperatorTilesComponent } from './operator-tiles.component';

describe('OperatorTilesComponent', () => {
  function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(OperatorTilesComponent);
    fixture.componentRef.setInput('operators', ['Dialog', 'Mobitel', 'Hutch', 'Airtel']);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const radios = () =>
      Array.from(element.querySelectorAll<HTMLInputElement>('input[type=radio]'));
    return { fixture, element, radios };
  }

  it('shows one tile per operator, each a radio that is easy to reach and tall enough to tap', () => {
    const { element, radios } = render();
    expect(
      Array.from(element.querySelectorAll('.tile__name')).map(tile => tile.textContent)
    ).toEqual(['Dialog', 'Mobitel', 'Hutch', 'Airtel']);
    expect(radios()).toHaveSize(4);
    expect(new Set(radios().map(radio => radio.name)).size).toBe(1);
    expect(element.querySelector('legend')?.textContent).toContain('Operator');
  });

  it('marks only the chosen tile and unmarks the previous one', () => {
    const { fixture, element, radios } = render();
    radios()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('Mobitel');
    radios()[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('Airtel');
    const selected = Array.from(element.querySelectorAll('.tile--selected'));
    expect(selected).toHaveSize(1);
    expect(selected[0].textContent).toContain('Airtel');
    expect(radios().filter(radio => radio.checked)).toHaveSize(1);
  });

  it('can be set from outside and cleared', () => {
    const { fixture, radios } = render({ value: 'Hutch' });
    expect(radios()[2].checked).toBeTrue();
    fixture.componentRef.setInput('value', '');
    fixture.detectChanges();
    expect(radios().some(radio => radio.checked)).toBeFalse();
  });

  it('puts the focus target id on the first tile only', () => {
    const { element } = render();
    expect(element.querySelectorAll('#reload-operator')).toHaveSize(1);
    expect(element.querySelector('input[type=radio]')?.id).toBe('reload-operator');
  });

  it('shows what to fix and flags the group when there is an error', () => {
    const { element, radios } = render({ error: 'Choose the operator' });
    expect(element.querySelector('[role=alert]')?.textContent).toBe('Choose the operator');
    expect(radios()[0].getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe(
      element.querySelector('[role=alert]')?.id
    );
  });

  it('cannot be changed when disabled', () => {
    const { element, radios } = render({ disabled: true });
    expect(element.querySelector('fieldset')?.disabled).toBeTrue();
    expect(radios().every(radio => radio.matches(':disabled'))).toBeTrue();
  });
});
