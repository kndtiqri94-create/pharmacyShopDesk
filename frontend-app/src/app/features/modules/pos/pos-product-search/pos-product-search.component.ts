import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { BadgeTone } from '../../../../core/models/shared/badge-tone.model';
import { Product } from '../../../../core/models/domain/product.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { PosService } from '../../../../core/services/pos.service';
import { formatCount, formatMoneyCell } from '../../../../core/utils/money.util';
import {
  SEARCH_TEXT_MAX_LENGTH,
  findExactCodeMatch,
  searchProducts,
} from '../../../../core/utils/pos-search.util';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { FIELD_IMPORTS } from '../../../../shared/components/field/field.imports';

interface SearchRow {
  product: Product;
  priceText: string;
  badgeLabel: string;
  badgeTone: BadgeTone;
  addable: boolean;
}

@Component({
  selector: 'app-pos-product-search',
  imports: [BadgeComponent, ...FIELD_IMPORTS],
  templateUrl: './pos-product-search.component.html',
  styleUrl: './pos-product-search.component.scss',
})
export class PosProductSearchComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly posService = inject(PosService);
  protected readonly maxLength = SEARCH_TEXT_MAX_LENGTH;
  protected readonly term = signal('');
  protected readonly rows = computed<SearchRow[]>(() =>
    searchProducts(this.posService.products(), this.term()).map(product => this.toRow(product))
  );
  protected readonly resultSummary = computed(() => {
    if (this.term().trim().length === 0) return '';
    const count = this.rows().length;
    return count === 0
      ? 'No products found.'
      : `${count} ${count === 1 ? 'product' : 'products'} found.`;
  });

  focus(): void {
    this.searchInput().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value.slice(0, SEARCH_TEXT_MAX_LENGTH));
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    const text = this.term();
    if (text.trim().length === 0) return;
    const products = this.posService.products();
    const exact = findExactCodeMatch(products, text);
    const candidates = searchProducts(products, text);
    const target = exact ?? (candidates.length === 1 ? candidates[0] : null);
    if (target !== null) {
      this.add(target.id);
      return;
    }
    const message =
      candidates.length === 0
        ? `No product matches "${text.trim()}".`
        : 'Choose a product from the list.';
    this.notificationService.show('warning', message);
  }

  protected add(productId: string): void {
    const result = this.posService.addProduct(productId);
    if (!result.ok) {
      this.notificationService.show('warning', result.message);
      return;
    }
    this.term.set('');
    this.searchInput().nativeElement.value = '';
    this.focus();
  }

  private toRow(product: Product): SearchRow {
    const stock = this.posService.stockFor(product);
    const base = { product, priceText: formatMoneyCell(product.priceCents) };
    if (stock.totalQuantity <= 0) {
      return { ...base, badgeLabel: 'Out of stock', badgeTone: 'danger', addable: false };
    }
    if (stock.sellableQuantity <= 0) {
      return { ...base, badgeLabel: 'Expired', badgeTone: 'warning', addable: false };
    }
    return {
      ...base,
      badgeLabel: `${formatCount(stock.sellableQuantity)} in stock`,
      badgeTone: 'success',
      addable: true,
    };
  }
}
