import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { PayrollFilters, payrollMonthChoices } from '../../../../../core/utils/payroll-list.util';
import { SEARCH_MAX_LENGTH } from '../../../../../core/utils/product-list-filter.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { FIELD_IMPORTS } from '../../../../../shared/components/field/field.imports';

@Component({
  selector: 'app-payroll-filters',
  imports: [...FIELD_IMPORTS, ButtonComponent],
  templateUrl: './payroll-filters.component.html',
  styleUrl: './payroll-filters.component.scss',
})
export class PayrollFiltersComponent {
  readonly defaults = input.required<PayrollFilters>();
  readonly locations = input<readonly string[]>([]);
  readonly years = input<readonly number[]>([]);
  readonly applied = output<PayrollFilters>();

  protected readonly keywordMaxLength = SEARCH_MAX_LENGTH;
  protected readonly months = payrollMonthChoices();

  protected readonly keyword = linkedSignal(() => this.defaults().keyword);
  protected readonly location = linkedSignal(() => this.defaults().location);
  protected readonly year = linkedSignal(() => this.defaults().year);
  protected readonly month = linkedSignal(() => this.defaults().month);
  protected readonly yearOptions = computed(() =>
    this.years().includes(this.year()) ? this.years() : [...this.years(), this.year()].sort()
  );

  protected onKeyword(event: Event): void {
    this.keyword.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected onLocation(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.location.set(this.locations().includes(value) ? value : '');
  }

  protected onYear(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.year.set(this.years().includes(value) ? value : this.defaults().year);
  }

  protected onMonth(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.month.set(
      this.months.some(choice => choice.value === value) ? value : this.defaults().month
    );
  }

  protected apply(event: Event): void {
    event.preventDefault();
    this.applied.emit({
      keyword: this.keyword(),
      location: this.location(),
      year: this.year(),
      month: this.month(),
    });
  }

  reset(): void {
    const defaults = this.defaults();
    this.keyword.set(defaults.keyword);
    this.location.set(defaults.location);
    this.year.set(defaults.year);
    this.month.set(defaults.month);
    this.applied.emit({ ...defaults });
  }
}
