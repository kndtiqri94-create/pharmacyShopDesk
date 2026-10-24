import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SIGN_IN_MAX_INPUT_LENGTH } from '../../../../core/services/auth/auth.tokens';
import {
  DiscountApprovalFailure,
  DiscountChangeRequest,
  PosDiscountApprovalService,
} from '../../../../core/services/pos-discount-approval.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';
import { syncDialogState } from '../../../../shared/utils/dialog.util';
import { createUniqueId } from '../../../../shared/utils/unique-id.util';
import { DiscountDialogResult } from '../discount-dialog-result.model';

const USERNAME_ID = 'approval-username';
const PASSWORD_ID = 'approval-password';
const BACK_TO_DEFAULT = 'The discount went back to the default.';

export const NOT_APPROVED_MESSAGE = `The discount was not approved. ${BACK_TO_DEFAULT}`;

const FAILURE_MESSAGES: Record<DiscountApprovalFailure, string> = {
  'not-accepted': `The sign-in details were not accepted. ${BACK_TO_DEFAULT}`,
  'not-admin': `An active Admin account is needed to approve a discount. ${BACK_TO_DEFAULT}`,
  denied: `You do not have access to change discounts. ${BACK_TO_DEFAULT}`,
  busy: `The last approval is still being checked. ${BACK_TO_DEFAULT}`,
};

@Component({
  selector: 'app-discount-approval-dialog',
  imports: [ButtonComponent, ...FIELD_IMPORTS],
  templateUrl: './discount-approval-dialog.component.html',
  styleUrl: './discount-approval-dialog.component.scss',
})
export class DiscountApprovalDialogComponent {
  readonly open = input(false);
  readonly request = input<DiscountChangeRequest | null>(null);
  readonly finished = output<DiscountDialogResult>();

  private readonly approvalService = inject(PosDiscountApprovalService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly titleId = createUniqueId('approval-title');
  protected readonly maxLength = SIGN_IN_MAX_INPUT_LENGTH;
  protected readonly checking = signal(false);
  protected readonly description = computed(() => {
    const request = this.request();
    if (request === null) return '';
    const what = request.scope === 'LINE' ? 'an item discount' : 'a bill discount';
    return `Enter an Admin's username and password to give ${what} of ${request.percent}%.`;
  });

  constructor() {
    effect(() => {
      const open = this.open();
      syncDialogState(this.dialog().nativeElement, open);
      if (!open) this.clearFields();
    });
    inject(DestroyRef).onDestroy(() => this.clearFields());
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.check().catch(() => this.checking.set(false));
  }

  protected cancel(event?: Event): void {
    event?.preventDefault();
    if (this.checking()) return;
    this.clearFields();
    this.finished.emit({ kind: 'REJECTED', message: NOT_APPROVED_MESSAGE });
  }

  private async check(): Promise<void> {
    const request = this.request();
    if (request === null || this.checking()) return;
    const username = this.fieldValue(USERNAME_ID);
    const password = this.fieldValue(PASSWORD_ID);
    this.clearFields();
    this.checking.set(true);
    try {
      const result = await this.approvalService.approve(request, username, password);
      this.finished.emit(
        result.ok
          ? { kind: 'APPROVED', approval: result.approval }
          : { kind: 'REJECTED', message: FAILURE_MESSAGES[result.reason] }
      );
    } finally {
      this.checking.set(false);
    }
  }

  private fieldValue(id: string): string {
    return this.hostElement.nativeElement.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '';
  }

  private clearFields(): void {
    for (const id of [USERNAME_ID, PASSWORD_ID]) {
      const input = this.hostElement.nativeElement.querySelector<HTMLInputElement>(`#${id}`);
      if (input) input.value = '';
    }
  }
}
