import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { settle } from '../../../../../testing/pos-test.util';
import { PosPrintSheetComponent } from './pos-print-sheet.component';

@Component({
  selector: 'app-host',
  imports: [PosPrintSheetComponent],
  template: `
    <app-pos-print-sheet
      heading="Sample sheet"
      printLabel="Print sample"
      [open]="open()"
      (closed)="closes.set(closes() + 1)"
    >
      <p>Sheet body</p>
    </app-pos-print-sheet>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closes = signal(0);
}

describe('PosPrintSheetComponent', () => {
  afterEach(() => document.body.classList.remove('sd-printing-receipt'));

  it('shows nothing and leaves the page printable while closed', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture, 0);
    expect(fixture.nativeElement.querySelector('.sd-receipt-sheet')).toBeNull();
    expect(document.body.classList.contains('sd-printing-receipt')).toBeFalse();
  });

  it('shows the heading and body and marks the page for receipt printing while open', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.open.set(true);
    await settle(fixture, 0);
    const sheet = fixture.nativeElement.querySelector('.sd-receipt-sheet') as HTMLElement;
    expect(sheet.textContent).toContain('Sample sheet');
    expect(sheet.textContent).toContain('Sheet body');
    expect(document.body.classList.contains('sd-printing-receipt')).toBeTrue();
    fixture.componentInstance.open.set(false);
    await settle(fixture, 0);
    expect(document.body.classList.contains('sd-printing-receipt')).toBeFalse();
  });

  it('prints with the browser and asks to close from the button and Escape', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.open.set(true);
    await settle(fixture, 0);
    const print = spyOn(window, 'print');
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Print sample'))!.click();
    expect(print).toHaveBeenCalledTimes(1);
    buttons.find(button => button.textContent?.trim() === 'Close')!.click();
    const overlay = fixture.nativeElement.querySelector('.sd-receipt-overlay') as HTMLElement;
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.closes()).toBe(2);
  });
});
