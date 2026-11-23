import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SyncDataService } from '../sync-data.service';
import { UserDataService } from '../user-data.service';

async function waitUntil(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 80 && !condition(); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

export function describeUserAndSyncDataContract(label: string, providers: () => Provider[]): void {
  describe(label, () => {
    beforeEach(() => TestBed.configureTestingModule({ providers: providers() }));

    it('finds a user by username ignoring case and surrounding spaces', async () => {
      const user = await firstValueFrom(TestBed.inject(UserDataService).getByUsername('  NIMAL '));
      expect(user?.id).toBe('usr-001');
    });

    it('returns null for an unknown username', async () => {
      expect(
        await firstValueFrom(TestBed.inject(UserDataService).getByUsername('ghost'))
      ).toBeNull();
    });

    it('never stores a password on a user', async () => {
      const users = await firstValueFrom(TestBed.inject(UserDataService).getAll());
      expect(users.every(user => !('password' in user))).toBeTrue();
    });

    it('starts with automatic sync on', async () => {
      const status = await firstValueFrom(TestBed.inject(SyncDataService).getStatus());
      expect(status.autoSyncEnabled).toBeTrue();
    });

    it('starts online with nothing waiting and emits the updated automatic-sync setting', async () => {
      const service = TestBed.inject(SyncDataService);
      const seen: boolean[] = [];
      const first = await firstValueFrom(service.getStatus());
      expect(first.state).toBe('ONLINE');
      expect(first.pendingChanges).toBe(0);
      expect(first.attentionCount).toBe(0);
      expect(first.lastSyncAt).toBeNull();
      const subscription = service.status$.subscribe(status => seen.push(status.autoSyncEnabled));
      await waitUntil(() => seen.length === 1);
      await firstValueFrom(service.setAutoSync(false));
      await waitUntil(() => seen.includes(false));
      subscription.unsubscribe();
      expect(seen).toEqual([true, false]);
    });
  });
}
