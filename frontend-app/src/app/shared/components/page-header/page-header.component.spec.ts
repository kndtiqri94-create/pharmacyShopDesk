import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="Products" subtitle="Everything you sell.">
      <button pageActions type="button">Add product</button>
    </app-page-header>
  `,
})
class HostComponent {}

describe('PageHeaderComponent', () => {
  it('shows a noun heading, a one-line subtitle and the actions', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Products');
    expect(element.textContent).toContain('Everything you sell.');
    expect(element.querySelector('[pageActions]')).not.toBeNull();
  });
});
