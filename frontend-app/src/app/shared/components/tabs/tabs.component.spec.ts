import { TestBed } from '@angular/core/testing';
import { TabItem } from './tab-item.model';
import { TabsComponent } from './tabs.component';

describe('TabsComponent', () => {
  const items: TabItem[] = [
    { id: 'staff', label: 'Staff', count: 8 },
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave', count: 1 },
  ];

  function render(list: TabItem[] = items) {
    const fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('items', list);
    fixture.componentRef.setInput('ariaLabel', 'Employee sections');
    fixture.componentRef.setInput('value', 'staff');
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const tabs = (element: HTMLElement) =>
    Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));

  it('marks the selected tab and puts only it in the tab order', () => {
    const list = tabs(render().element);
    expect(list.map(tab => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(list.map(tab => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('selects a tab on click', () => {
    const { fixture, element } = render();
    tabs(element)[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('leave');
  });

  it('moves with arrow keys, Home and End, wrapping around', () => {
    const { fixture, element } = render();
    const press = (key: string, index: number) => {
      tabs(element)[index].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    press('ArrowRight', 0);
    expect(fixture.componentInstance.value()).toBe('attendance');
    press('ArrowLeft', 1);
    press('ArrowLeft', 0);
    expect(fixture.componentInstance.value()).toBe('leave');
    press('Home', 2);
    expect(fixture.componentInstance.value()).toBe('staff');
    press('End', 0);
    expect(fixture.componentInstance.value()).toBe('leave');
  });

  it('ignores other keys', () => {
    const { fixture, element } = render();
    tabs(element)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(fixture.componentInstance.value()).toBe('staff');
  });

  it('shows at most five tabs', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `t${index}`,
      label: `Tab ${index}`,
    }));
    expect(tabs(render(many).element)).toHaveSize(5);
  });

  it('shows plain count badges only when a count is given', () => {
    const { element } = render();
    expect(element.querySelectorAll('app-badge')).toHaveSize(2);
  });
});
