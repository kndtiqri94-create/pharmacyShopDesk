import { Component, computed, input, output, signal } from '@angular/core';
import {
  EMPLOYEE_IMAGE_ERROR,
  readImageAsDataUrl,
  validateEmployeeImage,
} from '../../../../../core/utils/employee-image.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import { employeeFieldId } from '../employee-section.model';

@Component({
  selector: 'app-employee-photo-field',
  imports: [ButtonComponent, IconComponent],
  templateUrl: './employee-photo-field.component.html',
  styleUrl: './employee-photo-field.component.scss',
})
export class EmployeePhotoFieldComponent {
  readonly photoDataUrl = input<string | null>(null);
  readonly employeeName = input('');
  readonly readOnly = input(false);
  readonly error = input<string | null>(null);
  readonly changed = output<string | null>();

  protected readonly localError = signal<string | null>(null);
  protected readonly inputId = employeeFieldId('photo');
  protected readonly shownError = computed(() => this.localError() ?? this.error());
  protected readonly altText = computed(() => {
    const name = this.employeeName().trim();
    return name === '' ? 'Employee portrait' : `Portrait of ${name}`;
  });

  protected async onFileChosen(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.item(0) ?? null;
    target.value = '';
    if (file === null || this.readOnly()) return;
    if (validateEmployeeImage(file) !== null) {
      this.localError.set(EMPLOYEE_IMAGE_ERROR);
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      this.localError.set(null);
      this.changed.emit(dataUrl);
    } catch {
      this.localError.set(EMPLOYEE_IMAGE_ERROR);
    }
  }

  protected remove(): void {
    if (this.readOnly()) return;
    this.localError.set(null);
    this.changed.emit(null);
  }
}
