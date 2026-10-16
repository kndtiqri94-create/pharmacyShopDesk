import { rupeesToCents } from './money.util';
import { MAX_PRICE_RUPEES, MAX_QUANTITY, parseNonNegativeNumber } from './product-validation.util';

const MONEY_DECIMALS = 2;

export function parseCents(text: string, maxRupees = MAX_PRICE_RUPEES): number | null {
  const rupees = parseNonNegativeNumber(text, MONEY_DECIMALS);
  return rupees === null || rupees > maxRupees ? null : rupeesToCents(rupees);
}

export function parseQuantity(text: string, max = MAX_QUANTITY): number | null {
  const quantity = parseNonNegativeNumber(text, 0);
  return quantity === null || quantity > max ? null : quantity;
}
