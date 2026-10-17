import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SidePanelComponent } from './side-panel.component';

@Component({
  imports: [SidePanelComponent],
  template: `
    <button type="button" id="opener">Open</button>
    <app-side-panel
      title="Add user"
      initialFocus="#first"
      [open]="open()"
      (closed)="closeCount = closeCount + 1; open.set(false)"
    >
      <input id="first" aria-label="First" />
      <button panelFooter type="button" id="footer-button">Create</button>
    </app-side-panel>
  `,
})
class HostComponent {
  readonly open = signal(false);
  closeCount = 0;
}

describe('SidePanelComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const dialog = element.querySelector('dialog') as HTMLDialogElement;
    return { fixture, element, dialog };
  }

  it('stays closed until opened, then opens as a modal dialog named by its title', () => {
    const { fixture, element, dialog } = render();
    expect(dialog.open).toBeFalse();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(dialog.open).toBeTrue();
    const title = element.querySelector('h2');
    expect(title?.textContent).toBe('Add user');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title?.id ?? 'missing');
    expect(element.querySelector('#footer-button')).not.toBeNull();
  });

  it('moves focus to the first control when it opens', () => {
    const { fixture, element } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(element.querySelector('#first'));
  });

  it('closes again when the parent says so', () => {
    const { fixture, dialog } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(dialog.open).toBeFalse();
  });

  it('asks to close from the close button and the Escape key', () => {
    const { fixture, element, dialog } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    (element.querySelector('button[aria-label="Close panel"]') as HTMLElement).click();
    expect(fixture.componentInstance.closeCount).toBe(1);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.closeCount).toBe(2);
  });

  it('does not close when the panel content is clicked', () => {
    const { fixture, element } = render();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    (element.querySelector('#first') as HTMLElement).click();
    expect(fixture.componentInstance.closeCount).toBe(0);
  });
});
