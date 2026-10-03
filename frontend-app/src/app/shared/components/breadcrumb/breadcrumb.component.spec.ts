import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb.component';

describe('BreadcrumbComponent', () => {
  function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BreadcrumbComponent);
    fixture.componentRef.setInput('items', [
      { label: 'Products', link: '/products' },
      { label: 'Add product' },
    ]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a labelled navigation landmark with an ordered list', () => {
    const element = render();
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(element.querySelector('ol')).not.toBeNull();
  });

  it('links earlier steps and marks the current page', () => {
    const element = render();
    expect(element.querySelector('a')?.textContent).toBe('Products');
    expect(element.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Add product');
    expect(element.querySelectorAll('a')).toHaveSize(1);
  });
});
