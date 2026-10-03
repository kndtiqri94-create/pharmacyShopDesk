import { ClockService, SAMPLE_TODAY } from './clock.service';

describe('ClockService', () => {
  it('returns the fixed sample date in a mock-data build', () => {
    expect(new ClockService().today()).toBe(SAMPLE_TODAY);
  });

  it('uses a plain ISO date', () => {
    expect(SAMPLE_TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
