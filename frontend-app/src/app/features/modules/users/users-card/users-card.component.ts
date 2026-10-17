import { Component, computed, input, output } from '@angular/core';
import { UserStatus } from '../../../../core/models/enums/user-status.enum';
import { USER_STATUS_DISPLAY } from '../../../../core/utils/status-display.util';
import {
  UserRow,
  formatActiveUsers,
  formatLastSignIn,
  formatUserSubline,
} from '../../../../core/utils/user-list.util';
import { formatUserRoleLabel } from '../../../../core/utils/user-role-label.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-users-card',
  imports: [AvatarComponent, BadgeComponent, CardComponent, IconComponent],
  templateUrl: './users-card.component.html',
  styleUrl: './users-card.component.scss',
})
export class UsersCardComponent {
  readonly rows = input.required<readonly UserRow[]>();
  readonly currentUserId = input<string | null>(null);
  readonly canEdit = input(false);
  readonly editUser = output<UserRow>();
  readonly toggleLock = output<UserRow>();

  protected readonly subtitle = computed(() => formatActiveUsers(this.rows().map(row => row.user)));
  protected readonly roleLabel = formatUserRoleLabel;
  protected readonly subline = formatUserSubline;
  protected readonly lastSignIn = (row: UserRow) => formatLastSignIn(row.user.lastSignIn);
  protected readonly statusOf = (row: UserRow) => USER_STATUS_DISPLAY[row.user.status];

  protected isOwnRow(row: UserRow): boolean {
    return row.user.id === this.currentUserId();
  }

  protected lockLabel(row: UserRow): string {
    if (this.isOwnRow(row))
      return `Disable ${row.user.displayName} (you cannot disable your own sign-in)`;
    const verb = row.user.status === UserStatus.ACTIVE ? 'Disable' : 'Enable';
    return `${verb} ${row.user.displayName}`;
  }
}
