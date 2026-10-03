import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SAMPLE_TODAY } from '../../clock.service';
import { provideDataServices } from '../data-providers';
import { SalesDataService } from '../sales-data.service';

describe('InMemorySalesDataService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(SalesDataService);

  it('gives the last 7 and 30 days ending today, oldest first', async () => {
    const week = await firstValueFrom(service().getDailySales(7));
    const month = await firstValueFrom(service().getDailySales(30));
    expect(week).toHaveSize(7);
    expect(month).toHaveSize(30);
    expect(week.at(-1)?.date).toBe(SAMPLE_TODAY);
    expect(month[0].date < month[1].date).toBeTrue();
  });

  it('never gives more than 30 days or fewer than one', async () => {
    expect(await firstValueFrom(service().getDailySales(500))).toHaveSize(30);
    expect(await firstValueFrom(service().getDailySales(0))).toHaveSize(1);
    expect(await firstValueFrom(service().getDailySales(Number.NaN))).toHaveSize(1);
  });

  it('summarizes today against the same day last week', async () => {
    const summary = await firstValueFrom(service().getTodaySummary());
    expect(summary.salesCents).toBe(8_425_000);
    expect(summary.profitCents).toBe(1_984_000);
    expect(summary.bills).toBe(63);
    expect(summary.comparedSalesCents).toBe(7_495_000);
  });

  it('lists best sellers with the best first', async () => {
    const sellers = await firstValueFrom(service().getBestSellers());
    expect(sellers[0].productName).toBe('Paracetamol 500mg');
    const units = sellers.map(seller => seller.unitsSold);
    expect(units).toEqual([...units].sort((first, second) => second - first));
  });

  it('returns copies that cannot change the sample data', async () => {
    const points = await firstValueFrom(service().getDailySales(7));
    points[0].salesCents = 0;
    expect((await firstValueFrom(service().getDailySales(7)))[0].salesCents).not.toBe(0);
  });
});
