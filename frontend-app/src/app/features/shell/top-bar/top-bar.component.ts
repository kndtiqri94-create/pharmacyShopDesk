import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { ThemePreferenceService } from '../../../core/services/theme-preference.service';
import { ThemePreference } from '../../../core/models/enums/theme-preference.enum';
import { moduleKeyFromUrl } from '../../../core/utils/module-definitions.util';
import { SIGN_OUT_WARNING } from '../../../core/utils/sync-text.util';
import { formatSessionRoleLabel } from '../../../core/utils/user-role-label.util';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { SyncPillComponent } from '../sync-pill/sync-pill.component';

@Component({
  selector: 'app-top-bar',
  imports: [
    AvatarComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    GlobalSearchComponent,
    IconComponent,
    SyncPillComponent,
  ],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly syncDataService = inject(SyncDataService);
  private readonly themePreferenceService = inject(ThemePreferenceService);
  private readonly menuButton = viewChild<ElementRef<HTMLElement>>('menuButton');

  protected readonly shellStateService = inject(ShellStateService);
  protected readonly signOutConfirmOpen = signal(false);
  protected readonly signOutWarning = SIGN_OUT_WARNING;
  protected readonly user = this.authService.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? formatSessionRoleLabel(user.role) : '';
  });
  protected readonly showPosButton = computed(() => this.permissionService.canView(ModuleKey.POS));
  protected readonly posActive = computed(
    () => moduleKeyFromUrl(this.shellStateService.currentUrl()) === ModuleKey.POS
  );
  protected readonly isDark = computed(
    () => this.themePreferenceService.preference() === ThemePreference.DARK
  );

  focusMenuButton(): void {
    this.menuButton()?.nativeElement.querySelector('button')?.focus();
  }

  protected openPos(): void {
    this.router.navigateByUrl('/pos').catch(() => undefined);
  }

  protected toggleTheme(): void {
    this.themePreferenceService.toggle();
  }

  protected showNotificationsMessage(): void {
    this.notificationService.showSampleOnly('Notifications');
  }

  protected signOut(): void {
    this.requestSignOut().catch(() => undefined);
  }

  protected confirmSignOut(): void {
    this.signOutConfirmOpen.set(false);
    this.authService.signOut().catch(() => undefined);
  }

  protected cancelSignOut(): void {
    this.signOutConfirmOpen.set(false);
  }

  private async requestSignOut(): Promise<void> {
    const status = await firstValueFrom(this.syncDataService.getStatus());
    if (status.pendingChanges + status.attentionCount > 0) {
      this.signOutConfirmOpen.set(true);
      return;
    }
    await this.authService.signOut();
  }
}
