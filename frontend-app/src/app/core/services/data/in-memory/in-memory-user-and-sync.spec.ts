import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyncState } from '../../../models/enums/sync-state.enum';
import { provideDataServices } from '../data-providers';
import { SyncDataService } from '../sync-data.service';
import { UserDataService } from '../user-data.service';

describe('InMemoryUserDataService and InMemorySyncDataService', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideDataServices(true)] }));

  it('finds a user by username ignoring case and surrounding spaces', async () => {
    const user = await firstValueFrom(TestBed.inject(UserDataService).getByUsername('  NIMAL '));
    expect(user?.id).toBe('usr-001');
  });

  it('returns null for an unknown username', async () => {
    expect(await firstValueFrom(TestBed.inject(UserDataService).getByUsername('ghost'))).toBeNull();
  });

  it('never stores a password on a user', async () => {
    const users = await firstValueFrom(TestBed.inject(UserDataService).getAll());
    expect(users.every(user => !('password' in user))).toBeTrue();
  });

  it('starts online and emits updated sync state', async () => {
    const service = TestBed.inject(SyncDataService);
    const states: string[] = [];
    const subscription = service.status$.subscribe(status => states.push(status.state));
    await firstValueFrom(
      service.setStatus({ state: SyncState.OFFLINE, pendingChanges: 3, minutesSinceSync: 40 })
    );
    subscription.unsubscribe();
    expect(states).toEqual([SyncState.ONLINE, SyncState.OFFLINE]);
  });
});
