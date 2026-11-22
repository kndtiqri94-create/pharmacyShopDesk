import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearBrowserStorage, TEST_PROVIDERS } from '../../../../../testing/auth-test.util';
import { PosFullscreenService } from '../../../../core/services/pos-fullscreen.service';
import { ThemePreferenceService } from '../../../../core/services/theme-preference.service';
import { PosHeaderComponent } from './pos-header.component';

interface FakeFullscreen {
  supported: boolean;
  isFullscreen: ReturnType<typeof signal<boolean>>;
  toggle: jasmine.Spy;
}

describe('PosHeaderComponent', () => {
  beforeEach(() => clearBrowserStorage());

  afterEach(() => {
    TestBed.inject(ThemePreferenceService).set('LIGHT');
    clearBrowserStorage();
  });

  function render(supported = true) {
    const fullscreen: FakeFullscreen = {
      supported,
      isFullscreen: signal(false),
      toggle: jasmine.createSpy('toggle').and.resolveTo(),
    };
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, { provide: PosFullscreenService, useValue: fullscreen }],
    });
    const fixture = TestBed.createComponent(PosHeaderComponent);
    const events = { refresh: 0, back: 0 };
    fixture.componentInstance.refreshRequested.subscribe(() => (events.refresh += 1));
    fixture.componentInstance.backRequested.subscribe(() => (events.back += 1));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find(candidate =>
        candidate.textContent?.includes(label)
      );
    return { fixture, element, fullscreen, events, button };
  }

  it('shows the heading, the date and the time', () => {
    const { element } = render();
    expect(element.querySelector('h1')?.textContent).toBe('Point of sale');
    expect(element.querySelector('time')?.textContent).toBe('21 Sep 2026');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe('2026-09-21');
    expect(element.querySelector('[data-testid="pos-time"]')?.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it('offers the dark mode toggle, refresh, full screen and back to back office', () => {
    const { button } = render();
    expect(button('Dark theme')).toBeDefined();
    expect(button('Refresh')).toBeDefined();
    expect(button('Enter full screen')).toBeDefined();
    expect(button('Back to back office')).toBeDefined();
  });

  it('switches the theme from the toggle', () => {
    const { fixture, button } = render();
    button('Dark theme')!.click();
    fixture.detectChanges();
    expect(TestBed.inject(ThemePreferenceService).preference()).toBe('DARK');
    expect(button('Light theme')).toBeDefined();
  });

  it('raises refresh and back without doing anything itself', () => {
    const { button, events } = render();
    button('Refresh')!.click();
    button('Back to back office')!.click();
    expect(events).toEqual({ refresh: 1, back: 1 });
  });

  describe('full screen toggle', () => {
    it('never goes full screen on its own', () => {
      const { fullscreen } = render();
      expect(fullscreen.toggle).not.toHaveBeenCalled();
    });

    it('goes full screen only when clicked', () => {
      const { button, fullscreen } = render();
      button('Enter full screen')!.click();
      expect(fullscreen.toggle).toHaveBeenCalledTimes(1);
    });

    it('names the action it will do, and follows the real state', () => {
      const { fixture, button, fullscreen } = render();
      expect(button('Enter full screen')).toBeDefined();
      expect(button('Exit full screen')).toBeUndefined();
      fullscreen.isFullscreen.set(true);
      fixture.detectChanges();
      expect(button('Exit full screen')).toBeDefined();
      expect(button('Enter full screen')).toBeUndefined();
      fullscreen.isFullscreen.set(false);
      fixture.detectChanges();
      expect(button('Enter full screen')).toBeDefined();
    });

    it('is not shown when the browser cannot do full screen', () => {
      const { element, button } = render(false);
      expect(button('full screen')).toBeUndefined();
      expect(element.querySelectorAll('button')).toHaveSize(3);
    });
  });

  it('makes every control at least 52px by using the extra large size', () => {
    const { element } = render();
    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(candidate => candidate.getAttribute('data-size') === 'xl')).toBeTrue();
  });
});
