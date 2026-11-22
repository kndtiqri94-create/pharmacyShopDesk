import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DiscountApproval } from '../models/domain/discount-approval.model';
import { DiscountScope } from '../models/enums/discount-scope.enum';
import { ModuleKey } from '../models/enums/module-key.enum';
import { UserRole } from '../models/enums/user-role.enum';
import { UserStatus } from '../models/enums/user-status.enum';
import { samePercent } from '../utils/pos-discount.util';
import { AuthService } from './auth/auth.service';
import { ClockService } from './clock.service';
import { UserDataService } from './data/user-data.service';
import { PermissionService } from './permission.service';

export interface DiscountChangeRequest {
  scope: DiscountScope;
  productId: string | null;
  percent: number;
}

export type DiscountApprovalFailure = 'denied' | 'busy' | 'not-accepted' | 'not-admin';

export type DiscountApprovalResult =
  { ok: true; approval: DiscountApproval } | { ok: false; reason: DiscountApprovalFailure };

@Injectable({ providedIn: 'root' })
export class PosDiscountApprovalService {
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly userDataService = inject(UserDataService);
  private readonly clockService = inject(ClockService);
  private readonly issued = new WeakSet<DiscountApproval>();
  private busy = false;

  async approve(
    change: DiscountChangeRequest,
    username: string,
    password: string
  ): Promise<DiscountApprovalResult> {
    if (
      this.authService.currentUser() === null ||
      !this.permissionService.canWrite(ModuleKey.POS)
    ) {
      return { ok: false, reason: 'denied' };
    }
    if (this.busy) return { ok: false, reason: 'busy' };
    this.busy = true;
    try {
      const userId = await this.authService.verifyCredentials(username, password);
      if (userId === null) return { ok: false, reason: 'not-accepted' };
      const approver = await firstValueFrom(this.userDataService.getById(userId));
      if (approver === null || approver.status !== UserStatus.ACTIVE) {
        return { ok: false, reason: 'not-admin' };
      }
      if (approver.role !== UserRole.ADMIN) return { ok: false, reason: 'not-admin' };
      const approval: DiscountApproval = Object.freeze({
        scope: change.scope,
        productId: change.productId,
        percent: change.percent,
        approverUserId: approver.id,
        approverName: approver.displayName,
        approvedAt: this.clockService.now(),
      });
      this.issued.add(approval);
      return { ok: true, approval };
    } finally {
      this.busy = false;
    }
  }

  redeem(
    approval: DiscountApproval | null,
    scope: DiscountScope,
    productId: string | null,
    percent: number
  ): boolean {
    if (approval === null || !this.issued.has(approval)) return false;
    const matches =
      approval.scope === scope &&
      approval.productId === productId &&
      samePercent(approval.percent, percent);
    if (!matches) return false;
    this.issued.delete(approval);
    return true;
  }
}
