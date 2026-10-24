import { Product } from '../models/domain/product.model';

export const SEARCH_TEXT_MAX_LENGTH = 60;
export const SEARCH_RESULT_LIMIT = 20;

export function normaliseSearchTerm(text: string): string {
  return text.trim().slice(0, SEARCH_TEXT_MAX_LENGTH).toLowerCase();
}

function matchRank(product: Product, term: string): number {
  const sku = product.sku.toLowerCase();
  const barcode = product.barcode.toLowerCase();
  if (sku === term || barcode === term) return 0;
  if (product.name.toLowerCase().startsWith(term)) return 1;
  const fields = [product.name, product.genericName, product.sku, product.barcode];
  return fields.some(field => field.toLowerCase().includes(term)) ? 2 : -1;
}

export function searchProducts(products: readonly Product[], text: string): Product[] {
  const term = normaliseSearchTerm(text);
  if (term.length === 0) return [];
  const ranked = products
    .filter(product => product.active)
    .map(product => ({ product, rank: matchRank(product, term) }))
    .filter(entry => entry.rank >= 0);
  ranked.sort(
    (first, second) =>
      first.rank - second.rank || first.product.name.localeCompare(second.product.name)
  );
  return ranked.slice(0, SEARCH_RESULT_LIMIT).map(entry => entry.product);
}

export function findExactCodeMatch(products: readonly Product[], text: string): Product | null {
  const term = normaliseSearchTerm(text);
  if (term.length === 0) return null;
  const matches = products.filter(
    product =>
      product.active &&
      (product.sku.toLowerCase() === term || product.barcode.toLowerCase() === term)
  );
  return matches.length === 1 ? matches[0] : null;
}
