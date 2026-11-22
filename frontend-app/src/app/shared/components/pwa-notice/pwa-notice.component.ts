import { Component, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-pwa-notice',
  imports: [ButtonComponent],
  templateUrl: './pwa-notice.component.html',
  styleUrl: './pwa-notice.component.scss',
})
export class PwaNoticeComponent {
  private readonly pwaUpdateService = inject(PwaUpdateService);
  private readonly pwaInstallService = inject(PwaInstallService);

  protected readonly updateAvailable = this.pwaUpdateService.updateAvailable;
  protected readonly canInstall = this.pwaInstallService.canInstall;

  protected applyUpdate(): void {
    this.pwaUpdateService.applyUpdate().catch(() => this.pwaUpdateService.dismiss());
  }

  protected dismissUpdate(): void {
    this.pwaUpdateService.dismiss();
  }

  protected install(): void {
    this.pwaInstallService.install().catch(() => undefined);
  }
}
