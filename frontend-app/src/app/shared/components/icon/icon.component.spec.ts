import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ICON_NAMES } from '../../../core/models/shared/icon-name.model';
import { IconComponent } from './icon.component';
import { ICON_PATHS } from './icon-paths';

describe('IconComponent', () => {
  let fixture: ComponentFixture<IconComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(IconComponent);
    fixture.componentRef.setInput('name', 'search');
    fixture.detectChanges();
  });

  const svg = () => fixture.nativeElement.querySelector('svg') as SVGElement;

  it('draws every required icon name with at least one path', () => {
    const required = [
      'dashboard',
      'package',
      'inbox',
      'clipboard',
      'truck',
      'idcard',
      'phone',
      'shield',
      'settings',
      'search',
      'bell',
      'plus',
      'filter',
      'download',
      'upload',
      'printer',
      'edit',
      'trash',
      'more',
      'eye',
      'eyeoff',
      'check',
      'alert',
      'clock',
      'cloud',
      'down',
      'right',
      'left',
      'x',
      'keyboard',
      'calendar',
      'call',
      'mail',
      'zap',
      'lock',
      'logout',
      'wallet',
      'trend',
      'back',
      'receipt',
      'user',
      'barcode',
      'store',
      'bolt',
    ];
    for (const name of required) {
      expect(ICON_NAMES as readonly string[])
        .withContext(name)
        .toContain(name);
    }
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name].length).withContext(name).toBeGreaterThan(0);
    }
  });

  it('uses the 24px grid, 1.75px round line style and the surrounding text colour', () => {
    expect(svg().getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg().getAttribute('stroke-width')).toBe('1.75');
    expect(svg().getAttribute('stroke')).toBe('currentColor');
    expect(svg().getAttribute('stroke-linecap')).toBe('round');
    expect(svg().getAttribute('fill')).toBe('none');
  });

  it('defaults to 18px and supports 16 and 22', () => {
    expect(svg().getAttribute('width')).toBe('18');
    for (const size of [16, 22]) {
      fixture.componentRef.setInput('size', size);
      fixture.detectChanges();
      expect(svg().getAttribute('width')).toBe(String(size));
    }
  });

  it('hides itself from assistive tech unless it has a label', () => {
    expect(svg().getAttribute('aria-hidden')).toBe('true');
    fixture.componentRef.setInput('label', 'Edit product');
    fixture.detectChanges();
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Edit product');
    expect(svg().getAttribute('aria-hidden')).toBeNull();
  });
});
