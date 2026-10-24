import { Component, input, output } from '@angular/core';
import { KEYPAD_BACKSPACE, KEYPAD_KEYS } from '../../../../core/utils/pos-keypad.util';

@Component({
  selector: 'app-pos-keypad',
  templateUrl: './pos-keypad.component.html',
  styleUrl: './pos-keypad.component.scss',
})
export class PosKeypadComponent {
  readonly targetLabel = input.required<string>();
  readonly disabled = input(false);
  readonly keyPressed = output<string>();

  protected readonly keys = KEYPAD_KEYS;
  protected readonly backspace = KEYPAD_BACKSPACE;

  protected keyLabel(key: string): string {
    return key === KEYPAD_BACKSPACE ? 'Backspace' : key;
  }

  protected keyAriaLabel(key: string): string {
    if (key === KEYPAD_BACKSPACE) return 'Backspace';
    return key === '.' ? 'Decimal point' : key;
  }
}
