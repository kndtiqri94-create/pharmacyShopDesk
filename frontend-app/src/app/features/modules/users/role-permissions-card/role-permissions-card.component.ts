import { Component, input, output } from '@angular/core';
import { CanWriteDirective } from '../../../../core/directives/permission-write.directive';
import { RolePermissionMatrix } from '../../../../core/models/domain/role-permission-matrix.model';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { ALL_USER_ROLES } from '../../../../core/models/enums/user-role.enum';
import { MATRIX_MODULES } from '../../../../core/utils/permission-matrix.util';
import {
  PERMISSION_LEVEL_LABELS,
  PERMISSION_LEVEL_TONES,
  formatUserRoleLabel,
} from '../../../../core/utils/user-role-label.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-role-permissions-card',
  imports: [BadgeComponent, ButtonComponent, CanWriteDirective, CardComponent],
  templateUrl: './role-permissions-card.component.html',
  styleUrl: './role-permissions-card.component.scss',
})
export class RolePermissionsCardComponent {
  readonly matrix = input.required<RolePermissionMatrix>();
  readonly editRoles = output<void>();

  protected readonly usersModule = ModuleKey.USERS;
  protected readonly modules = MATRIX_MODULES;
  protected readonly roles = ALL_USER_ROLES;
  protected readonly roleLabel = formatUserRoleLabel;
  protected readonly levelLabels = PERMISSION_LEVEL_LABELS;
  protected readonly levelTones = PERMISSION_LEVEL_TONES;
}
