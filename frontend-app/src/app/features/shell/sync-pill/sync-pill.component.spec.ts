import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyncState } from '../../../core/models/enums/sync-state.enum';
import { provideDataServices } from '../../../core/services/data/data-providers';
import { SyncDataService } from '../../../core/services/data/sync-data.service';
import { SyncPillComponent, describeSyncStatus } from './sync-pill.component';

describe('SyncPillComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  async function renderWith(state: SyncState, pendingChanges = 0) {
    const fixture = TestBed.createComponent(SyncPillComponent);
    await firstValueFrom(
      TestBed.inject(SyncDataService).setStatus({ state, pendingChanges, minutesSinceSync: 2 })
    );
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows online by default with the last sync time', () => {
    const fixture = TestBed.createComponent(SyncPillComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('output')?.textContent).toContain('Synced · 2 min ago');
    expect(element.querySelector('output')?.getAttribute('data-state')).toBe('ONLINE');
  });

  it('shows syncing', async () => {
    const element = await renderWith(SyncState.SYNCING);
    expect(element.querySelector('output')?.textContent).toContain('Syncing');
    expect(element.querySelector('output')?.getAttribute('data-state')).toBe('SYNCING');
  });

  it('shows offline with the number of changes waiting', async () => {
    const element = await renderWith(SyncState.OFFLINE, 3);
    expect(element.querySelector('output')?.textContent).toContain('Offline · 3 changes waiting');
  });

  it('uses the singular for one waiting change', () => {
    expect(
      describeSyncStatus({ state: SyncState.OFFLINE, pendingChanges: 1, minutesSinceSync: 0 })
    ).toBe('Offline · 1 change waiting');
  });

  it('shows exactly one state at a time and never blocks the screen', async () => {
    const element = await renderWith(SyncState.OFFLINE, 2);
    expect(element.querySelectorAll('output')).toHaveSize(1);
    expect(element.querySelector('button')).toBeNull();
  });
});
