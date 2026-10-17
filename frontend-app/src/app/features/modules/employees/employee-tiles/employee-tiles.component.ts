import { Component, computed, input } from '@angular/core';
import {
  EmployeeSummary,
  formatLateNote,
  formatLeaveNote,
  formatLoginNote,
} from '../../../../core/utils/employee-list-filter.util';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-employee-tiles',
  imports: [StatCardComponent],
  templateUrl: './employee-tiles.component.html',
})
export class EmployeeTilesComponent {
  readonly summary = input.required<EmployeeSummary>();

  protected readonly splitNote = computed(
    () => `${this.summary().fullTime} full-time · ${this.summary().partTime} part-time`
  );
  protected readonly lateNote = computed(() => formatLateNote(this.summary().late));
  protected readonly leaveNote = computed(() => formatLeaveNote(this.summary()));
  protected readonly loginNote = computed(() => formatLoginNote(this.summary()));
}
