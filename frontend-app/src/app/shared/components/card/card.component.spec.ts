import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';

@Component({
  imports: [CardComponent],
  template: `
    <app-card [title]="title" subtitle="Last 30 days" [flush]="flush">
      <button cardActions type="button">Export</button>
      <p class="body-text">Body</p>
      <span cardFooter>Footer</span>
    </app-card>
  `,
})
class HostComponent {
  title: string | null = 'Recent transactions';
  flush = false;
}

describe('CardComponent', () => {
  function render(setup: (host: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows title, subtitle, actions, body and footer', () => {
    const element = render();
    expect(element.querySelector('h2')?.textContent).toBe('Recent transactions');
    expect(element.textContent).toContain('Last 30 days');
    expect(element.querySelector('[cardActions]')).not.toBeNull();
    expect(element.querySelector('.body-text')).not.toBeNull();
    expect(element.querySelector('.card__footer')?.textContent).toContain('Footer');
  });

  it('labels the section by its title', () => {
    const element = render();
    const section = element.querySelector('section')!;
    const labelledBy = section.getAttribute('aria-labelledby')!;
    expect(element.querySelector(`#${labelledBy}`)?.textContent).toBe('Recent transactions');
  });

  it('runs edge to edge when flush', () => {
    const element = render(host => (host.flush = true));
    expect(element.querySelector('.card__body--flush')).not.toBeNull();
  });

  it('has no header without a title', () => {
    const element = render(host => (host.title = null));
    expect(element.querySelector('.card__header')).toBeNull();
  });

  it('never nests a card inside a card header or footer', () => {
    expect(render().querySelectorAll('app-card app-card')).toHaveSize(0);
  });
});
