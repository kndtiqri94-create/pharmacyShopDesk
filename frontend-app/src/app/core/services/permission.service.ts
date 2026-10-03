import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { RolePermissionMatrix } from '../models/domain/role-permission-matrix.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { PermissionLevel } from '../models/enums/permission-level.enum';
import { MODULE_DEFINITIONS, moduleKeyFromUrl } from '../utils/module-definitions.util';
import { sanitizeReturnUrl } from '../utils/return-url.util';
import { AuthService } from './auth/auth.service';
import { RoleDataService } from './data/role-data.service';

export const ACCESS_DENIED_PATH = '/access-denied';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authService = inject(AuthService);
  private readonly roleDataService = inject(RoleDataService);
  private readonly matrixSignal = signal<RolePermissionMatrix | null>(null);

  readonly matrix = this.matrixSignal.asReadonly();
  readonly allowedModules = computed(() =>
    MODULE_DEFINITIONS.filter(definition => this.levelFor(definition.key) !== PermissionLevel.NONE)
  );

  constructor() {
    this.roleDataService.matrix$
      .pipe(takeUntilDestroyed())
      .subscribe(matrix => this.matrixSignal.set(matrix));
  }

  async load(): Promise<void> {
    this.matrixSignal.set(await firstValueFrom(this.roleDataService.getMatrix()));
  }

  levelFor(module: ModuleKey): PermissionLevel {
    const user = this.authService.currentUser();
    const matrix = this.matrixSignal();
    if (user === null || matrix === null) return PermissionLevel.NONE;
    return matrix[user.role]?.[module] ?? PermissionLevel.NONE;
  }

  canView(module: ModuleKey): boolean {
    return this.levelFor(module) !== PermissionLevel.NONE;
  }

  canWrite(module: ModuleKey): boolean {
    return this.levelFor(module) === PermissionLevel.FULL;
  }

  firstAllowedPath(): string {
    const first = this.allowedModules()[0];
    return first ? `/${first.path}` : ACCESS_DENIED_PATH;
  }

  landingPathFor(returnUrl: string | null): string {
    const safeUrl = sanitizeReturnUrl(returnUrl);
    if (safeUrl === null) return this.firstAllowedPath();
    const key = moduleKeyFromUrl(safeUrl);
    return key !== null && this.canView(key) ? safeUrl : this.firstAllowedPath();
  }
}
