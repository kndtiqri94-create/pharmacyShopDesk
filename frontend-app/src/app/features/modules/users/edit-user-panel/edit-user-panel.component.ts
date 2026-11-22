import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { AppUser } from '../../../../core/models/domain/app-user.model';
import { ALL_USER_ROLES } from '../../../../core/models/enums/user-role.enum';
import { UserAdminService } from '../../../../core/services/user-admin.service';
import { UserRow, formatUserSubline } from '../../../../core/utils/user-list.util';
import { formatUserRoleLabel } from '../../../../core/utils/user-role-label.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { SidePanelComponent } from '../../../../shared/components/side-panel/side-panel.component';

export const EDIT_ROLE_FIELD_ID = 'edit-user-role';

@Component({
  selector: 'app-edit-user-panel',
  imports: [...FIELD_IMPORTS, ButtonComponent, SidePanelComponent],
  templateUrl: './edit-user-panel.component.html',
  styleUrl: './edit-user-panel.component.scss',
})
export class EditUserPanelComponent {
  readonly open = input(false);
  readonly row = input<UserRow | null>(null);
  readonly currentUserId = input<string | null>(null);
  readonly saved = output<AppUser>();
  readonly cancelled = output<void>();

  private readonly userAdminService = inject(UserAdminService);

  protected readonly roles = ALL_USER_ROLES;
  protected readonly roleFieldId = EDIT_ROLE_FIELD_ID;
  protected readonly initialFocus = `#${EDIT_ROLE_FIELD_ID}`;
  protected readonly roleLabel = formatUserRoleLabel;
  protected readonly subline = formatUserSubline;
  protected readonly role = linkedSignal<string>(() => {
    this.open();
    return this.row()?.user.role ?? '';
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly isOwnAccount = computed(
    () => this.row() !== null && this.row()?.user.id === this.currentUserId()
  );

  protected onRoleChange(event: Event): void {
    this.role.set((event.target as HTMLSelectElement).value);
    this.error.set(null);
  }

  protected cancel(): void {
    this.error.set(null);
    this.cancelled.emit();
  }

  protected save(): void {
    this.submit().catch(() => this.saving.set(false));
  }

  private async submit(): Promise<void> {
    const row = this.row();
    if (row === null || this.saving()) return;
    this.saving.set(true);
    const result = await this.userAdminService.changeRole(row.user.id, this.role());
    this.saving.set(false);
    if (result.ok) {
      this.error.set(null);
      this.saved.emit(result.user);
      return;
    }
    this.error.set(
      result.reason === 'own-account'
        ? 'You cannot change your own role.'
        : 'Choose a role to save.'
    );
  }
}
