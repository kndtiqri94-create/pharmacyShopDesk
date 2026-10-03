import { TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  function render(total: number, pageSize = 10) {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.componentRef.setInput('itemLabel', 'products');
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('is hidden at 10 items and shown at 11', () => {
    expect(render(10).element.querySelector('nav')).toBeNull();
    expect(render(11).element.querySelector('nav')).not.toBeNull();
  });

  it('shows the Showing a-b of N summary', () => {
    expect(render(312).element.textContent).toContain('Showing 1–10 of 312 products');
  });

  it('moves between pages and updates the summary', () => {
    const { fixture, element } = render(25);
    (element.querySelector('button[aria-label="Next page"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.page()).toBe(2);
    expect(element.textContent).toContain('Showing 11–20 of 25 products');
    expect(element.querySelector('button[aria-current="page"]')?.textContent?.trim()).toBe('2');
  });

  it('disables previous on the first page and next on the last', () => {
    const { fixture, element } = render(25);
    expect(
      (element.querySelector('[aria-label="Previous page"]') as HTMLButtonElement).disabled
    ).toBeTrue();
    fixture.componentInstance.page.set(3);
    fixture.detectChanges();
    expect(
      (element.querySelector('[aria-label="Next page"]') as HTMLButtonElement).disabled
    ).toBeTrue();
    expect(element.textContent).toContain('Showing 21–25 of 25 products');
  });

  it('caps the page size so a huge value cannot render everything at once', () => {
    expect(render(500, 100000).element.textContent).toContain('Showing 1–50 of 500');
  });

  it('shows at most five page buttons', () => {
    const { element } = render(1000);
    expect(element.querySelectorAll('button[aria-label^="Page "]')).toHaveSize(5);
  });
});
