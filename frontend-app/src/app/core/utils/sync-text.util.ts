import { SyncActionResult } from '../models/domain/sync-action-result.model';
import { SyncStatus } from '../models/domain/sync-status.model';

export interface SyncMessage {
  tone: 'success' | 'info' | 'warning';
  text: string;
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const DATA_LOSS_NOTE =
  "Changes are saved on this device first and sent to the central record when a connection is available. If you clear this browser's data or lose this device before changes are sent, those unsent changes are lost.";

export const SIGN_OUT_WARNING =
  'Some changes are not on the central record yet and may be lost if this device is cleared or lost. Sign out anyway?';

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function formatSyncTime(iso: string | null): string {
  if (iso === null) return 'No successful sync yet';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? 'No successful sync yet' : DATE_TIME.format(parsed);
}

export function describeLastError(status: SyncStatus): string | null {
  if (status.lastError === 'unauthorised') {
    return 'Cannot reach the central record (not authorised). Your changes are safe on this device.';
  }
  if (status.lastError === 'unreachable') {
    return 'The central record could not be reached. Your changes are safe on this device and will be retried.';
  }
  return null;
}

function problemMessage(result: SyncActionResult): SyncMessage | null {
  if (result.outcome === 'offline') {
    return {
      tone: 'warning',
      text: 'You are offline, so nothing can sync now. Nothing is lost; changes stay on this device.',
    };
  }
  if (result.outcome === 'unauthorised') {
    return {
      tone: 'warning',
      text: 'The central record did not accept this device, so nothing was sent. Nothing is lost.',
    };
  }
  if (result.outcome === 'failed') {
    return {
      tone: 'warning',
      text: 'Sync did not finish. Nothing is lost; it will be retried.',
    };
  }
  if (result.outcome === 'busy') return { tone: 'info', text: 'A sync is already running.' };
  return null;
}

export function describeSyncNow(result: SyncActionResult): SyncMessage {
  const problem = problemMessage(result);
  if (problem !== null) return problem;
  if (result.pendingChanges > 0) {
    return {
      tone: 'warning',
      text: `Sync finished, but ${plural(result.pendingChanges, 'change')} still waiting to be sent.`,
    };
  }
  return { tone: 'success', text: 'Sync finished. Everything is up to date.' };
}

export function describeBackUpNow(result: SyncActionResult): SyncMessage {
  const problem = problemMessage(result);
  if (problem !== null) return problem;
  if (result.pendingChanges > 0) {
    return {
      tone: 'warning',
      text: `Not fully backed up: ${plural(result.pendingChanges, 'change')} still waiting to be sent.`,
    };
  }
  if (result.attentionCount > 0) {
    return {
      tone: 'warning',
      text: `The central record holds every accepted change. ${plural(result.attentionCount, 'change')} were refused and need attention.`,
    };
  }
  return {
    tone: 'success',
    text: 'Backed up. The central record now holds every change made on this device.',
  };
}
