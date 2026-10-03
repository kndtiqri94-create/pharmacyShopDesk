import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { ThemePreferenceService } from '../../../core/services/theme-preference.service';
import { ThemePreference } from '../../../core/models/enums/theme-preference.enum';
import { formatSessionRoleLabel } from '../../../core/utils/user-role-label.util';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';
import { SyncPillComponent } from '../sync-pill/sync-pill.component';

@Component({
  selector: 'app-top-bar',
  imports: [AvatarComponent, ButtonComponent, GlobalSearchComponent, SyncPillComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly themePreferenceService = inject(ThemePreferenceService);
  private readonly menuButton = viewChild<ElementRef<HTMLElement>>('menuButton');

  protected readonly shellStateService = inject(ShellStateService);
  protected readonly user = this.authService.currentUser;
  protected readonly roleLabel = computed(() => {
    const user = this.user();
    return user ? formatSessionRoleLabel(user.role) : '';
  });
  protected readonly isDark = computed(
    () => this.themePreferenceService.preference() === ThemePreference.DARK
  );

  focusMenuButton(): void {
    this.menuButton()?.nativeElement.querySelector('button')?.focus();
  }

  protected toggleTheme(): void {
    this.themePreferenceService.toggle();
  }

  protected showNotificationsMessage(): void {
    this.notificationService.showSampleOnly('Notifications');
  }

  protected signOut(): void {
    this.authService.signOut().catch(() => undefined);
  }
}
