import { Component, computed, input, output } from '@angular/core';
import { formatRupeesExact } from '../../../../../core/utils/money.util';
import { parseCents } from '../../../../../core/utils/number-input.util';
import {
  AllowanceInput,
  EMPLOYEE_FIELD_LIMITS,
  EmployeeFieldErrors,
  EmployeeFormInput,
  allowanceFieldKey,
} from '../../../../../core/utils/employee-validation.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../../shared/components/card/card.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { EmployeeDraftPatch, employeeFieldId, eventValue } from '../employee-section.model';

type PayKey =
  | 'basicSalary'
  | 'overTimeRate'
  | 'commissionRate'
  | 'productDiscountRate'
  | 'invoiceDiscountRate'
  | 'monthlyTarget';

interface PayField {
  key: PayKey;
  label: string;
  kind: 'money' | 'percent';
}

const PAY_FIELDS: readonly PayField[] = [
  { key: 'basicSalary', label: 'Basic salary', kind: 'money' },
  { key: 'overTimeRate', label: 'Over time rate', kind: 'money' },
  { key: 'commissionRate', label: 'Commission rate', kind: 'percent' },
  { key: 'productDiscountRate', label: 'Product discount', kind: 'percent' },
  { key: 'invoiceDiscountRate', label: 'Invoice discount', kind: 'percent' },
  { key: 'monthlyTarget', label: 'Monthly target', kind: 'money' },
];

let allowanceSequence = 0;

@Component({
  selector: 'app-employee-salary-section',
  imports: [...FIELD_IMPORTS, ButtonComponent, CardComponent],
  templateUrl: './employee-salary-section.component.html',
  styleUrl: './employee-salary-section.component.scss',
})
export class EmployeeSalarySectionComponent {
  readonly draft = input.required<EmployeeFormInput>();
  readonly errors = input.required<EmployeeFieldErrors>();
  readonly readOnly = input(false);
  readonly changed = output<EmployeeDraftPatch>();

  protected readonly payFields = PAY_FIELDS;
  protected readonly limits = EMPLOYEE_FIELD_LIMITS;
  protected readonly fieldId = employeeFieldId;
  protected readonly nameKey = (index: number): string => allowanceFieldKey(index, 'name');
  protected readonly amountKey = (index: number): string => allowanceFieldKey(index, 'amount');
  protected readonly atCap = computed(
    () => this.draft().allowances.length >= EMPLOYEE_FIELD_LIMITS.maxAllowances
  );
  protected readonly total = computed(() =>
    formatRupeesExact(
      this.draft().allowances.reduce((sum, line) => sum + (parseCents(line.amount) ?? 0), 0)
    )
  );

  protected error(key: string): string | null {
    return this.errors()[key] ?? null;
  }

  protected setPay(key: PayKey, event: Event): void {
    if (this.readOnly()) return;
    this.changed.emit({ [key]: eventValue(event) });
  }

  protected addLine(): void {
    if (this.readOnly() || this.atCap()) return;
    allowanceSequence += 1;
    const line: AllowanceInput = { id: `new-allowance-${allowanceSequence}`, name: '', amount: '' };
    this.changed.emit({ allowances: [...this.draft().allowances, line] });
  }

  protected editLine(index: number, part: 'name' | 'amount', event: Event): void {
    if (this.readOnly()) return;
    const lines = this.draft().allowances.map((line, position) =>
      position === index ? { ...line, [part]: eventValue(event) } : line
    );
    this.changed.emit({ allowances: lines });
  }

  protected removeLine(index: number): void {
    if (this.readOnly()) return;
    this.changed.emit({
      allowances: this.draft().allowances.filter((_, position) => position !== index),
    });
  }
}
