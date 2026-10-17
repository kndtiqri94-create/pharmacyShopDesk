import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { ReloadService } from '../../../../core/services/reload.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { formatRupees, formatRupeesExact, rupeesToCents } from '../../../../core/utils/money.util';
import { parseNonNegativeNumber } from '../../../../core/utils/product-validation.util';
import {
  RELOAD_COMMISSION_RATE,
  commissionCents,
  customerPaysCents,
} from '../../../../core/utils/reload-commission.util';
import {
  AMOUNT_CHIP_RUPEES,
  AMOUNT_INPUT_MAX_LENGTH,
  CUSTOMER_NAME_MAX_LENGTH,
  MOBILE_INPUT_MAX_LENGTH,
  RELOAD_OPERATORS,
  ReloadFieldErrors,
  ReloadFieldKey,
} from '../../../../core/utils/reload-validation.util';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { OperatorTilesComponent } from '../operator-tiles/operator-tiles.component';

const OTHER_AMOUNT = 'other';
const FIELD_ID_PREFIX = 'reload-';

const AMOUNT_CHIPS: readonly ChipItem[] = [
  ...AMOUNT_CHIP_RUPEES.map(rupees => ({
    id: String(rupees),
    label: formatRupees(rupeesToCents(rupees)),
  })),
  { id: OTHER_AMOUNT, label: 'Other' },
];

@Component({
  selector: 'app-mobile-reload-card',
  imports: [
    ...FIELD_IMPORTS,
    ButtonComponent,
    CardComponent,
    ChipsComponent,
    OperatorTilesComponent,
  ],
  templateUrl: './mobile-reload-card.component.html',
  styleUrl: './mobile-reload-card.component.scss',
})
export class MobileReloadCardComponent {
  readonly canWrite = input(false);
  readonly sent = output<void>();

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly notificationService = inject(NotificationService);
  private readonly reloadService = inject(ReloadService);

  protected readonly operators = RELOAD_OPERATORS;
  protected readonly amountChips = AMOUNT_CHIPS;
  protected readonly mobileMaxLength = MOBILE_INPUT_MAX_LENGTH;
  protected readonly nameMaxLength = CUSTOMER_NAME_MAX_LENGTH;
  protected readonly amountMaxLength = AMOUNT_INPUT_MAX_LENGTH;
  protected readonly ratePercent = `${RELOAD_COMMISSION_RATE * 100}%`;

  protected readonly operator = signal('');
  protected readonly mobile = signal('');
  protected readonly customerName = signal('');
  protected readonly amountChoice = signal('');
  protected readonly otherAmount = signal('');
  protected readonly errors = signal<ReloadFieldErrors>({});
  protected readonly busy = signal(false);

  protected readonly amountText = computed(() =>
    this.amountChoice() === OTHER_AMOUNT ? this.otherAmount() : this.amountChoice()
  );
  protected readonly amountEditable = computed(
    () => this.canWrite() && this.amountChoice() === OTHER_AMOUNT
  );
  private readonly previewCents = computed(() => {
    const rupees = parseNonNegativeNumber(this.amountText(), 2);
    return rupees === null ? 0 : rupeesToCents(rupees);
  });
  protected readonly commissionText = computed(() =>
    formatRupeesExact(commissionCents(this.previewCents()))
  );
  protected readonly customerPaysText = computed(() =>
    formatRupeesExact(customerPaysCents(this.previewCents()))
  );

  protected fieldId(key: ReloadFieldKey): string {
    return `${FIELD_ID_PREFIX}${key === 'customerName' ? 'customer-name' : key}`;
  }

  protected error(key: ReloadFieldKey): string | null {
    return this.errors()[key] ?? null;
  }

  protected setOperator(operator: string): void {
    this.operator.set(operator);
    this.clearError('operator');
  }

  protected onMobileInput(event: Event): void {
    this.mobile.set((event.target as HTMLInputElement).value);
    this.clearError('mobile');
  }

  protected onNameInput(event: Event): void {
    this.customerName.set((event.target as HTMLInputElement).value);
    this.clearError('customerName');
  }

  protected chooseAmount(choice: string): void {
    this.amountChoice.set(choice);
    this.clearError('amount');
    if (choice === OTHER_AMOUNT) this.focusField('amount');
  }

  protected onAmountInput(event: Event): void {
    this.otherAmount.set((event.target as HTMLInputElement).value);
    this.clearError('amount');
  }

  protected clear(): void {
    this.operator.set('');
    this.mobile.set('');
    this.customerName.set('');
    this.amountChoice.set('');
    this.otherAmount.set('');
    this.errors.set({});
  }

  protected send(event: Event): void {
    event.preventDefault();
    this.submit().catch(() => undefined);
  }

  private async submit(): Promise<void> {
    if (this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    try {
      const result = await this.reloadService.sendReload({
        operator: this.operator(),
        mobile: this.mobile(),
        customerName: this.customerName(),
        amount: this.amountText(),
      });
      if (result.ok) {
        this.onSent(result.transaction.provider, result.transaction.amountCents);
        return;
      }
      this.errors.set(result.errors);
      if (result.reason === 'invalid') this.focusField(result.firstErrorField);
      else this.warn(result.reason);
    } finally {
      this.busy.set(false);
    }
  }

  private onSent(provider: string, amountCents: number): void {
    const commission = formatRupeesExact(commissionCents(amountCents));
    this.notificationService.show(
      'success',
      `Reload of ${formatRupeesExact(amountCents)} sent on ${provider}. You earned ${commission}.`
    );
    this.clear();
    this.sent.emit();
  }

  private warn(reason: string): void {
    if (reason === 'busy') return;
    this.notificationService.show(
      'warning',
      reason === 'denied'
        ? 'That reload was not sent. You may not have access to send reloads.'
        : 'That reload was not sent. There is no float on record.'
    );
  }

  private clearError(key: ReloadFieldKey): void {
    if (this.errors()[key] === undefined) return;
    this.errors.update(current => ({ ...current, [key]: undefined }));
  }

  private focusField(key: ReloadFieldKey | null): void {
    if (key === null) return;
    const id = key === 'operator' ? 'reload-operator' : this.fieldId(key);
    this.hostElement.nativeElement.querySelector<HTMLElement>(`#${id}`)?.focus();
  }
}
