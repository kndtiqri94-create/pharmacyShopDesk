import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { closeOpenDialogs, settle } from '../../../../../testing/pos-test.util';
import { PosDialogComponent } from './pos-dialog.component';

@Component({
  selector: 'app-host',
  imports: [PosDialogComponent],
  template: `
    <app-pos-dialog heading="Sample" [open]="open()" (closed)="closes.set(closes() + 1)">
      <p>Body text</p>
      <div dialogActions><button type="button">Footer</button></div>
    </app-pos-dialog>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closes = signal(0);
}

describe('PosDialogComponent', () => {
  afterEach(closeOpenDialogs);

  async function render() {
    const fixture = TestBed.createComponent(HostComponent);
    await settle(fixture, 0);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    return { fixture, dialog };
  }

  it('is closed until opened and opens as a modal with its heading as its name', async () => {
    const { fixture, dialog } = await render();
    expect(dialog.open).toBeFalse();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    expect(title?.textContent).toContain('Sample');
  });

  it('shows the body and the footer actions', async () => {
    const { fixture } = await render();
    expect(fixture.nativeElement.textContent).toContain('Body text');
    expect(fixture.nativeElement.querySelector('footer button')?.textContent).toBe('Footer');
  });

  it('asks to close from the cross button and from Escape', async () => {
    const { fixture, dialog } = await render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    (dialog.querySelector('header button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.closes()).toBe(1);
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.closes()).toBe(2);
  });

  it('closes when the host says so', async () => {
    const { fixture, dialog } = await render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(dialog.open).toBeFalse();
  });
});
