import { Component, computed, input, output, signal } from '@angular/core';
import { Employee } from '../../../../../core/models/domain/employee.model';
import {
  employeeOptionLabel,
  filterCoveringCandidates,
} from '../../../../../core/utils/leave-covering.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';
import { eventValue, leaveFieldId } from '../leave-application.model';

@Component({
  selector: 'app-covering-employee-picker',
  imports: [...FIELD_IMPORTS, ButtonComponent],
  templateUrl: './covering-employee-picker.component.html',
  styleUrl: './covering-employee-picker.component.scss',
})
export class CoveringEmployeePickerComponent {
  readonly employees = input.required<readonly Employee[]>();
  readonly applicantId = input('');
  readonly value = input('');
  readonly error = input<string | null>(null);
  readonly changed = output<string>();

  protected readonly searchOpen = signal(false);
  protected readonly term = signal('');
  protected readonly fieldId = leaveFieldId('coveringEmployeeId');
  protected readonly searchId = leaveFieldId('coveringSearch');
  protected readonly valueOf = eventValue;
  protected readonly label = employeeOptionLabel;
  protected readonly matches = computed(() =>
    filterCoveringCandidates(this.employees(), this.applicantId(), this.term())
  );
  protected readonly options = computed(() => {
    const matches = this.matches();
    const chosen = matches.find(employee => employee.id === this.value());
    if (chosen !== undefined || this.value() === '') return matches;
    const kept = filterCoveringCandidates(this.employees(), this.applicantId(), '').find(
      employee => employee.id === this.value()
    );
    return kept === undefined ? matches : [kept, ...matches];
  });

  protected toggleSearch(): void {
    this.searchOpen.update(open => !open);
    if (!this.searchOpen()) this.term.set('');
  }

  protected setTerm(text: string): void {
    this.term.set(text);
  }
}
