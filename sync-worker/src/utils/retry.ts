/**
 * Exponential backoff retry for Change Stream watchers.
 * Starts at 2s, doubles each attempt, caps at 60s.
 *
 * Example:  retry 1 → 2s,  retry 2 → 4s,  retry 3 → 8s ... retry 6+ → 60s
 */

const MAX_DELAY_MS = 60_000;
const BASE_DELAY_MS = 2_000;

/** Returns how many ms to wait before retry attempt N (1-indexed) */
export function backoffMs(attempt: number): number {
  const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

/** Sleep for N milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Restart a watcher function with exponential backoff.
 * Logs clearly so you can see retry state in the terminal.
 *
 * @param name    Short name for logs e.g. 'apps'
 * @param attempt Current retry count (starts at 1)
 * @param restart The function to call to restart the watcher
 */
export function scheduleRestart(
  name: string,
  attempt: number,
  restart: () => Promise<void>
): void {
  const delayMs = backoffMs(attempt);
  const delaySec = (delayMs / 1000).toFixed(0);

  console.log(`[watcher:${name}] 🔄 Restarting in ${delaySec}s (attempt ${attempt})...`);

  setTimeout(() => {
    restart().catch((err) => {
      console.error(`[watcher:${name}] restart failed:`, err.message);
    });
  }, delayMs);
}
