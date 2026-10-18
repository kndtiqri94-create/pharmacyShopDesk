import { Component, input, output } from '@angular/core';
import {
  EMPLOYEE_FIELD_LIMITS,
  EmployeeFieldErrors,
  EmployeeFormInput,
} from '../../../../../core/utils/employee-validation.util';
import { CardComponent } from '../../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { EmployeeDraftPatch, employeeFieldId, eventValue } from '../employee-section.model';

type AddressKey = 'addressLine1' | 'addressLine2' | 'city' | 'suburb' | 'state' | 'country' | 'zip';

interface AddressField {
  key: AddressKey;
  label: string;
  span: number;
  max: number;
}

const { addressLine, addressPart, zip } = EMPLOYEE_FIELD_LIMITS;

const ADDRESS_FIELDS: readonly AddressField[] = [
  { key: 'addressLine1', label: 'Address line 1', span: 6, max: addressLine },
  { key: 'addressLine2', label: 'Address line 2', span: 6, max: addressLine },
  { key: 'city', label: 'City', span: 4, max: addressPart },
  { key: 'suburb', label: 'Suburb', span: 4, max: addressPart },
  { key: 'state', label: 'State', span: 4, max: addressPart },
  { key: 'country', label: 'Country', span: 6, max: addressPart },
  { key: 'zip', label: 'Zip code', span: 6, max: zip },
];

@Component({
  selector: 'app-employee-address-section',
  imports: [...FIELD_IMPORTS, CardComponent],
  templateUrl: './employee-address-section.component.html',
  styleUrl: './employee-address-section.component.scss',
})
export class EmployeeAddressSectionComponent {
  readonly draft = input.required<EmployeeFormInput>();
  readonly errors = input.required<EmployeeFieldErrors>();
  readonly readOnly = input(false);
  readonly changed = output<EmployeeDraftPatch>();

  protected readonly fields = ADDRESS_FIELDS;
  protected readonly fieldId = employeeFieldId;

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected set(key: AddressKey, event: Event): void {
    this.changed.emit({ [key]: eventValue(event) });
  }
}
