import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { formatDate } from '../../../../../core/utils/date.util';
import { formatLeaveDays } from '../../../../../core/utils/leave-balance.util';
import { LeaveListRow } from '../../../../../core/utils/leave-list.util';
import { LEAVE_STATUS_DISPLAY } from '../../../../../core/utils/status-display.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { syncDialogState } from '../../../../../shared/utils/dialog.util';
import { createUniqueId } from '../../../../../shared/utils/unique-id.util';

interface DetailLine {
  label: string;
  value: string;
}

const NONE = '–';

@Component({
  selector: 'app-leave-details-dialog',
  imports: [ButtonComponent],
  templateUrl: './leave-details-dialog.component.html',
  styleUrl: './leave-details-dialog.component.scss',
})
export class LeaveDetailsDialogComponent {
  readonly row = input.required<LeaveListRow>();
  readonly closed = output<void>();

  protected readonly titleId = createUniqueId('leave-details-title');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly title = computed(() => `Leave details for ${this.row().employeeName}`);
  protected readonly lines = computed<DetailLine[]>(() => {
    const { request, employeeName, employeeCode, leaveTypeName, approverName, coveringName } =
      this.row();
    return [
      { label: 'Employee', value: `${employeeName} (${employeeCode})` },
      { label: 'Leave type', value: leaveTypeName },
      { label: 'From', value: formatDate(request.fromDate) },
      { label: 'To', value: formatDate(request.toDate) },
      { label: 'Days', value: formatLeaveDays(request.days) },
      { label: 'Reason', value: request.reason },
      { label: 'Comments', value: request.comments || NONE },
      { label: 'Attachment', value: request.attachmentName ?? NONE },
      { label: 'Covering employee', value: coveringName },
      { label: 'Approver', value: approverName },
      { label: 'Status', value: LEAVE_STATUS_DISPLAY[request.status].label },
      { label: 'Decision comment', value: request.approverComment || NONE },
      {
        label: 'Decided on',
        value: request.decidedAt === null ? NONE : formatDate(request.decidedAt.slice(0, 10)),
      },
    ];
  });

  constructor() {
    effect(() => syncDialogState(this.dialog().nativeElement, true));
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }
}
