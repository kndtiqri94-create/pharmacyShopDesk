import { TestBed } from '@angular/core/testing';
import { closeOpenDialogs, settle, testProduct } from '../../../../../testing/pos-test.util';
import { PosItemDetailsDialogComponent } from './pos-item-details-dialog.component';

describe('PosItemDetailsDialogComponent', () => {
  afterEach(() => closeOpenDialogs());

  async function render(options: { canSeeCost?: boolean; open?: boolean } = {}) {
    const fixture = TestBed.createComponent(PosItemDetailsDialogComponent);
    const closes: string[] = [];
    fixture.componentInstance.closed.subscribe(() => closes.push('closed'));
    fixture.componentRef.setInput('product', testProduct({ costCents: 12345, priceCents: 250 }));
    fixture.componentRef.setInput('canSeeCost', options.canSeeCost ?? false);
    fixture.componentRef.setInput('open', options.open ?? true);
    await settle(fixture);
    const element = fixture.nativeElement as HTMLElement;
    return { fixture, element, closes, dialog: element.querySelector('dialog')! };
  }

  it('opens a modal showing only the fields the product already holds', async () => {
    const { element, dialog } = await render();
    expect(dialog.open).toBeTrue();
    const labels = Array.from(element.querySelectorAll('dt')).map(cell => cell.textContent?.trim());
    expect(labels).toEqual([
      'Name',
      'Generic name',
      'Category',
      'Form',
      'Unit',
      'SKU',
      'Barcode',
      'Manufacturer',
      'Shelf location',
      'Sale price',
      'Tax rate',
      'Stock on hand',
      'Reorder level',
      'Prescription required',
    ]);
    expect(element.textContent).toContain('Paracetamol 500mg');
    expect(element.querySelector('input, textarea, select')).toBeNull();
  });

  it('shows the cost price when the viewer may see it', async () => {
    const { element } = await render({ canSeeCost: true });
    expect(element.querySelector('[data-testid="item-cost"]')?.textContent).toContain('123.45');
  });

  it('keeps the cost price out of the page when the viewer may not see it', async () => {
    const { element } = await render({ canSeeCost: false });
    expect(element.querySelector('[data-testid="item-cost"]')).toBeNull();
    expect(element.textContent).not.toContain('Cost price');
    expect(element.textContent).not.toContain('123.45');
    expect(element.innerHTML).not.toContain('12345');
  });

  it('closes from the Close button and from the Esc key', async () => {
    const { element, closes, dialog } = await render();
    const close = Array.from(element.querySelectorAll('button')).find(
      candidate => candidate.textContent?.trim() === 'Close'
    )!;
    close.click();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(closes).toEqual(['closed', 'closed']);
  });

  it('stays closed until opened', async () => {
    const { dialog } = await render({ open: false });
    expect(dialog.open).toBeFalse();
  });
});
