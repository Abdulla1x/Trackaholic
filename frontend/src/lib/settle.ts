/** How long a value has to stay put before a page loads what it names.
 *
 * Long enough to swallow the gap between taps of someone holding an arrow,
 * short enough that a deliberate second tap still feels immediate. */
export const SETTLE_MS = 300

/** How long to wait before acting on a change that came `sinceLastChange` ms
 * after the previous one: 0 means act at once.
 *
 * A change after a quiet spell is acted on immediately, so a single tap costs
 * nothing. A change hard on the heels of another waits the full window, and
 * each further change restarts it, so a run of taps loads only where it stops.
 * Today's date arrows fire about six requests per day shown; on 2026-10-21 a
 * held arrow queued enough of them on the free instance to get it restarted
 * three times. */
export function settleDelay(sinceLastChange: number, ms: number = SETTLE_MS): number {
  return sinceLastChange >= ms ? 0 : ms
}
