export type DenominationKind = 'NOTE' | 'COIN';

export interface CurrencyDenomination {
  valueRupees: number;
  kind: DenominationKind;
}
