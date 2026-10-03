import { Component, inject } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';
import { AlertComponent } from '../alert/alert.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-toast-host',
  imports: [AlertComponent, ButtonComponent],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  private readonly notificationService = inject(NotificationService);

  protected readonly notification = this.notificationService.current;

  protected dismiss(): void {
    this.notificationService.dismiss();
  }
}
