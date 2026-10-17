import { Grn } from '../models/domain/grn.model';
import { GrnStatus } from '../models/enums/grn-status.enum';
import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import {
  amountOwedToSupplier,
  grnBalanceCents,
  summarizeUnpaid,
  unpaidGrns,
} from './supplier-owed.util';

describe('supplier-owed.util', () => {
  it('works out the balance as total less paid and never below zero', () => {
    const grn = { ...GRN_SEED[2] };
    expect(grnBalanceCents(grn)).toBe(280_000);
    expect(grnBalanceCents({ ...grn, paidCents: grn.totalCents + 5 })).toBe(0);
  });

  it('counts only received GRNs with something left to pay', () => {
    expect(unpaidGrns(GRN_SEED).map(grn => grn.number)).toEqual([
      'GRN-0208',
      'GRN-0210',
      'GRN-0205',
      'GRN-0206',
    ]);
  });

  it('adds up what one supplier is owed', () => {
    expect(amountOwedToSupplier(GRN_SEED, 'sup-001')).toBe(1_160_000);
    expect(amountOwedToSupplier(GRN_SEED, 'sup-002')).toBe(0);
    expect(amountOwedToSupplier(GRN_SEED, 'sup-004')).toBe(0);
  });

  it('summarises the unpaid total, invoice count and age of the oldest', () => {
    expect(summarizeUnpaid(GRN_SEED, '2026-09-21')).toEqual({
      totalCents: 1_440_000,
      invoiceCount: 4,
      oldestDays: 18,
    });
  });

  it('ignores drafts and cancelled GRNs', () => {
    const cancelled: Grn = { ...GRN_SEED[0], status: GrnStatus.CANCELLED };
    expect(unpaidGrns([cancelled])).toEqual([]);
    expect(summarizeUnpaid([], '2026-09-21')).toEqual({
      totalCents: 0,
      invoiceCount: 0,
      oldestDays: 0,
    });
  });
});
