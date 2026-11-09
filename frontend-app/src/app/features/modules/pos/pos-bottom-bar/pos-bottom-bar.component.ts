import { Component, computed, inject, output } from '@angular/core';
import { ModuleKey } from '../../../../core/models/enums/module-key.enum';
import { PermissionService } from '../../../../core/services/permission.service';
import { IconName } from '../../../../core/models/shared/icon-name.model';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

export const BottomBarAction = {
  LAST_INVOICE: 'LAST_INVOICE',
  QUOTATIONS: 'QUOTATIONS',
  CASH_BOOK: 'CASH_BOOK',
  UPDATE_PRODUCTS: 'UPDATE_PRODUCTS',
  ADD_OB: 'ADD_OB',
  COUNTER_CLOSE: 'COUNTER_CLOSE',
  BILL_RELOAD: 'BILL_RELOAD',
  DRAWER: 'DRAWER',
  DUE_AMOUNT: 'DUE_AMOUNT',
} as const;

export type BottomBarAction = (typeof BottomBarAction)[keyof typeof BottomBarAction];

interface BottomBarItem {
  action: BottomBarAction;
  label: string;
  icon: IconName;
}

export const BOTTOM_BAR_ITEMS: readonly BottomBarItem[] = [
  { action: BottomBarAction.LAST_INVOICE, label: 'Last Invoice', icon: 'receipt' },
  { action: BottomBarAction.QUOTATIONS, label: 'Quotations', icon: 'clipboard' },
  { action: BottomBarAction.CASH_BOOK, label: 'Cash Book', icon: 'wallet' },
  { action: BottomBarAction.UPDATE_PRODUCTS, label: 'Update Products', icon: 'edit' },
  { action: BottomBarAction.ADD_OB, label: 'Add OB', icon: 'plus' },
  { action: BottomBarAction.COUNTER_CLOSE, label: 'Counter Close', icon: 'lock' },
  { action: BottomBarAction.BILL_RELOAD, label: 'Bill & Reload', icon: 'phone' },
  { action: BottomBarAction.DRAWER, label: 'Drawer (End)', icon: 'inbox' },
  { action: BottomBarAction.DUE_AMOUNT, label: 'Due Amount', icon: 'trend' },
];

@Component({
  selector: 'app-pos-bottom-bar',
  imports: [ButtonComponent],
  templateUrl: './pos-bottom-bar.component.html',
  styleUrl: './pos-bottom-bar.component.scss',
})
export class PosBottomBarComponent {
  readonly actionRequested = output<BottomBarAction>();

  private readonly permissionService = inject(PermissionService);

  protected readonly items = BOTTOM_BAR_ITEMS;
  protected readonly visible = computed(() => this.permissionService.canView(ModuleKey.POS));
}
