import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideDataServices } from '../data-providers';
import { ReloadDataService } from '../reload-data.service';

describe('InMemoryReloadDataService float', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  const service = () => TestBed.inject(ReloadDataService);
  const history = () => firstValueFrom(service().getFloatHistory());

  it('replaces the entry for the same date and keeps the others', async () => {
    const before = await history();
    const latest = before.at(-1)!;
    await firstValueFrom(service().saveFloat({ ...latest, availableCents: 123_400 }));
    const after = await history();
    expect(after).toHaveSize(before.length);
    expect(after.at(-1)?.availableCents).toBe(123_400);
    expect(after.slice(0, -1)).toEqual(before.slice(0, -1));
  });

  it('adds an entry for a new date', async () => {
    const before = await history();
    await firstValueFrom(
      service().saveFloat({
        date: '2026-09-22',
        availableCents: 1,
        reloadsCount: 0,
        billsCount: 0,
        commissionCents: 0,
      })
    );
    expect(await history()).toHaveSize(before.length + 1);
  });

  it('stores and returns copies so callers cannot change what is saved', async () => {
    const entry = { ...(await history()).at(-1)!, availableCents: 5_000 };
    const saved = await firstValueFrom(service().saveFloat(entry));
    entry.availableCents = 1;
    saved.availableCents = 2;
    expect((await history()).at(-1)?.availableCents).toBe(5_000);
  });
});
