import { ClockService, SAMPLE_TODAY } from './clock.service';

describe('ClockService', () => {
  it('returns the fixed sample date in a mock-data build', () => {
    expect(new ClockService().today()).toBe(SAMPLE_TODAY);
  });

  it('uses a plain ISO date', () => {
    expect(SAMPLE_TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('gives the date and time of day as a plain ISO date and time on the sample date', () => {
    const now = new ClockService().now();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(now.startsWith(SAMPLE_TODAY)).toBeTrue();
  });
});
