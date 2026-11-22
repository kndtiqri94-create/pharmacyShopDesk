import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { RolePermissionMatrix } from '../../../../core/models/domain/role-permission-matrix.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionLevel } from '../../../../core/models/enums/permission-level.enum';
import { UserRole } from '../../../../core/models/enums/user-role.enum';
import { RoleAdminService } from '../../../../core/services/role-admin.service';
import {
  EDITABLE_ROLES,
  MATRIX_MODULES,
  PERMISSION_LEVELS,
  diffMatrix,
  isPermissionLevel,
  setMatrixCell,
} from '../../../../core/utils/permission-matrix.util';
import {
  PERMISSION_LEVEL_LABELS,
  formatUserRoleLabel,
} from '../../../../core/utils/user-role-label.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SidePanelComponent } from '../../../../shared/components/side-panel/side-panel.component';

@Component({
  selector: 'app-edit-roles-panel',
  imports: [ButtonComponent, SidePanelComponent],
  templateUrl: './edit-roles-panel.component.html',
  styleUrl: './edit-roles-panel.component.scss',
})
export class EditRolesPanelComponent {
  readonly open = input(false);
  readonly matrix = input.required<RolePermissionMatrix>();
  readonly saved = output<RolePermissionMatrix>();
  readonly discarded = output<void>();

  private readonly roleAdminService = inject(RoleAdminService);

  protected readonly modules = MATRIX_MODULES;
  protected readonly editableRoles = EDITABLE_ROLES;
  protected readonly levels = PERMISSION_LEVELS;
  protected readonly roleLabel = formatUserRoleLabel;
  protected readonly levelLabels = PERMISSION_LEVEL_LABELS;
  protected readonly adminLevel = PERMISSION_LEVEL_LABELS[PermissionLevel.FULL];
  protected readonly adminRole = UserRole.ADMIN;
  protected readonly initialFocus = 'select';
  protected readonly draft = linkedSignal<RolePermissionMatrix>(() => {
    this.open();
    return this.matrix();
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly changeCount = computed(() => diffMatrix(this.matrix(), this.draft()).length);

  protected levelOf(role: UserRole, module: ModuleKey): PermissionLevel {
    return this.draft()[role][module];
  }

  protected onChange(role: UserRole, module: ModuleKey, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (!isPermissionLevel(value)) return;
    this.draft.update(current => setMatrixCell(current, role, module, value));
    this.error.set(null);
  }

  protected discard(): void {
    this.draft.set(this.matrix());
    this.error.set(null);
    this.discarded.emit();
  }

  protected save(): void {
    this.submit().catch(() => this.saving.set(false));
  }

  private async submit(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const result = await this.roleAdminService.saveMatrix(this.draft());
    this.saving.set(false);
    if (result.ok) {
      this.error.set(null);
      this.saved.emit(result.matrix);
      return;
    }
    this.error.set(
      result.reason === 'denied'
        ? 'You do not have access to change permissions.'
        : 'Some of the choices are not valid. Check each choice and try again.'
    );
  }
}
