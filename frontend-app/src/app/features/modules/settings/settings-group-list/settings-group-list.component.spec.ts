import { TestBed } from '@angular/core/testing';
import { SettingsGroupId } from '../../../../core/utils/settings-validation.util';
import { SettingsGroupListComponent } from './settings-group-list.component';

describe('SettingsGroupListComponent', () => {
  function render(active: SettingsGroupId = 'shop-profile') {
    const fixture = TestBed.createComponent(SettingsGroupListComponent);
    fixture.componentRef.setInput('active', active);
    const chosen: SettingsGroupId[] = [];
    fixture.componentInstance.selected.subscribe(id => chosen.push(id));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => Array.from(element.querySelectorAll<HTMLButtonElement>('button'));
    return { fixture, element, buttons, chosen };
  }

  it('lists the four groups in a list of real buttons', () => {
    const { element, buttons } = render();
    expect(buttons().map(button => button.textContent?.trim())).toEqual([
      'Shop profile',
      'Currency & region',
      'Inventory alerts',
      'Backup & sync',
    ]);
    expect(element.querySelectorAll('ul > li')).toHaveSize(4);
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Setting groups');
    expect(buttons().every(button => button.type === 'button')).toBeTrue();
  });

  it('marks only the current group, in words and for assistive technology', () => {
    const { fixture, element, buttons } = render('inventory-alerts');
    expect(buttons().map(button => button.getAttribute('aria-current'))).toEqual([
      null,
      null,
      'true',
      null,
    ]);
    expect(element.querySelectorAll('.group--active')).toHaveSize(1);
    fixture.componentRef.setInput('active', 'backup-sync');
    fixture.detectChanges();
    expect(buttons()[3].getAttribute('aria-current')).toBe('true');
    expect(buttons()[2].getAttribute('aria-current')).toBeNull();
  });

  it('tells the page which group was chosen by pointer or keyboard', () => {
    const { buttons, chosen } = render();
    buttons()[1].click();
    buttons()[3].focus();
    buttons()[3].click();
    expect(chosen).toEqual(['currency-region', 'backup-sync']);
  });
});
