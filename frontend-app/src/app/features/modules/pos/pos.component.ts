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
import { CounterReport } from '../../../core/models/domain/counter-report.model';
import { DiscountApproval } from '../../../core/models/domain/discount-approval.model';
import { DuePayment } from '../../../core/models/domain/due-payment.model';
import { SaleReturn } from '../../../core/models/domain/sale-return.model';
import { Sale } from '../../../core/models/domain/sale.model';
import { BillType } from '../../../core/models/enums/bill-type.enum';
import { ModuleKey } from '../../../core/models/enums/module-key.enum';
import { AuthService } from '../../../core/services/auth/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { PosFullscreenService } from '../../../core/services/pos-fullscreen.service';
import { PosReturnService } from '../../../core/services/pos-return.service';
import { PosActionResult, PosService } from '../../../core/services/pos.service';
import { ShellStateService } from '../../../core/services/shell-state.service';
import { canSeeCostPrice } from '../../../core/utils/cost-visibility.util';
import { getModuleDefinition } from '../../../core/utils/module-definitions.util';
import { PosShortcutAction, shortcutActionFor } from '../../../core/utils/pos-shortcut.util';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { CardComponent } from '../../../shared/components/card/card.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AddObDialogComponent } from './add-ob-dialog/add-ob-dialog.component';
import { CashBookDialogComponent } from './cash-book-dialog/cash-book-dialog.component';
import { CounterCloseDialogComponent } from './counter-close-dialog/counter-close-dialog.component';
import { CounterReportReceiptComponent } from './counter-report-receipt/counter-report-receipt.component';
import { DiscountApprovalDialogComponent } from './discount-approval-dialog/discount-approval-dialog.component';
import { DiscountDialogResult } from './discount-dialog-result.model';
import { DrawerEndDialogComponent } from './drawer-end-dialog/drawer-end-dialog.component';
import { DueAmountDialogComponent } from './due-amount-dialog/due-amount-dialog.component';
import { DuePaymentReceiptComponent } from './due-payment-receipt/due-payment-receipt.component';
import { HeldBillsDialogComponent } from './held-bills-dialog/held-bills-dialog.component';
import {
  LastInvoiceDialogComponent,
  LastInvoicePrint,
} from './last-invoice-dialog/last-invoice-dialog.component';
import { PendingApproval } from './pending-approval.model';
import { PosActionsComponent } from './pos-actions/pos-actions.component';
import { PosBillHeaderComponent } from './pos-bill-header/pos-bill-header.component';
import { PosBillLinesComponent } from './pos-bill-lines/pos-bill-lines.component';
import { BottomBarAction, PosBottomBarComponent } from './pos-bottom-bar/pos-bottom-bar.component';
import { PosHeaderComponent } from './pos-header/pos-header.component';
import { PosItemDetailsDialogComponent } from './pos-item-details-dialog/pos-item-details-dialog.component';
import { PosPaymentComponent } from './pos-payment/pos-payment.component';
import { PosProductSearchComponent } from './pos-product-search/pos-product-search.component';
import { PosReceiptComponent } from './pos-receipt/pos-receipt.component';
import { PosReturnPanelComponent } from './pos-return-panel/pos-return-panel.component';
import { PosReturnReceiptComponent } from './pos-return-receipt/pos-return-receipt.component';
import { PosTotalsComponent } from './pos-totals/pos-totals.component';
import { QuotationsDialogComponent } from './quotations-dialog/quotations-dialog.component';
import { UpdateProductsDialogComponent } from './update-products-dialog/update-products-dialog.component';

type ConfirmKind = 'NEW' | 'REFRESH' | 'LEAVE' | 'LEAVE_RETURN' | 'SAVE_WARNING';

type TillDialog =
  | 'LAST_INVOICE'
  | 'QUOTATIONS'
  | 'CASH_BOOK'
  | 'UPDATE_PRODUCTS'
  | 'ADD_OB'
  | 'COUNTER_CLOSE'
  | 'DRAWER'
  | 'DUE_AMOUNT';

interface ConfirmCopy {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
}

const CONFIRM_COPY: Record<ConfirmKind, ConfirmCopy> = {
  NEW: {
    title: 'Start a new bill?',
    message: 'This bill has items that are not saved. Starting a new bill clears them.',
    confirmLabel: 'Clear and start new',
    cancelLabel: 'Keep this bill',
    danger: true,
  },
  REFRESH: {
    title: 'Refresh the till?',
    message:
      'Refreshing reloads products and settings, and clears this bill. The items on it are not saved.',
    confirmLabel: 'Refresh and clear',
    cancelLabel: 'Keep this bill',
    danger: true,
  },
  LEAVE: {
    title: 'Leave the till?',
    message: 'This bill has items that are not saved. If you leave, they are cleared.',
    confirmLabel: 'Leave and clear',
    cancelLabel: 'Stay on the till',
    danger: true,
  },
  LEAVE_RETURN: {
    title: 'Leave the return?',
    message: 'The return you started is not saved. If you leave it, the quantities are cleared.',
    confirmLabel: 'Leave and clear',
    cancelLabel: 'Stay on the return',
    danger: true,
  },
  SAVE_WARNING: {
    title: 'Save this sale anyway?',
    message: '',
    confirmLabel: 'Save the sale',
    cancelLabel: 'Go back',
    danger: false,
  },
};

const RETURN_BUSY_MESSAGE = 'Finish or leave the return first.';
const NO_RELOAD_ACCESS = 'You do not have access to Reload & Utility.';

@Component({
  selector: 'app-pos',
  imports: [
    AddObDialogComponent,
    AlertComponent,
    CardComponent,
    CashBookDialogComponent,
    ConfirmDialogComponent,
    CounterCloseDialogComponent,
    CounterReportReceiptComponent,
    DiscountApprovalDialogComponent,
    DrawerEndDialogComponent,
    DueAmountDialogComponent,
    DuePaymentReceiptComponent,
    HeldBillsDialogComponent,
    LastInvoiceDialogComponent,
    PosActionsComponent,
    PosBillHeaderComponent,
    PosBillLinesComponent,
    PosBottomBarComponent,
    PosHeaderComponent,
    PosItemDetailsDialogComponent,
    PosPaymentComponent,
    PosProductSearchComponent,
    PosReceiptComponent,
    PosReturnPanelComponent,
    PosReturnReceiptComponent,
    PosTotalsComponent,
    QuotationsDialogComponent,
    UpdateProductsDialogComponent,
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
  private readonly returnService = inject(PosReturnService);
  private readonly shellStateService = inject(ShellStateService);
  private readonly searchComponent = viewChild(PosProductSearchComponent);
  private readonly paymentComponent = viewChild(PosPaymentComponent);
  private leaveDecision: ((stay: boolean) => void) | null = null;
  private pendingBillType: BillType | null = null;
  private pendingPrint = false;
  private savePending = false;
  private destroyed = false;
  private detailsTrigger: HTMLElement | null = null;

  protected readonly posService = inject(PosService);
  protected readonly billTypes = BillType;
  protected readonly pendingApproval = signal<PendingApproval | null>(null);
  protected readonly heldOpen = signal(false);
  protected readonly tillDialog = signal<TillDialog | null>(null);
  protected readonly detailsProductId = signal<string | null>(null);
  protected readonly detailsProduct = computed(
    () => this.posService.products().find(item => item.id === this.detailsProductId()) ?? null
  );
  protected readonly canSeeCost = computed(() =>
    canSeeCostPrice(this.authService.currentUser()?.role)
  );
  protected readonly receiptSale = signal<Sale | null>(null);
  protected readonly receiptReturnNos = signal<readonly string[]>([]);
  protected readonly returnReceipt = signal<SaleReturn | null>(null);
  protected readonly dueReceipt = signal<DuePayment | null>(null);
  protected readonly counterSheet = signal<CounterReport | null>(null);
  protected readonly confirmKind = signal<ConfirmKind | null>(null);
  protected readonly saveWarnings = signal<readonly string[]>([]);
  protected readonly confirmCopy = computed(() => {
    const kind = this.confirmKind();
    const copy = kind === null ? CONFIRM_COPY.NEW : CONFIRM_COPY[kind];
    return kind === 'SAVE_WARNING' ? { ...copy, message: this.saveWarnings().join(' ') } : copy;
  });
  protected readonly anyDialogOpen = computed(
    () =>
      this.pendingApproval() !== null ||
      this.heldOpen() ||
      this.tillDialog() !== null ||
      this.detailsProduct() !== null ||
      this.receiptSale() !== null ||
      this.returnReceipt() !== null ||
      this.dueReceipt() !== null ||
      this.counterSheet() !== null ||
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

  protected requestBillType(type: BillType): void {
    if (type === BillType.INVOICE && this.returnService.inProgress()) {
      this.pendingBillType = type;
      this.confirmKind.set('LEAVE_RETURN');
      return;
    }
    this.applyBillType(type);
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
    if (kind === 'LEAVE_RETURN') this.applyBillType(this.pendingBillType ?? BillType.INVOICE);
    if (kind === 'SAVE_WARNING') this.saveBill(this.pendingPrint).catch(() => undefined);
    this.pendingBillType = null;
  }

  protected cancelled(): void {
    const kind = this.confirmKind();
    this.confirmKind.set(null);
    this.pendingBillType = null;
    if (kind === 'LEAVE') this.decideLeave(true);
  }

  protected save(print: boolean): void {
    this.requestSave(print).catch(() => undefined);
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

  protected saveQuotation(): void {
    this.quotationSaved().catch(() => undefined);
  }

  protected convertQuotation(quotationId: string): void {
    this.quotationConverted(quotationId).catch(() => undefined);
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

  protected onBottomBar(action: BottomBarAction): void {
    const dialogs: Partial<Record<BottomBarAction, TillDialog>> = {
      LAST_INVOICE: 'LAST_INVOICE',
      QUOTATIONS: 'QUOTATIONS',
      CASH_BOOK: 'CASH_BOOK',
      UPDATE_PRODUCTS: 'UPDATE_PRODUCTS',
      ADD_OB: 'ADD_OB',
      COUNTER_CLOSE: 'COUNTER_CLOSE',
      DRAWER: 'DRAWER',
      DUE_AMOUNT: 'DUE_AMOUNT',
    };
    const dialog = dialogs[action];
    if (dialog !== undefined) this.tillDialog.set(dialog);
    else this.billAndReload();
  }

  protected openDetails(productId: string): void {
    const active = document.activeElement;
    this.detailsTrigger = active instanceof HTMLElement ? active : null;
    this.detailsProductId.set(productId);
  }

  protected closeDetails(): void {
    this.detailsProductId.set(null);
    this.detailsTrigger?.focus();
    this.detailsTrigger = null;
  }

  protected closeTillDialog(): void {
    this.tillDialog.set(null);
    this.focusSearch();
  }

  protected onReturnCompleted(saleReturn: SaleReturn): void {
    this.returnReceipt.set(saleReturn);
  }

  protected onLastInvoicePrint(print: LastInvoicePrint): void {
    this.tillDialog.set(null);
    this.receiptReturnNos.set(print.returns.map(item => item.returnNo));
    this.receiptSale.set(print.sale);
  }

  protected onDuePrint(payment: DuePayment): void {
    this.tillDialog.set(null);
    this.dueReceipt.set(payment);
  }

  protected onCounterPrint(report: CounterReport): void {
    this.tillDialog.set(null);
    this.counterSheet.set(report);
  }

  protected onProductUpdated(): void {
    this.afterProductUpdate().catch(() => undefined);
  }

  protected closeReceipt(): void {
    this.receiptSale.set(null);
    this.receiptReturnNos.set([]);
    this.focusSearch();
  }

  protected closeReturnReceipt(): void {
    this.returnReceipt.set(null);
    this.focusSearch();
  }

  protected closeDueReceipt(): void {
    this.dueReceipt.set(null);
    this.focusSearch();
  }

  protected closeCounterSheet(): void {
    this.counterSheet.set(null);
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

  private applyBillType(type: BillType): void {
    const result = this.posService.setBillType(type);
    if (!result.ok) this.notificationService.show('warning', result.message);
  }

  private billAndReload(): void {
    if (!this.permissionService.canView(ModuleKey.RELOAD_UTILITY)) {
      this.notificationService.show('warning', NO_RELOAD_ACCESS);
      return;
    }
    const path = `/${getModuleDefinition(ModuleKey.RELOAD_UTILITY).path}`;
    this.router.navigateByUrl(path).catch(() => undefined);
  }

  private runShortcut(action: PosShortcutAction): void {
    if (this.posService.billType() === BillType.RETURN && action !== PosShortcutAction.NEW_BILL) {
      this.notificationService.show('info', RETURN_BUSY_MESSAGE);
      return;
    }
    const handlers: Record<PosShortcutAction, () => void> = {
      SAVE_AND_PRINT: () => this.save(true),
      SAVE: () => this.save(false),
      PAY_CASH: () => this.paymentComponent()?.selectMethod('cash'),
      PAY_CARD: () => this.paymentComponent()?.selectMethod('card'),
      PAY_ONLINE: () => this.paymentComponent()?.selectMethod('online'),
      HOLD: () => this.hold(),
      NEW_BILL: () => this.requestNewBill(),
      SAVE_QUOTATION: () => this.saveQuotation(),
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

  private async requestSave(print: boolean): Promise<void> {
    if (this.savePending) return;
    this.savePending = true;
    try {
      const warnings = this.posService.hasBillLines() ? await this.posService.saveWarnings() : [];
      if (warnings.length > 0) {
        this.saveWarnings.set(warnings);
        this.pendingPrint = print;
        this.confirmKind.set('SAVE_WARNING');
        return;
      }
      await this.saveBill(print);
    } finally {
      this.savePending = false;
    }
  }

  private async saveBill(print: boolean): Promise<void> {
    const result = await this.posService.saveBill();
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.notificationService.show('success', `Sale ${result.sale.invoiceNo} saved.`);
    if (print) {
      this.receiptReturnNos.set([]);
      this.receiptSale.set(result.sale);
    } else {
      this.focusSearch();
    }
  }

  private async quotationSaved(): Promise<void> {
    const result = await this.posService.saveQuotation();
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.notificationService.show('success', `Quotation ${result.quotation.quotationNo} saved.`);
    this.focusSearch();
  }

  private async quotationConverted(quotationId: string): Promise<void> {
    const result = await this.posService.convertQuotation(quotationId);
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.tillDialog.set(null);
    const parts = ['Quotation loaded as an invoice.'];
    if (result.autoHeld) {
      parts.push(`Your earlier bill was put on hold as ${result.autoHeld.holdNo}.`);
    }
    parts.push(...result.notes);
    this.notificationService.show(result.notes.length > 0 ? 'warning' : 'success', parts.join(' '));
    this.focusSearch();
  }

  private async afterProductUpdate(): Promise<void> {
    const notes = await this.posService.recheckBillAfterProductChange();
    const parts = ['Product updated.', ...notes];
    this.notificationService.show(notes.length > 0 ? 'warning' : 'success', parts.join(' '));
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
