export class StorageQuotaExceededError extends Error {
  constructor() {
    super('There is not enough space on this device to save that. Free up space and try again.');
    this.name = 'StorageQuotaExceededError';
  }
}

export function isQuotaExceeded(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: unknown; inner?: unknown };
  return candidate.name === 'QuotaExceededError' || isQuotaExceeded(candidate.inner);
}
