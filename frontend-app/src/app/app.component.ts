import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaNoticeComponent } from './shared/components/pwa-notice/pwa-notice.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, PwaNoticeComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
