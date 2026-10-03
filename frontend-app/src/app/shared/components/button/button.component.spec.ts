import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

@Component({
  imports: [ButtonComponent],
  template: `
    <app-button
      [variant]="variant"
      [size]="size"
      [icon]="icon"
      [block]="block"
      [disabled]="disabled"
      (click)="clicks = clicks + 1"
    >
      Receive stock
    </app-button>
  `,
})
class HostComponent {
  variant: 'default' | 'primary' | 'soft' | 'danger' | 'ghost' = 'default';
  size: 'sm' | 'md' | 'lg' = 'md';
  icon: 'plus' | null = null;
  block = false;
  disabled = false;
  clicks = 0;
}

describe('ButtonComponent', () => {
  function render(setup: (host: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    return { fixture, button };
  }

  it('renders the label text', () => {
    expect(render().button.textContent?.trim()).toBe('Receive stock');
  });

  it('supports every variant', () => {
    for (const variant of ['default', 'primary', 'soft', 'danger', 'ghost'] as const) {
      const { button } = render(host => (host.variant = variant));
      expect(button.getAttribute('data-variant')).toBe(variant);
    }
  });

  it('supports small, medium and large sizes', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { button } = render(host => (host.size = size));
      expect(button.getAttribute('data-size')).toBe(size);
    }
  });

  it('shows a leading icon when asked', () => {
    const { fixture } = render(host => (host.icon = 'plus'));
    expect(fixture.nativeElement.querySelector('app-icon')).not.toBeNull();
  });

  it('can be full width', () => {
    const { fixture } = render(host => (host.block = true));
    expect(fixture.nativeElement.querySelector('app-button').classList).toContain('is-block');
  });

  it('does not respond when disabled', () => {
    const { fixture, button } = render(host => (host.disabled = true));
    button.click();
    expect(button.disabled).toBeTrue();
    expect(fixture.componentInstance.clicks).toBe(0);
  });

  it('responds to clicks when enabled', () => {
    const { fixture, button } = render();
    button.click();
    expect(fixture.componentInstance.clicks).toBe(1);
  });
});
