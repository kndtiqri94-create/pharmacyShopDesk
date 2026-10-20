import { Component, computed, input, output, signal } from '@angular/core';
import { LeaveDecision } from '../../../../../core/services/leave-admin.service';
import { formatDate } from '../../../../../core/utils/date.util';
import { formatLeaveDays } from '../../../../../core/utils/leave-balance.util';
import { LeaveListRow } from '../../../../../core/utils/leave-list.util';
import { LEAVE_COMMENTS_MAX } from '../../../../../core/utils/leave-validation.util';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';

@Component({
  selector: 'app-leave-decision-dialog',
  imports: [...FIELD_IMPORTS, ConfirmDialogComponent],
  templateUrl: './leave-decision-dialog.component.html',
})
export class LeaveDecisionDialogComponent {
  readonly row = input.required<LeaveListRow>();
  readonly decision = input.required<LeaveDecision>();
  readonly busy = input(false);
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  protected readonly commentId = createUniqueId('leave-decision-comment');
  protected readonly commentMax = LEAVE_COMMENTS_MAX;
  protected readonly comment = signal('');

  protected readonly approving = computed(() => this.decision() === 'APPROVE');
  protected readonly verb = computed(() => (this.approving() ? 'Approve' : 'Reject'));
  protected readonly title = computed(() => `${this.verb()} leave for ${this.row().employeeName}?`);
  protected readonly summary = computed(() => {
    const { request, employeeName, leaveTypeName } = this.row();
    return (
      `You are about to ${this.verb().toLowerCase()} ${employeeName}'s ${leaveTypeName} ` +
      `from ${formatDate(request.fromDate)} to ${formatDate(request.toDate)} ` +
      `(${formatLeaveDays(request.days)} days).`
    );
  });

  protected onComment(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value.slice(0, LEAVE_COMMENTS_MAX));
  }
}
