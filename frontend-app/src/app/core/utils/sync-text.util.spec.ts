import { SyncActionResult } from '../models/domain/sync-action-result.model';
import { describeBackUpNow, describeSyncNow, formatSyncTime } from './sync-text.util';

describe('sync text', () => {
  const result = (change: Partial<SyncActionResult>): SyncActionResult => ({
    outcome: 'completed',
    pendingChanges: 0,
    attentionCount: 0,
    ...change,
  });

  it('says plainly when no sync has happened yet', () => {
    expect(formatSyncTime(null)).toBe('No successful sync yet');
    expect(formatSyncTime('not a date')).toBe('No successful sync yet');
    expect(formatSyncTime('2026-11-24T09:12:00.000Z')).toContain('2026');
  });

  it('reassures that nothing is lost when offline', () => {
    const message = describeSyncNow(result({ outcome: 'offline', pendingChanges: 2 }));
    expect(message.tone).toBe('warning');
    expect(message.text).toContain('Nothing is lost');
  });

  it('confirms a clean Sync now and reports what is left', () => {
    expect(describeSyncNow(result({})).tone).toBe('success');
    expect(describeSyncNow(result({ pendingChanges: 1 })).text).toContain('1 change still waiting');
  });

  it('tells the user clearly what Back up now achieved or what is outstanding (AC-19)', () => {
    expect(describeBackUpNow(result({})).text).toContain('holds every change');
    expect(describeBackUpNow(result({ pendingChanges: 3 })).text).toContain(
      '3 changes still waiting'
    );
    expect(describeBackUpNow(result({ attentionCount: 2 })).text).toContain(
      '2 changes were refused'
    );
    expect(describeBackUpNow(result({ outcome: 'unauthorised' })).text).toContain(
      'Nothing is lost'
    );
    expect(describeBackUpNow(result({ outcome: 'busy' })).tone).toBe('info');
  });
});
