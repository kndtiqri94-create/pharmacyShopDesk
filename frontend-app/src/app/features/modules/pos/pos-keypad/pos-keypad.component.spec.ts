import { TestBed } from '@angular/core/testing';
import { PosKeypadComponent } from './pos-keypad.component';

describe('PosKeypadComponent', () => {
  function render(disabled = false) {
    const fixture = TestBed.createComponent(PosKeypadComponent);
    fixture.componentRef.setInput('targetLabel', 'Cash received');
    fixture.componentRef.setInput('disabled', disabled);
    const pressed: string[] = [];
    fixture.componentInstance.keyPressed.subscribe(key => pressed.push(key));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const keys = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.keypad__key'));
    return { fixture, element, keys, pressed };
  }

  it('names the field it is typing into', () => {
    const { element } = render();
    expect(element.querySelector('.keypad__target')?.textContent).toContain(
      'Typing into: Cash received'
    );
  });

  it('shows the ten digits, the decimal point and Backspace', () => {
    const { keys } = render();
    expect(keys().map(key => key.textContent?.trim())).toEqual([
      '7',
      '8',
      '9',
      '4',
      '5',
      '6',
      '1',
      '2',
      '3',
      '.',
      '0',
      'Backspace',
    ]);
  });

  it('gives the decimal point and Backspace spoken names', () => {
    const { keys } = render();
    const names = keys().map(key => key.getAttribute('aria-label'));
    expect(names).toContain('Decimal point');
    expect(names).toContain('Backspace');
  });

  it('raises each key that is pressed', () => {
    const { keys, pressed } = render();
    keys()[0].click();
    keys()[9].click();
    keys()[11].click();
    expect(pressed).toEqual(['7', '.', 'BACKSPACE']);
  });

  it('is off when disabled', () => {
    const { keys, pressed } = render(true);
    expect(keys().every(key => key.disabled)).toBeTrue();
    keys()[0].click();
    expect(pressed).toEqual([]);
  });

  it('makes every key at least 52px tall', () => {
    const { keys } = render();
    for (const key of keys()) {
      expect(parseFloat(getComputedStyle(key).minHeight)).toBeGreaterThanOrEqual(52);
    }
  });
});
