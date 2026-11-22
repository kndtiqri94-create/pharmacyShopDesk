import { TestBed } from '@angular/core/testing';
import { SupplierActivityItem } from '../../../../core/utils/supplier-activity.util';
import { SupplierActivityListComponent } from './supplier-activity-list.component';

const items: SupplierActivityItem[] = [
  {
    key: 'a',
    date: '2026-09-18',
    text: 'GRN-0208 received',
    stateLabel: 'Unpaid',
    tone: 'warning',
    rank: 2,
  },
  {
    key: 'b',
    date: '2026-09-10',
    text: 'PO-0148 sent',
    stateLabel: 'Overdue',
    tone: 'danger',
    rank: 1,
  },
];

describe('SupplierActivityListComponent', () => {
  function render(list: SupplierActivityItem[]) {
    const fixture = TestBed.createComponent(SupplierActivityListComponent);
    fixture.componentRef.setInput('items', list);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists each event with its date and a state word', () => {
    const element = render(items);
    const rows = element.querySelectorAll('li');
    expect(rows).toHaveSize(2);
    expect(rows[0].textContent).toContain('GRN-0208 received');
    expect(rows[0].textContent).toContain('18 Sep 2026');
    expect(rows[0].querySelector('app-badge')?.textContent).toContain('Unpaid');
    expect(rows[1].querySelector('app-badge')?.textContent).toContain('Overdue');
  });

  it('says plainly when there is nothing yet', () => {
    const element = render([]);
    expect(element.querySelector('li')).toBeNull();
    expect(element.textContent).toContain('Nothing has happened');
  });
});
