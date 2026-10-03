import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FIELD_IMPORTS } from './field.imports';

@Component({
  imports: [...FIELD_IMPORTS],
  template: `
    <app-field
      label="Selling price"
      fieldId="price"
      [required]="required"
      [hint]="hint"
      [error]="error"
      [prefix]="prefix"
      [suffix]="suffix"
      [span]="span"
    >
      <input appFieldControl type="text" />
    </app-field>
  `,
})
class HostComponent {
  required = false;
  hint: string | null = null;
  error: string | null = null;
  prefix: string | null = null;
  suffix: string | null = null;
  span = 12;
}

describe('FieldComponent', () => {
  function render(setup: (host: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, input: element.querySelector('input')! };
  }

  it('links the label to the control', () => {
    const { element, input } = render();
    expect(element.querySelector('label')?.getAttribute('for')).toBe('price');
    expect(input.id).toBe('price');
  });

  it('marks required fields', () => {
    const { element, input } = render(host => (host.required = true));
    expect(element.querySelector('.field__required')).not.toBeNull();
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('shows a hint and connects it to the control', () => {
    const { element, input } = render(host => (host.hint = 'Leave 0 and use GRN instead.'));
    expect(element.querySelector('.field__hint')?.textContent).toBe('Leave 0 and use GRN instead.');
    expect(input.getAttribute('aria-describedby')).toBe('price-hint');
  });

  it('shows a prefix and a suffix', () => {
    const { element } = render(host => {
      host.prefix = 'Rs.';
      host.suffix = 'tablets';
    });
    const affixes = Array.from(element.querySelectorAll('.field__affix')).map(
      node => node.textContent
    );
    expect(affixes).toEqual(['Rs.', 'tablets']);
  });

  it('lets an error replace the hint, turn the border red and say what to fix', () => {
    const { element, input } = render(host => {
      host.hint = 'A hint';
      host.error = 'Enter a selling price for Amoxicillin 500mg.';
    });
    expect(element.querySelector('.field__hint')).toBeNull();
    expect(element.querySelector('.field__error')?.textContent).toBe(
      'Enter a selling price for Amoxicillin 500mg.'
    );
    expect(element.querySelector('.sd-field-box')?.classList).toContain('sd-field-box--error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('price-error');
  });

  it('takes its width from the 12-column grid', () => {
    const { element } = render(host => (host.span = 4));
    expect(element.querySelector('app-field')?.classList).toContain('sd-col-4');
  });
});
