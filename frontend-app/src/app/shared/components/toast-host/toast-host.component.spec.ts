import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  it('keeps an output live region in the page and shows the current message', () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('output')).not.toBeNull();
    expect(element.textContent).not.toContain('sample only');

    const service = TestBed.inject(NotificationService);
    service.showSampleOnly('Search');
    fixture.detectChanges();
    expect(element.textContent).toContain('Search is sample only');
    service.dismiss();
  });

  it('dismisses the message from the dismiss button', () => {
    const fixture = TestBed.createComponent(ToastHostComponent);
    const service = TestBed.inject(NotificationService);
    service.show('info', 'Hello');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.current()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Hello');
  });
});
