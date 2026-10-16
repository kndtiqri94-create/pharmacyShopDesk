import { TestBed } from '@angular/core/testing';
import { PRODUCT_SEED } from '../../../core/services/data/in-memory/seed/product.seed';
import { ProductPickerComponent } from './product-picker.component';

describe('ProductPickerComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(ProductPickerComponent);
    fixture.componentRef.setInput('products', PRODUCT_SEED.slice(0, 3));
    const picked: string[] = [];
    let dismissed = 0;
    fixture.componentInstance.picked.subscribe(id => picked.push(id));
    fixture.componentInstance.dismissed.subscribe(() => (dismissed += 1));
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, picked, dismissed: () => dismissed };
  }

  it('offers every product with its SKU', () => {
    const { element } = render();
    const options = Array.from(element.querySelectorAll('option')).map(option =>
      option.textContent?.trim()
    );
    expect(options[0]).toBe('Choose a product');
    expect(options).toHaveSize(4);
    expect(options[1]).toContain('Paracetamol 500mg');
  });

  it('tells the parent which product was picked', () => {
    const { element, picked } = render();
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = 'prod-002';
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual(['prod-002']);
  });

  it('ignores a value that is not in the list', () => {
    const { element, picked } = render();
    const select = element.querySelector('select') as HTMLSelectElement;
    select.dispatchEvent(new Event('change'));
    expect(picked).toEqual([]);
  });

  it('can be dismissed', () => {
    const { element, dismissed } = render();
    (element.querySelector('button') as HTMLButtonElement).click();
    expect(dismissed()).toBe(1);
  });
});
