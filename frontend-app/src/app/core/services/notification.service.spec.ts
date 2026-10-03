import { fakeAsync, tick } from '@angular/core/testing';
import { NOTIFICATION_DISMISS_MS, NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('shows a plain sample-only message without exclamation marks', () => {
    const service = new NotificationService();
    service.showSampleOnly('Search');
    expect(service.current()?.message).toBe('Search is sample only for now and does nothing yet.');
    expect(service.current()?.message).not.toContain('!');
    service.dismiss();
  });

  it('replaces the previous message', () => {
    const service = new NotificationService();
    service.show('info', 'First');
    service.show('warning', 'Second');
    expect(service.current()?.message).toBe('Second');
    expect(service.current()?.tone).toBe('warning');
    service.dismiss();
  });

  it('dismisses on request', () => {
    const service = new NotificationService();
    service.show('success', 'Saved');
    service.dismiss();
    expect(service.current()).toBeNull();
  });

  it('dismisses itself after a while', fakeAsync(() => {
    const service = new NotificationService();
    service.show('info', 'Hello');
    tick(NOTIFICATION_DISMISS_MS);
    expect(service.current()).toBeNull();
  }));
});
