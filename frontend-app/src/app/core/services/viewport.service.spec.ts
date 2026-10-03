import { TestBed } from '@angular/core/testing';
import { DESKTOP_MIN_WIDTH_PX, DRAWER_MEDIA_QUERY } from '../utils/breakpoints.const';
import { ViewportService } from './viewport.service';

describe('ViewportService', () => {
  it('matches the drawer query to the window width', () => {
    const service = TestBed.inject(ViewportService);
    expect(service.isDrawerMode()).toBe(matchMedia(DRAWER_MEDIA_QUERY).matches);
  });

  it('treats widths below the desktop minimum as drawer mode', () => {
    expect(DRAWER_MEDIA_QUERY).toContain(`${DESKTOP_MIN_WIDTH_PX - 0.02}px`);
    expect(DESKTOP_MIN_WIDTH_PX).toBe(1280);
  });
});
