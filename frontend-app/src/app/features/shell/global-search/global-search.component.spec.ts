import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../core/services/notification.service';
import { GlobalSearchComponent } from './global-search.component';

describe('GlobalSearchComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(GlobalSearchComponent);
    fixture.detectChanges();
    const notifications = TestBed.inject(NotificationService);
    return { fixture, notifications };
  }

  afterEach(() => TestBed.inject(NotificationService).dismiss());

  it('shows the placeholder text and the Ctrl K hint', () => {
    const { fixture } = render();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Search products, GRN, suppliers…');
    expect(text).toContain('Ctrl K');
  });

  it('gives a sample-only message when used and does not search', () => {
    const { fixture, notifications } = render();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(notifications.current()?.message).toContain('sample only');
  });

  it('reacts to Ctrl K and stops the browser default', () => {
    const { notifications } = render();
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(notifications.current()?.message).toContain('Search is sample only');
  });

  it('ignores the letter k without Ctrl', () => {
    const { notifications } = render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(notifications.current()).toBeNull();
  });

  it('stops listening once the component is destroyed', () => {
    const { fixture, notifications } = render();
    fixture.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(notifications.current()).toBeNull();
  });
});
