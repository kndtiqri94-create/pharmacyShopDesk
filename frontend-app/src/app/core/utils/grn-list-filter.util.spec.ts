import { GrnStatus } from '../models/enums/grn-status.enum';
import { GRN_SEED } from '../services/data/in-memory/seed/grn.seed';
import { PURCHASE_ORDER_SEED } from '../services/data/in-memory/seed/purchase-order.seed';
import { SUPPLIER_SEED } from '../services/data/in-memory/seed/supplier.seed';
import {
  countGrnByStatus,
  filterGrnItems,
  formatReference,
  isInRange,
  monthRange,
  parseGrnStatusFilter,
  summarizeGrns,
  toGrnListItems,
} from './grn-list-filter.util';

const TODAY = '2026-09-21';
const range = monthRange(TODAY);
const items = toGrnListItems(GRN_SEED, SUPPLIER_SEED);
const criteria = { search: '', status: 'all' as const, range };

describe('grn-list-filter.util', () => {
  it('uses the whole current month as the range', () => {
    expect(range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(isInRange('2026-09-30', range)).toBeTrue();
    expect(isInRange('2026-08-31', range)).toBeFalse();
  });

  it('lists the newest first with supplier names resolved', () => {
    expect(items.map(item => item.grn.number)).toEqual([
      'GRN-0211',
      'GRN-0208',
      'GRN-0210',
      'GRN-0209',
      'GRN-0206',
      'GRN-0207',
      'GRN-0205',
    ]);
    expect(items[1].supplierName).toBe('Lanka Pharma');
  });

  it('shows the invoice and PO reference or No PO', () => {
    expect(formatReference(GRN_SEED[0])).toBe('INV-88214 / No PO');
    expect(formatReference(GRN_SEED[1])).toBe('INV-5521 / PO-0145');
  });

  it('searches GRN number, invoice number and supplier ignoring case', () => {
    const numbers = (search: string) =>
      filterGrnItems(items, { ...criteria, search }).map(item => item.grn.number);
    expect(numbers('grn-0209')).toEqual(['GRN-0209']);
    expect(numbers('INV-88214')).toEqual(['GRN-0208']);
    expect(numbers('  city MED ')).toEqual(['GRN-0209']);
    expect(numbers('zzz')).toEqual([]);
  });

  it('filters by status and counts each chip for the search in use', () => {
    expect(filterGrnItems(items, { ...criteria, status: 'draft' })).toHaveSize(1);
    expect(countGrnByStatus(items, { search: '', range })).toEqual({
      all: 7,
      draft: 1,
      received: 5,
      cancelled: 1,
    });
    expect(countGrnByStatus(items, { search: 'lanka', range }).all).toBe(4);
  });

  it('keeps drafts visible and leaves out other GRNs outside the range', () => {
    const august = { from: '2026-08-01', to: '2026-08-31' };
    const result = filterGrnItems(items, { ...criteria, range: august });
    expect(result.map(item => item.grn.status)).toEqual([GrnStatus.DRAFT]);
  });

  it('falls back to All for an unknown status', () => {
    expect(parseGrnStatusFilter('received')).toBe('received');
    expect(parseGrnStatusFilter('nonsense')).toBe('all');
    expect(parseGrnStatusFilter(null)).toBe('all');
  });

  it('summarises the three tiles from the sample data', () => {
    const tiles = summarizeGrns(GRN_SEED, PURCHASE_ORDER_SEED, TODAY);
    expect(tiles.receivedValue).toBe('Rs. 20,520');
    expect(tiles.receivedNote).toBe('5 GRNs from 3 suppliers');
    expect(tiles.waitingValue).toBe('2 POs');
    expect(tiles.waitingNote).toBe('Expected within 7 days: 2');
    expect(tiles.unpaidValue).toBe('Rs. 14,400');
    expect(tiles.unpaidNote).toBe('4 invoices · oldest 18 days');
  });
});
