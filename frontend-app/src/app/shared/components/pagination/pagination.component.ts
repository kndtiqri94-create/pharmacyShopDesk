import { Component, computed, input, model } from '@angular/core';
import { formatCount } from '../../../core/utils/money.util';
import { IconComponent } from '../icon/icon.component';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_VISIBLE_PAGE_BUTTONS,
  PAGINATION_THRESHOLD,
} from './pagination.const';

@Component({
  selector: 'app-pagination',
  imports: [IconComponent],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  readonly total = input.required<number>();
  readonly page = model(1);
  readonly pageSize = input(DEFAULT_PAGE_SIZE);
  readonly itemLabel = input('items');

  protected readonly visible = computed(() => this.total() > PAGINATION_THRESHOLD);
  protected readonly effectivePageSize = computed(() =>
    Math.min(Math.max(1, Math.floor(this.pageSize())), MAX_PAGE_SIZE)
  );
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.effectivePageSize()))
  );
  protected readonly currentPage = computed(() =>
    Math.min(Math.max(1, this.page()), this.totalPages())
  );
  protected readonly summary = computed(() => {
    const size = this.effectivePageSize();
    const first = (this.currentPage() - 1) * size + 1;
    const last = Math.min(this.currentPage() * size, this.total());
    return `Showing ${formatCount(first)}–${formatCount(last)} of ${formatCount(this.total())} ${this.itemLabel()}`;
  });
  protected readonly pageNumbers = computed(() => {
    const count = Math.min(this.totalPages(), MAX_VISIBLE_PAGE_BUTTONS);
    const start = Math.min(
      Math.max(1, this.currentPage() - Math.floor(count / 2)),
      this.totalPages() - count + 1
    );
    return Array.from({ length: count }, (_, index) => start + index);
  });

  protected goTo(target: number): void {
    this.page.set(Math.min(Math.max(1, target), this.totalPages()));
  }
}
