export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 5 * 60 * 1000;
const JITTER_SHARE = 0.2;

export function backoffDelayMs(
  failures: number,
  random: () => number = Math.random,
  retryAfterMs = 0
): number {
  const exponent = Math.max(failures - 1, 0);
  const base = Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_CAP_MS);
  const jittered = base + Math.floor(base * JITTER_SHARE * random());
  return Math.min(Math.max(jittered, retryAfterMs), BACKOFF_CAP_MS);
}
