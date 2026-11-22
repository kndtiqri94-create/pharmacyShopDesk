import { Component, computed, input, output } from '@angular/core';
import { EmployeeStatus } from '../../../../../core/models/enums/employee-status.enum';
import { SalaryType } from '../../../../../core/models/enums/salary-type.enum';
import {
  EMPLOYEE_FIELD_LIMITS,
  EmployeeFieldErrors,
  EmployeeFormInput,
} from '../../../../../core/utils/employee-validation.util';
import { EMPLOYEE_STATUS_DISPLAY } from '../../../../../core/utils/status-display.util';
import { CardComponent } from '../../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { EmployeePhotoFieldComponent } from '../employee-photo-field/employee-photo-field.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { EmployeeDraftPatch, employeeFieldId, eventValue } from '../employee-section.model';

type CustomFieldKey = 'customField1' | 'customField2' | 'customField3' | 'customField4';
type ToggleKey = 'calculateEpf' | 'calculateEtf' | 'considerAsCustomer' | 'createUserAccount';

interface CustomFieldConfig {
  key: CustomFieldKey;
  label: string;
  hint: string;
}

const CUSTOM_HINT =
  'Optional. Up to 100 characters of anything you want to keep with this employee.';

const CUSTOM_FIELDS: readonly CustomFieldConfig[] = [
  { key: 'customField1', label: 'Custom field 1', hint: CUSTOM_HINT },
  { key: 'customField2', label: 'Custom field 2', hint: CUSTOM_HINT },
  { key: 'customField3', label: 'Custom field 3', hint: CUSTOM_HINT },
  { key: 'customField4', label: 'Custom field 4', hint: CUSTOM_HINT },
];

@Component({
  selector: 'app-employee-more-section',
  imports: [...FIELD_IMPORTS, CardComponent, EmployeePhotoFieldComponent, ToggleComponent],
  templateUrl: './employee-more-section.component.html',
  styleUrl: './employee-more-section.component.scss',
})
export class EmployeeMoreSectionComponent {
  readonly draft = input.required<EmployeeFormInput>();
  readonly errors = input.required<EmployeeFieldErrors>();
  readonly readOnly = input(false);
  readonly linkedUser = input(false);
  readonly changed = output<EmployeeDraftPatch>();

  protected readonly customFields = CUSTOM_FIELDS;
  protected readonly limits = EMPLOYEE_FIELD_LIMITS;
  protected readonly statusLabel = (status: EmployeeStatus): string =>
    EMPLOYEE_STATUS_DISPLAY[status].label;
  protected readonly statuses = computed(() => {
    const options: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.INACTIVE];
    const current = this.draft().status as EmployeeStatus;
    return options.includes(current) ? options : [...options, current];
  });
  protected readonly salaryTypes = [
    { value: SalaryType.MONTHLY, label: 'Monthly' },
    { value: SalaryType.DAILY, label: 'Daily' },
  ];
  protected readonly personName = computed(() =>
    [this.draft().firstName, this.draft().lastName].join(' ').trim()
  );
  protected readonly fieldId = employeeFieldId;
  protected readonly valueOf = eventValue;

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected setText(key: CustomFieldKey, event: Event): void {
    this.changed.emit({ [key]: eventValue(event) });
  }

  protected setToggle(key: ToggleKey, value: boolean): void {
    this.changed.emit({ [key]: value });
  }
}
