import { TestBed } from '@angular/core/testing';
import { CurrencyRegionSectionComponent } from './currency-region-section.component';

describe('CurrencyRegionSectionComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(CurrencyRegionSectionComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return { element, input: (id: string) => element.querySelector(`#${id}`) as HTMLInputElement };
  }

  it('shows currency, date format and time zone as fixed read-only values', () => {
    const { element, input } = render();
    expect(input('settings-currency').value).toBe('Lankan rupee (LKR)');
    expect(input('settings-time-zone').value).toBe('Asia/Colombo');
    expect(input('settings-date-format').value.length).toBeGreaterThan(0);
    for (const id of ['settings-currency', 'settings-date-format', 'settings-time-zone']) {
      expect(input(id).readOnly).toBeTrue();
    }
    expect(element.textContent?.match(/Fixed for this shop\./g)).toHaveSize(3);
  });
});
