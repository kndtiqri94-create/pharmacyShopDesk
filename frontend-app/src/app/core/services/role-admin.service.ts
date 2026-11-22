import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RolePermissionMatrix } from '../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { normaliseMatrix } from '../utils/permission-matrix.util';
import { AuthService } from './auth/auth.service';
import { RoleDataService } from './data/role-data.service';
import { PermissionService } from './permission.service';

export type RoleAdminResult =
  { ok: true; matrix: RolePermissionMatrix } | { ok: false; reason: 'denied' | 'invalid' };

@Injectable({ providedIn: 'root' })
export class RoleAdminService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly roleDataService = inject(RoleDataService);

  async saveMatrix(draft: RolePermissionMatrix): Promise<RoleAdminResult> {
    if (
      this.authService.currentUser() === null ||
      !this.permissionService.canWrite(ModuleKey.USERS)
    ) {
      return { ok: false, reason: 'denied' };
    }
    const normalised = normaliseMatrix(draft);
    if (!normalised.ok) return { ok: false, reason: 'invalid' };
    return {
      ok: true,
      matrix: await firstValueFrom(this.roleDataService.saveMatrix(normalised.matrix)),
    };
  }
}
