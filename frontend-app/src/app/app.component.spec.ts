import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NEVER } from 'rxjs';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('hosts the router outlet and the message region', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: NEVER } },
      ],
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(element.querySelector('app-toast-host output')).not.toBeNull();
    expect(element.querySelector('app-pwa-notice output')).not.toBeNull();
  });
});
