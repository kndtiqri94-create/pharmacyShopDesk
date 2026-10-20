import { Component, computed, input, output, signal } from '@angular/core';
import { ImageFileInfo } from '../../../../../core/utils/employee-image.util';
import {
  LEAVE_ATTACHMENT_ERROR,
  validateLeaveAttachment,
} from '../../../../../core/utils/leave-attachment.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { leaveFieldId } from '../leave-application.model';

@Component({
  selector: 'app-leave-attachment-field',
  imports: [ButtonComponent],
  templateUrl: './leave-attachment-field.component.html',
  styleUrl: './leave-attachment-field.component.scss',
})
export class LeaveAttachmentFieldComponent {
  readonly fileName = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly changed = output<ImageFileInfo | null>();

  protected readonly localError = signal<string | null>(null);
  protected readonly inputId = leaveFieldId('attachment');
  protected readonly shownError = computed(() => this.localError() ?? this.error());

  protected onFileChosen(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.item(0) ?? null;
    target.value = '';
    if (file === null) return;
    const info: ImageFileInfo = { name: file.name, type: file.type, size: file.size };
    if (validateLeaveAttachment(info) !== null) {
      this.localError.set(LEAVE_ATTACHMENT_ERROR);
      return;
    }
    this.localError.set(null);
    this.changed.emit(info);
  }

  protected remove(): void {
    this.localError.set(null);
    this.changed.emit(null);
  }
}
