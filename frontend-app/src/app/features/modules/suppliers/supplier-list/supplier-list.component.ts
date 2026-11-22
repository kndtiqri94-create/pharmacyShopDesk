import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { formatDate } from '../../../../core/utils/date.util';
import { getActiveDisplay } from '../../../../core/utils/status-display.util';
import {
  SEARCH_MAX_LENGTH,
  SupplierFilter,
  SupplierListItem,
  countSupplierFilters,
  filterSupplierItems,
  parseSupplierFilter,
} from '../../../../core/utils/supplier-list-filter.util';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { ChipItem } from '../../../../shared/components/chips/chip-item.model';
import { ChipsComponent } from '../../../../shared/components/chips/chips.component';
import { DataTableCellDirective } from '../../../../shared/components/data-table/data-table-cell.directive';
import { DataTableColumn } from '../../../../shared/components/data-table/data-table-column.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

const FILTER_CHIPS: readonly { id: SupplierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owing', label: 'Owing' },
  { id: 'inactive', label: 'Inactive' },
];

@Component({
  selector: 'app-supplier-list',
  imports: [
    AvatarComponent,
    BadgeComponent,
    CardComponent,
    ChipsComponent,
    DataTableCellDirective,
    DataTableComponent,
    IconComponent,
  ],
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.scss',
})
export class SupplierListComponent {
  readonly items = input.required<readonly SupplierListItem[]>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<string>();

  protected readonly searchMaxLength = SEARCH_MAX_LENGTH;
  protected readonly search = signal('');
  protected readonly filter = signal<SupplierFilter>('all');
  protected readonly page = linkedSignal({
    source: () => ({ search: this.search(), filter: this.filter() }),
    computation: () => 1,
  });
  protected readonly rows = computed(() =>
    filterSupplierItems(this.items(), { search: this.search(), filter: this.filter() })
  );
  protected readonly chipItems = computed<readonly ChipItem[]>(() => {
    const counts = countSupplierFilters(this.items(), this.search());
    return FILTER_CHIPS.map(chip => ({ ...chip, count: counts[chip.id] }));
  });

  protected readonly columns: readonly DataTableColumn<SupplierListItem>[] = [
    { key: 'supplier', label: 'Supplier', value: item => item.supplier.name },
    { key: 'owing', label: 'Owing', kind: 'money', value: item => item.owedCents },
    {
      key: 'lastOrder',
      label: 'Last order',
      value: item => (item.lastOrderDate === null ? '–' : formatDate(item.lastOrderDate)),
    },
    { key: 'status', label: 'Status' },
  ];
  protected readonly rowKey = (item: SupplierListItem): string => item.supplier.id;
  protected readonly statusOf = (item: SupplierListItem) => getActiveDisplay(item.supplier.active);

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.slice(0, SEARCH_MAX_LENGTH));
  }

  protected setFilter(value: string): void {
    this.filter.set(parseSupplierFilter(value));
  }
}
