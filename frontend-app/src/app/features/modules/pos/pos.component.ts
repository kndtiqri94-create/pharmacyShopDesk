import {
  Component,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { DiscountApproval } from '../../../core/models/domain/discount-approval.model';
import { Sale } from '../../../core/models/domain/sale.model';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PosFullscreenService } from '../../../core/services/pos-fullscreen.service';
import { PosActionResult, PosService } from '../../../core/services/pos.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { PosShortcutAction, shortcutActionFor } from '../../../core/utils/pos-shortcut.util';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DiscountApprovalDialogComponent } from './discount-approval-dialog/discount-approval-dialog.component';
import { DiscountDialogResult } from './discount-dialog-result.model';
import { HeldBillsDialogComponent } from './held-bills-dialog/held-bills-dialog.component';
import { PendingApproval } from './pending-approval.model';
import { PosActionsComponent } from './pos-actions/pos-actions.component';
import { PosBillHeaderComponent } from './pos-bill-header/pos-bill-header.component';
import { PosBillLinesComponent } from './pos-bill-lines/pos-bill-lines.component';
import { PosHeaderComponent } from './pos-header/pos-header.component';
import { PosPaymentComponent } from './pos-payment/pos-payment.component';
import { PosProductSearchComponent } from './pos-product-search/pos-product-search.component';
import { PosReceiptComponent } from './pos-receipt/pos-receipt.component';
import { PosTotalsComponent } from './pos-totals/pos-totals.component';

type ConfirmKind = 'NEW' | 'REFRESH' | 'LEAVE';

interface ConfirmCopy {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

const CONFIRM_COPY: Record<ConfirmKind, ConfirmCopy> = {
  NEW: {
    title: 'Start a new bill?',
    message: 'This bill has items that are not saved. Starting a new bill clears them.',
    confirmLabel: 'Clear and start new',
    cancelLabel: 'Keep this bill',
  },
  REFRESH: {
    title: 'Refresh the till?',
    message:
      'Refreshing reloads products and settings, and clears this bill. The items on it are not saved.',
    confirmLabel: 'Refresh and clear',
    cancelLabel: 'Keep this bill',
  },
  LEAVE: {
    title: 'Leave the till?',
    message: 'This bill has items that are not saved. If you leave, they are cleared.',
    confirmLabel: 'Leave and clear',
    cancelLabel: 'Stay on the till',
  },
};

@Component({
  selector: 'app-pos',
  imports: [
    AlertComponent,
    CardComponent,
    ConfirmDialogComponent,
    DiscountApprovalDialogComponent,
    HeldBillsDialogComponent,
    PosActionsComponent,
    PosBillHeaderComponent,
    PosBillLinesComponent,
    PosHeaderComponent,
    PosPaymentComponent,
    PosProductSearchComponent,
    PosReceiptComponent,
    PosTotalsComponent,
  ],
  providers: [PosFullscreenService],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(window:beforeunload)': 'onBeforeUnload($event)',
  },
})
export class PosComponent implements OnInit, OnDestroy {
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly shellStateService = inject(ShellStateService);
  private readonly searchComponent = viewChild(PosProductSearchComponent);
  private readonly paymentComponent = viewChild(PosPaymentComponent);
  private leaveDecision: ((stay: boolean) => void) | null = null;
  private destroyed = false;

  protected readonly posService = inject(PosService);
  protected readonly pendingApproval = signal<PendingApproval | null>(null);
  protected readonly heldOpen = signal(false);
  protected readonly receiptSale = signal<Sale | null>(null);
  protected readonly confirmKind = signal<ConfirmKind | null>(null);
  protected readonly confirmCopy = computed(() => {
    const kind = this.confirmKind();
    return kind === null ? CONFIRM_COPY.NEW : CONFIRM_COPY[kind];
  });
  protected readonly anyDialogOpen = computed(
    () =>
      this.pendingApproval() !== null ||
      this.heldOpen() ||
      this.receiptSale() !== null ||
      this.confirmKind() !== null
  );

  ngOnInit(): void {
    this.initialise().catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.leaveDecision?.(false);
    this.leaveDecision = null;
    this.posService.close();
    this.shellStateService.setSidebarHidden(false);
  }

  confirmLeave(): boolean | Promise<boolean> {
    if (!this.authService.isSignedIn()) {
      this.posService.close();
      return true;
    }
    if (!this.posService.hasUnsavedContent()) return true;
    return new Promise<boolean>(resolve => {
      this.leaveDecision = stay => resolve(!stay);
      this.confirmKind.set('LEAVE');
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const action = shortcutActionFor(event);
    if (action === null) return;
    event.preventDefault();
    if (event.repeat || this.anyDialogOpen()) return;
    this.runShortcut(action);
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.posService.hasUnsavedContent()) event.preventDefault();
  }

  protected requestRefresh(): void {
    if (this.posService.hasUnsavedContent()) this.confirmKind.set('REFRESH');
    else this.refresh();
  }

  protected requestNewBill(): void {
    if (this.posService.hasUnsavedContent()) this.confirmKind.set('NEW');
    else this.startNewBill();
  }

  protected goBack(): void {
    const target = this.permissionService.canView(ModuleKey.DASHBOARD)
      ? '/dashboard'
      : this.permissionService.firstAllowedPath();
    this.router.navigateByUrl(target).catch(() => undefined);
  }

  protected confirmed(): void {
    const kind = this.confirmKind();
    this.confirmKind.set(null);
    if (kind === 'LEAVE') this.decideLeave(false);
    if (kind === 'NEW') this.startNewBill();
    if (kind === 'REFRESH') this.refresh();
  }

  protected cancelled(): void {
    const kind = this.confirmKind();
    this.confirmKind.set(null);
    if (kind === 'LEAVE') this.decideLeave(true);
  }

  protected save(print: boolean): void {
    this.saveBill(print).catch(() => undefined);
  }

  protected hold(): void {
    this.holdBill().catch(() => undefined);
  }

  protected resume(heldId: string): void {
    this.resumeBill(heldId).catch(() => undefined);
  }

  protected discard(heldId: string): void {
    this.discardBill(heldId).catch(() => undefined);
  }

  protected openApproval(pending: PendingApproval): void {
    this.pendingApproval.set(pending);
  }

  protected onApprovalFinished(result: DiscountDialogResult): void {
    const pending = this.pendingApproval();
    this.pendingApproval.set(null);
    if (pending === null) return;
    if (result.kind === 'REJECTED') {
      this.revertDiscount(pending);
      this.notificationService.show('warning', result.message);
      return;
    }
    const outcome = this.applyApproved(pending, result.approval);
    if (outcome.ok) {
      this.notificationService.show(
        'success',
        `Discount approved by ${result.approval.approverName}.`
      );
      return;
    }
    this.revertDiscount(pending);
    this.notificationService.show('warning', outcome.message);
  }

  protected closeReceipt(): void {
    this.receiptSale.set(null);
    this.focusSearch();
  }

  protected closeHeld(): void {
    this.heldOpen.set(false);
    this.focusSearch();
  }

  private applyApproved(pending: PendingApproval, approval: DiscountApproval): PosActionResult {
    const { request, billInput } = pending;
    if (request.scope === 'LINE') {
      return this.posService.setLineDiscount(request.productId ?? '', request.percent, approval);
    }
    return billInput === null
      ? { ok: false, message: 'That discount could not be applied.' }
      : this.posService.setBillDiscount(billInput, approval);
  }

  private revertDiscount(pending: PendingApproval): void {
    if (pending.request.scope === 'LINE') {
      this.posService.resetLineDiscount(pending.request.productId ?? '');
    } else {
      this.posService.resetBillDiscount();
    }
  }

  private runShortcut(action: PosShortcutAction): void {
    const handlers: Record<PosShortcutAction, () => void> = {
      SAVE_AND_PRINT: () => this.save(true),
      SAVE: () => this.save(false),
      PAY_CASH: () => this.paymentComponent()?.selectMethod('cash'),
      PAY_CARD: () => this.paymentComponent()?.selectMethod('card'),
      PAY_ONLINE: () => this.paymentComponent()?.selectMethod('online'),
      HOLD: () => this.hold(),
      NEW_BILL: () => this.requestNewBill(),
    };
    handlers[action]();
  }

  private decideLeave(stay: boolean): void {
    this.leaveDecision?.(stay);
    this.leaveDecision = null;
  }

  private async initialise(): Promise<void> {
    await this.posService.open();
    if (this.destroyed) {
      this.posService.close();
      return;
    }
    this.shellStateService.setSidebarHidden(this.posService.settings().hideSidebarOnOpen);
    this.focusSearch();
  }

  private async saveBill(print: boolean): Promise<void> {
    const result = await this.posService.saveBill();
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.notificationService.show('success', `Sale ${result.sale.invoiceNo} saved.`);
    if (print) this.receiptSale.set(result.sale);
    else this.focusSearch();
  }

  private async holdBill(): Promise<void> {
    const result = await this.posService.holdBill();
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.notificationService.show('success', `Bill held as ${result.held.holdNo}.`);
    this.focusSearch();
  }

  private async resumeBill(heldId: string): Promise<void> {
    const result = await this.posService.resumeHeldBill(heldId);
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.heldOpen.set(false);
    const parts = ['Held bill resumed.'];
    if (result.autoHeld) {
      parts.push(`Your earlier bill was put on hold as ${result.autoHeld.holdNo}.`);
    }
    parts.push(...result.notes);
    this.notificationService.show(result.notes.length > 0 ? 'warning' : 'success', parts.join(' '));
    this.focusSearch();
  }

  private async discardBill(heldId: string): Promise<void> {
    const result = await this.posService.discardHeldBill(heldId);
    this.notificationService.show(
      result.ok ? 'success' : 'warning',
      result.ok ? 'Held bill discarded.' : result.message
    );
  }

  private startNewBill(): void {
    this.posService
      .newBill()
      .then(() => this.focusSearch())
      .catch(() => undefined);
  }

  private refresh(): void {
    this.posService
      .refresh()
      .then(() => this.focusSearch())
      .catch(() => undefined);
  }

  private focusSearch(): void {
    afterNextRender(() => this.searchComponent()?.focus(), { injector: this.injector });
  }
}
