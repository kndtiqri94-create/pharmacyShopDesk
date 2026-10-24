import { TestBed } from '@angular/core/testing';
import { SETTINGS_SEED } from '../../../../core/services/data/in-memory/seed/settings.seed';
import { toDraft } from '../../../../core/utils/settings-diff.util';
import {
  SettingsDraft,
  SettingsFieldErrors,
} from '../../../../core/utils/settings-validation.util';
import { PointOfSaleSectionComponent } from './point-of-sale-section.component';

describe('PointOfSaleSectionComponent', () => {
  const draft: SettingsDraft = toDraft(SETTINGS_SEED);

  function render(errors: SettingsFieldErrors = {}, disabled = false) {
    const fixture = TestBed.createComponent(PointOfSaleSectionComponent);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('errors', errors);
    fixture.componentRef.setInput('disabled', disabled);
    const patches: Partial<SettingsDraft>[] = [];
    fixture.componentInstance.changed.subscribe(patch => patches.push(patch));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector(`#settings-${id}`) as HTMLInputElement;
    return { fixture, element, input, patches };
  }

  it('shows the five point of sale settings from the draft with the sample values', () => {
    const { element, input } = render();
    expect(input('posLineDiscountEnabled').checked).toBeTrue();
    expect(input('posBillDiscountEnabled').checked).toBeTrue();
    expect(input('posDefaultDiscountPercent').value).toBe('0');
    expect(input('posMaxDiscountPercent').value).toBe('20');
    expect(input('posHideSidebar').checked).toBeTrue();
    expect(element.textContent).toContain('Hide sidebar when POS opens');
    expect(element.textContent).toContain('Maximum discount');
  });

  it('emits the typed percentage and the checked state of an option', () => {
    const { fixture, input, patches } = render();
    input('posMaxDiscountPercent').value = '15';
    input('posMaxDiscountPercent').dispatchEvent(new Event('input'));
    input('posHideSidebar').click();
    input('posLineDiscountEnabled').click();
    fixture.detectChanges();
    expect(patches).toEqual([
      { posMaxDiscountPercent: '15' },
      { posHideSidebar: false },
      { posLineDiscountEnabled: false },
    ]);
  });

  it('shows a field error and limits how long a percentage can be typed', () => {
    const { element, input } = render({ posDefaultDiscountPercent: 'Enter a percentage' });
    expect(
      element.querySelector('#settings-posDefaultDiscountPercent-error')?.textContent
    ).toContain('Enter a percentage');
    expect(input('posMaxDiscountPercent').getAttribute('maxlength')).toBe('6');
  });

  it('disables the inputs and the options for someone who cannot change settings', () => {
    const { element, input } = render({}, true);
    expect(input('posDefaultDiscountPercent').disabled).toBeTrue();
    for (const fieldset of Array.from(element.querySelectorAll('fieldset'))) {
      expect(fieldset.disabled).toBeTrue();
    }
  });
});
