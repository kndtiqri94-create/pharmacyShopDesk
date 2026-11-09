import { Injectable, inject } from '@angular/core';
import { AppUser } from '../models/domain/app-user.model';
import { ModuleKey } from '../models/enums/module-key.enum';
import { AuthService } from './auth/auth.service';
import { PermissionService } from './permission.service';
import { PosFailure, PosFailureResult } from './pos-sale.service';

export const BUSY_MESSAGE = 'The last action is still finishing. Try again in a moment.';
export const DAY_LOCKED_MESSAGE = 'That day is closed and locked, so it cannot be changed.';

export const CASH_REFUND_LOCKED_MESSAGE =
  'The counter is closed for today, so a cash refund cannot be given. Choose Customer credit instead.';
export const CASH_PAYMENT_LOCKED_MESSAGE =
  'The counter is closed for today, so a cash payment cannot be taken. Use Card or Online instead.';

export function posFailure(reason: PosFailure, message: string): PosFailureResult {
  return { ok: false, reason, message };
}

@Injectable({ providedIn: 'root' })
export class PosWriteGuard {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly busyScopes = new Set<string>();

  async run<T>(
    scope: string,
    deniedMessage: string,
    work: (user: AppUser) => Promise<T>
  ): Promise<T | PosFailureResult> {
    const user = this.authService.currentUser();
    if (user === null || !this.permissionService.canWrite(ModuleKey.POS)) {
      return posFailure('denied', deniedMessage);
    }
    if (this.busyScopes.has(scope)) return posFailure('busy', BUSY_MESSAGE);
    this.busyScopes.add(scope);
    try {
      return await work(user);
    } finally {
      this.busyScopes.delete(scope);
    }
  }
}
