import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  TemplateRef,
  computed,
  contentChildren,
  input,
  model,
  output,
} from '@angular/core';
import { formatCount, formatMoneyCell } from '../../../core/utils/money.util';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { IconComponent } from '../icon/icon.component';
import { PaginationComponent } from '../pagination/pagination.component';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGINATION_THRESHOLD,
} from '../pagination/pagination.const';
import { DataTableCellContext, DataTableCellDirective } from './data-table-cell.directive';
import { DataTableColumn } from './data-table-column.model';
import {
  DataTableRowAction,
  DataTableRowActionEvent,
  MAX_ROW_ACTIONS,
} from './data-table-row-action.model';

const MONEY_LABEL_SUFFIX = '(Rs.)';

@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, IconComponent, PaginationComponent, EmptyStateComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly rowKey = input<(row: T) => string | number>();
  readonly actions = input<readonly DataTableRowAction[]>([]);
  readonly ariaLabel = input.required<string>();
  readonly stack = input(false);
  readonly pageSize = input(DEFAULT_PAGE_SIZE);
  readonly itemLabel = input('items');
  readonly emptyTitle = input('Nothing to show yet');
  readonly emptyMessage = input('Add the first item to see it here.');
  readonly selectable = input(false);
  readonly selectedKeys = model<readonly (string | number)[]>([]);
  readonly pageNumber = model(1);

  readonly actionTriggered = output<DataTableRowActionEvent<T>>();

  private readonly cellDirectives = contentChildren(DataTableCellDirective);

  protected readonly displayColumns = computed(() =>
    this.columns().map(column =>
      column.kind === 'money' && !column.label.includes(MONEY_LABEL_SUFFIX)
        ? { ...column, label: `${column.label} ${MONEY_LABEL_SUFFIX}` }
        : column
    )
  );
  protected readonly visibleActions = computed(() => this.actions().slice(0, MAX_ROW_ACTIONS));
  protected readonly effectivePageSize = computed(() =>
    Math.min(Math.max(1, Math.floor(this.pageSize())), MAX_PAGE_SIZE)
  );
  protected readonly showPagination = computed(() => this.rows().length > PAGINATION_THRESHOLD);
  protected readonly page = computed(() => {
    const lastPage = Math.max(1, Math.ceil(this.rows().length / this.effectivePageSize()));
    return Math.min(this.pageNumber(), lastPage);
  });
  protected readonly pageRows = computed(() => {
    if (!this.showPagination()) return this.rows();
    const size = this.effectivePageSize();
    return this.rows().slice((this.page() - 1) * size, this.page() * size);
  });
  private readonly pageRowKeys = computed(() =>
    this.pageRows().map((row, index) => this.trackRow(row, index))
  );
  protected readonly templates = computed(() => {
    const map = new Map<string, TemplateRef<DataTableCellContext<unknown>>>();
    for (const directive of this.cellDirectives()) {
      map.set(directive.columnKey(), directive.template);
    }
    return map;
  });

  protected readonly allPageRowsSelected = computed(() => {
    const keys = this.pageRowKeys();
    return keys.length > 0 && keys.every(key => this.selectedKeys().includes(key));
  });

  protected setPage(page: number): void {
    this.pageNumber.set(page);
  }

  protected isSelected(row: T, index: number): boolean {
    return this.selectedKeys().includes(this.trackRow(row, index));
  }

  protected toggleRow(row: T, index: number): void {
    const key = this.trackRow(row, index);
    const current = this.selectedKeys();
    this.selectedKeys.set(
      current.includes(key) ? current.filter(item => item !== key) : [...current, key]
    );
  }

  protected toggleAllOnPage(): void {
    const keys = this.pageRowKeys();
    const current = this.selectedKeys();
    this.selectedKeys.set(
      this.allPageRowsSelected()
        ? current.filter(item => !keys.includes(item))
        : [...current, ...keys.filter(key => !current.includes(key))]
    );
  }

  protected selectLabel(row: T): string {
    const firstColumn = this.columns()[0];
    return firstColumn ? `Select ${this.cellText(row, firstColumn)}` : 'Select row';
  }

  protected trackRow(row: T, index: number): string | number {
    return this.rowKey()?.(row) ?? index;
  }

  protected cellText(row: T, column: DataTableColumn<T>): string {
    const raw = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
    if (typeof raw === 'number' && column.kind === 'money') return formatMoneyCell(raw);
    if (typeof raw === 'number' && column.kind === 'number') return formatCount(raw);
    return raw === undefined || raw === null ? '' : String(raw);
  }

  protected isRightAligned(column: DataTableColumn<T>): boolean {
    return column.kind === 'money' || column.kind === 'number';
  }

  protected actionLabel(action: DataTableRowAction, row: T): string {
    const firstColumn = this.columns()[0];
    return firstColumn ? `${action.label} ${this.cellText(row, firstColumn)}` : action.label;
  }

  protected trigger(action: DataTableRowAction, row: T): void {
    this.actionTriggered.emit({ actionId: action.id, row });
  }
}
