import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      title="Disable this user"
      confirmLabel="Disable user"
      [open]="open()"
      [busy]="busy()"
      [danger]="true"
      (confirmed)="confirmed = confirmed + 1"
      (cancelled)="cancelled = cancelled + 1"
    >
      <p>They will not be able to sign in.</p>
    </app-confirm-dialog>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly busy = signal(false);
  confirmed = 0;
  cancelled = 0;
}

describe('ConfirmDialogComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, dialog: element.querySelector('dialog') as HTMLDialogElement };
  }

  const button = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll('button')).find(item =>
      item.textContent?.includes(text)
    ) as HTMLButtonElement;

  it('opens as a named modal dialog with the message and a danger outline confirm', () => {
    const { fixture, element, dialog } = render();
    expect(dialog.open).toBeFalse();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    expect(element.querySelector('h2')?.textContent).toBe('Disable this user');
    expect(element.textContent).toContain('They will not be able to sign in.');
    expect(button(element, 'Disable user').getAttribute('data-variant')).toBe('danger');
  });

  it('puts the first focus on Cancel so a stray Enter does not confirm', () => {
    const { fixture, element } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(button(element, 'Cancel'));
  });

  it('emits confirmed and cancelled', () => {
    const { fixture, element } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    button(element, 'Disable user').click();
    button(element, 'Cancel').click();
    expect(fixture.componentInstance.confirmed).toBe(1);
    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('cancels on Escape unless it is busy', () => {
    const { fixture, dialog } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(fixture.componentInstance.cancelled).toBe(1);
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('disables both buttons while busy', () => {
    const { fixture, element } = render();
    fixture.componentInstance.busy.set(true);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(button(element, 'Disable user').disabled).toBeTrue();
    expect(button(element, 'Cancel').disabled).toBeTrue();
  });

  it('uses medium buttons unless asked for the extra large touch size', () => {
    const medium = TestBed.createComponent(ConfirmDialogComponent);
    medium.componentRef.setInput('title', 'Leave the till');
    medium.componentRef.setInput('confirmLabel', 'Leave');
    medium.detectChanges();
    const mediumButtons = Array.from(
      medium.nativeElement.querySelectorAll('button')
    ) as HTMLElement[];
    expect(mediumButtons.map(item => item.getAttribute('data-size'))).toEqual(['md', 'md']);
    const large = TestBed.createComponent(ConfirmDialogComponent);
    large.componentRef.setInput('title', 'Leave the till');
    large.componentRef.setInput('confirmLabel', 'Leave');
    large.componentRef.setInput('buttonSize', 'xl');
    large.detectChanges();
    const largeButtons = Array.from(
      large.nativeElement.querySelectorAll('button')
    ) as HTMLElement[];
    expect(largeButtons.map(item => item.getAttribute('data-size'))).toEqual(['xl', 'xl']);
  });
});
