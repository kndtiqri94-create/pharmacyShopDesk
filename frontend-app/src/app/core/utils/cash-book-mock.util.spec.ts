import { mockFiguresForDay, mockFiguresForDays } from './cash-book-mock.util';

describe('cash-book-mock.util', () => {
  it('gives the same figures for the same day', () => {
    expect(mockFiguresForDay('2026-09-21')).toEqual(mockFiguresForDay('2026-09-21'));
  });

  it('gives whole positive figures for every sample row', () => {
    for (const value of Object.values(mockFiguresForDay('2026-09-21'))) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isInteger(value)).toBeTrue();
    }
  });

  it('adds the days together and gives zero for no days', () => {
    const one = mockFiguresForDay('2026-09-20');
    const two = mockFiguresForDay('2026-09-21');
    expect(mockFiguresForDays(['2026-09-20', '2026-09-21']).incomesCents).toBe(
      one.incomesCents + two.incomesCents
    );
    expect(mockFiguresForDays([]).totalExpensesCents).toBe(0);
  });
});
