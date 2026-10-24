import { Component, computed, inject, output } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { BalanceKind } from '../../../../core/utils/pos-totals.util';
import { DISCOUNT_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-discount.util';
import { AMOUNT_TEXT_MAX_LENGTH } from '../../../../core/utils/pos-validation.util';
import {
  formatCount,
  formatRupeesExact,
  formatRupeesInput,
} from '../../../../core/utils/money.util';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { PendingApproval } from '../pending-approval.model';

const BALANCE_LABELS: Record<BalanceKind, string> = {
  CHANGE: 'Change',
  CREDIT_DUE: 'Credit due',
  DUE: 'Amount due',
  SETTLED: 'Balance',
};

@Component({
  selector: 'app-pos-totals',
  imports: [AlertComponent, ...FIELD_IMPORTS],
  templateUrl: './pos-totals.component.html',
  styleUrl: './pos-totals.component.scss',
})
export class PosTotalsComponent {
  readonly approvalRequested = output<PendingApproval>();

  private readonly notificationService = inject(NotificationService);

  protected readonly posService = inject(PosService);
  protected readonly percentMaxLength = DISCOUNT_TEXT_MAX_LENGTH;
  protected readonly amountMaxLength = AMOUNT_TEXT_MAX_LENGTH;
  protected readonly money = formatRupeesExact;
  protected readonly count = formatCount;
  protected readonly discountEditable = computed(
    () => this.posService.settings().billDiscountEnabled && this.posService.canSell()
  );
  protected readonly discountAmountText = computed(() =>
    formatRupeesInput(this.posService.totals().discountCents)
  );
  protected readonly discountPercentText = computed(() =>
    String(this.posService.totals().discountPercent)
  );
  protected readonly balanceLabel = computed(
    () => BALANCE_LABELS[this.posService.totals().balanceKind]
  );

  protected onAmountChange(event: Event): void {
    this.evaluate('AMOUNT', event.target as HTMLInputElement);
  }

  protected onPercentChange(event: Event): void {
    this.evaluate('PERCENT', event.target as HTMLInputElement);
  }

  private evaluate(mode: 'PERCENT' | 'AMOUNT', input: HTMLInputElement): void {
    const outcome = this.posService.evaluateBillDiscount(mode, input.value);
    if (outcome.kind === 'REFUSED') this.notificationService.show('warning', outcome.message);
    if (outcome.kind === 'NEEDS_APPROVAL') {
      this.approvalRequested.emit({ request: outcome.request, billInput: outcome.billInput });
    }
    input.value = mode === 'AMOUNT' ? this.discountAmountText() : this.discountPercentText();
  }
}
