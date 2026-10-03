import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DataTableCellDirective } from './data-table-cell.directive';
import { DataTableColumn } from './data-table-column.model';
import { DataTableRowAction, DataTableRowActionEvent } from './data-table-row-action.model';
import { DataTableComponent } from './data-table.component';

interface Row {
  id: number;
  name: string;
  sku: string;
  stock: number;
  priceCents: number;
}

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Product', subValue: row => `Category ${row.id}` },
  { key: 'sku', label: 'SKU', kind: 'code' },
  { key: 'stock', label: 'Stock', kind: 'number' },
  { key: 'priceCents', label: 'Price', kind: 'money' },
];

const ACTIONS: DataTableRowAction[] = [
  { id: 'view', label: 'View', icon: 'eye' },
  { id: 'edit', label: 'Edit', icon: 'edit' },
  { id: 'more', label: 'More options for', icon: 'more' },
  { id: 'extra', label: 'Extra', icon: 'trash' },
];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Product ${index + 1}`,
    sku: `SKU-${index + 1}`,
    stock: 1200 + index,
    priceCents: 250 + index,
  }));
}

@Component({
  imports: [DataTableComponent, DataTableCellDirective],
  template: `
    <app-data-table
      ariaLabel="Products"
      itemLabel="products"
      [columns]="columns"
      [rows]="rows"
      [actions]="actions"
      [rowKey]="rowKey"
      [stack]="stack"
      (actionTriggered)="events.push($event)"
    >
      <ng-template appDataTableCell="sku" let-row
        ><em class="custom">{{ row.sku }}</em></ng-template
      >
    </app-data-table>
  `,
})
class HostComponent {
  columns = COLUMNS;
  rows: Row[] = makeRows(3);
  actions = ACTIONS;
  stack = false;
  rowKey = (row: Row) => row.id;
  events: DataTableRowActionEvent<Row>[] = [];
}

@Component({
  imports: [DataTableComponent],
  template: `
    <app-data-table
      ariaLabel="Products"
      itemLabel="products"
      [columns]="columns"
      [rows]="rows"
      [rowKey]="rowKey"
      [selectable]="true"
      [(selectedKeys)]="selected"
      [(pageNumber)]="page"
    />
  `,
})
class SelectableHostComponent {
  columns = COLUMNS;
  rows: Row[] = makeRows(25);
  rowKey = (row: Row) => row.id;
  selected: readonly (string | number)[] = [];
  page = signal(1);
}

describe('DataTableComponent selection and paging', () => {
  function render() {
    const fixture = TestBed.createComponent(SelectableHostComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('ticks rows one at a time with an accessible name', () => {
    const { fixture, element } = render();
    const box = element.querySelector(
      'tbody tr:nth-child(2) input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(element.querySelector('tbody tr:nth-child(2) .sd-sr-only')?.textContent).toBe(
      'Select Product 2'
    );
    box.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toEqual([2]);
    expect(element.querySelector('tbody tr:nth-child(2)')?.classList).toContain('is-selected');
    box.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toEqual([]);
  });

  it('selects and clears every row on the current page only', () => {
    const { fixture, element } = render();
    const header = element.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    header.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toHaveSize(10);
    expect(header.checked).toBeTrue();
    header.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toEqual([]);
  });

  it('follows a page number set from outside and clamps it to the last page', () => {
    const { fixture, element } = render();
    fixture.componentInstance.page.set(2);
    fixture.detectChanges();
    expect(element.querySelector('tbody tr:first-child td:nth-child(2)')?.textContent).toContain(
      'Product 11'
    );
    fixture.componentInstance.page.set(99);
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveSize(5);
  });
});

describe('DataTableComponent', () => {
  function render(setup: (host: HostComponent) => void = () => undefined) {
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('right-aligns number and money columns', () => {
    const { element } = render();
    const rightCells = element.querySelectorAll('tbody tr:first-child td.is-right');
    expect(rightCells.length).toBeGreaterThanOrEqual(2);
    expect(element.querySelector('thead th:nth-child(3)')?.classList).toContain('is-right');
    expect(element.querySelector('thead th:nth-child(4)')?.classList).toContain('is-right');
    expect(element.querySelector('thead th:nth-child(1)')?.classList).not.toContain('is-right');
  });

  it('heads money columns with (Rs.) and shows two decimals', () => {
    const { element } = render();
    expect(element.querySelector('thead th:nth-child(4)')?.textContent).toContain('(Rs.)');
    expect(element.querySelector('tbody tr:first-child td:nth-child(4)')?.textContent).toContain(
      '2.50'
    );
  });

  it('shows a name over a smaller subtitle in the first cell', () => {
    const { element } = render();
    const first = element.querySelector('tbody tr:first-child td:first-child')!;
    expect(first.querySelector('.sd-body-strong')?.textContent).toContain('Product 1');
    expect(first.querySelector('.cell-sub')?.textContent).toBe('Category 1');
  });

  it('shows code columns in the monospaced style and supports custom cells', () => {
    const { element } = render();
    expect(element.querySelector('td.is-mono')).not.toBeNull();
    expect(element.querySelector('em.custom')?.textContent).toBe('SKU-1');
  });

  it('allows at most three row actions, each with an accessible name', () => {
    const { element } = render();
    const buttons = element.querySelectorAll('tbody tr:first-child button.row-action');
    expect(buttons).toHaveSize(3);
    expect(buttons[0].getAttribute('aria-label')).toBe('View Product 1');
    expect(element.querySelector('thead .sd-sr-only')?.textContent).toBe('Actions');
  });

  it('emits the action and the row', () => {
    const { fixture, element } = render();
    (
      element.querySelector('button.row-action[aria-label="Edit Product 2"]') as HTMLElement
    ).click();
    expect(fixture.componentInstance.events).toEqual([
      { actionId: 'edit', row: fixture.componentInstance.rows[1] },
    ]);
  });

  it('hides pagination at 10 rows or fewer', () => {
    const { element } = render(host => (host.rows = makeRows(10)));
    expect(element.querySelector('app-pagination nav')).toBeNull();
    expect(element.querySelectorAll('tbody tr')).toHaveSize(10);
  });

  it('shows pagination above 10 rows, with the summary, and moves between pages', () => {
    const { fixture, element } = render(host => (host.rows = makeRows(25)));
    expect(element.querySelectorAll('tbody tr')).toHaveSize(10);
    expect(element.querySelector('[data-testid="pagination-summary"]')?.textContent).toContain(
      'Showing 1–10 of 25 products'
    );
    (element.querySelector('button[aria-label="Next page"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(element.querySelector('tbody tr:first-child td')?.textContent).toContain('Product 11');
    (element.querySelector('button[aria-label="Page 3"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr')).toHaveSize(5);
  });

  it('scrolls sideways by default and stacks on request', () => {
    const scroll = render().element.querySelector('.table-wrap')!;
    expect(scroll.classList).toContain('sd-scroll-x');
    expect(scroll.classList).not.toContain('table-wrap--stack');
    const stacked = render(host => (host.stack = true)).element.querySelector('.table-wrap')!;
    expect(stacked.classList).toContain('table-wrap--stack');
    expect(stacked.querySelector('td')?.getAttribute('data-label')).toBe('Product');
  });

  it('says what to do next when there are no rows', () => {
    const { element } = render(host => (host.rows = []));
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('app-empty-state')).not.toBeNull();
  });

  it('names the table for assistive tech', () => {
    expect(render().element.querySelector('table')?.getAttribute('aria-label')).toBe('Products');
  });
});
