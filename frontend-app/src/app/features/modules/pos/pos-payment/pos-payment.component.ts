import { Component, ElementRef, computed, inject } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { formatRupeesExact } from '../../../../core/utils/money.util';
import { POS_SHORTCUT_KEYS } from '../../../../core/utils/pos-shortcut.util';
import {
  AMOUNT_TEXT_MAX_LENGTH,
  PaymentFieldKey,
  REFERENCE_MAX_LENGTH,
} from '../../../../core/utils/pos-validation.util';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PosKeypadComponent } from '../pos-keypad/pos-keypad.component';

const FIELD_LABELS: Record<PaymentFieldKey, string> = {
  cash: 'Cash received',
  card: 'Card amount',
  online: 'Online amount',
};

interface MethodTile {
  id: PaymentFieldKey | 'credit';
  label: string;
  shortcut: string | null;
}

@Component({
  selector: 'app-pos-payment',
  imports: [PosKeypadComponent, ...FIELD_IMPORTS],
  templateUrl: './pos-payment.component.html',
  styleUrl: './pos-payment.component.scss',
})
export class PosPaymentComponent {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notificationService = inject(NotificationService);

  protected readonly posService = inject(PosService);
  protected readonly amountMaxLength = AMOUNT_TEXT_MAX_LENGTH;
  protected readonly referenceMaxLength = REFERENCE_MAX_LENGTH;
  protected readonly money = formatRupeesExact;
  protected readonly tiles: readonly MethodTile[] = [
    { id: 'cash', label: 'Cash', shortcut: POS_SHORTCUT_KEYS.PAY_CASH },
    { id: 'card', label: 'Card', shortcut: POS_SHORTCUT_KEYS.PAY_CARD },
    { id: 'online', label: 'Online', shortcut: POS_SHORTCUT_KEYS.PAY_ONLINE },
    { id: 'credit', label: 'Credit', shortcut: null },
  ];
  protected readonly keypadTarget = computed(
    () => FIELD_LABELS[this.posService.activePaymentField()]
  );
  protected readonly customerName = computed(() => {
    const customerId = this.posService.bill().customerId;
    return this.posService.customers().find(customer => customer.id === customerId)?.name ?? '';
  });

  selectMethod(field: PaymentFieldKey): void {
    this.posService.selectPaymentField(field);
    this.hostElement.nativeElement.querySelector<HTMLInputElement>(`#pos-pay-${field}`)?.focus();
  }

  protected tileName(tile: MethodTile): string {
    return tile.shortcut ? `${tile.label} ${tile.shortcut}` : tile.label;
  }

  protected isPressed(tile: MethodTile): boolean {
    if (tile.id === 'credit') return this.posService.bill().payments.creditSelected;
    return this.posService.activePaymentField() === tile.id;
  }

  protected onTile(tile: MethodTile): void {
    if (tile.id === 'credit') {
      this.toggleCredit();
      return;
    }
    this.selectMethod(tile.id);
  }

  protected onAmountInput(field: PaymentFieldKey, event: Event): void {
    this.posService.setPaymentText(field, (event.target as HTMLInputElement).value);
  }

  protected onReferenceInput(field: 'card' | 'online', event: Event): void {
    this.posService.setReference(field, (event.target as HTMLInputElement).value);
  }

  protected error(field: PaymentFieldKey): string | null {
    return this.posService.parsedPayments().errors[field] ?? null;
  }

  protected onKey(key: string): void {
    this.posService.pressKey(key);
  }

  private toggleCredit(): void {
    const next = !this.posService.bill().payments.creditSelected;
    const result = this.posService.setCredit(next);
    if (!result.ok) this.notificationService.show('warning', result.message);
  }
}
