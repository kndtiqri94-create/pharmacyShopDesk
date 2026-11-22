import { Component, computed, input, output } from '@angular/core';
import { EMPLOYEE_TITLES } from '../../../../../core/models/enums/employee-title.enum';
import {
  EMPLOYEE_FIELD_LIMITS,
  EmployeeFieldErrors,
  EmployeeFormInput,
} from '../../../../../core/utils/employee-validation.util';
import { CardComponent } from '../../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { EmployeeDraftPatch, employeeFieldId, eventValue } from '../employee-section.model';

@Component({
  selector: 'app-employee-basic-section',
  imports: [...FIELD_IMPORTS, CardComponent],
  templateUrl: './employee-basic-section.component.html',
  styleUrl: './employee-basic-section.component.scss',
})
export class EmployeeBasicSectionComponent {
  readonly draft = input.required<EmployeeFormInput>();
  readonly errors = input.required<EmployeeFieldErrors>();
  readonly readOnly = input(false);
  readonly locations = input.required<readonly string[]>();
  readonly today = input.required<string>();
  readonly changed = output<EmployeeDraftPatch>();

  protected readonly titles = EMPLOYEE_TITLES;
  protected readonly limits = EMPLOYEE_FIELD_LIMITS;
  protected readonly locationOptions = computed(() => {
    const current = this.draft().location;
    return current === '' || this.locations().includes(current)
      ? this.locations()
      : [...this.locations(), current];
  });
  protected readonly fieldId = employeeFieldId;
  protected readonly valueOf = eventValue;

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }
}
