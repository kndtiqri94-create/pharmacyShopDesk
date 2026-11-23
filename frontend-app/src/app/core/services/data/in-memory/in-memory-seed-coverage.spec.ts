import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describeSeedCoverageContract } from '../contract/seed-coverage.contract';
import { provideDataServices } from '../data-providers';
import { SettingsDataService } from '../settings-data.service';

describeSeedCoverageContract('in-memory seed coverage', () => [provideDataServices(true)]);

describe('in-memory settings', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  it('keeps a saved settings change for the session only', async () => {
    const settingsService = TestBed.inject(SettingsDataService);
    const settings = await firstValueFrom(settingsService.get());
    await firstValueFrom(settingsService.save({ ...settings, expiryAlertDays: 30 }));
    expect((await firstValueFrom(settingsService.get())).expiryAlertDays).toBe(30);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideDataServices(true)] });
    expect((await firstValueFrom(TestBed.inject(SettingsDataService).get())).expiryAlertDays).toBe(
      60
    );
  });
});
