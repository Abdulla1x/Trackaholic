/** The app's address before the move to trackaholic.app, and its address now.
 *
 * The old address keeps serving the app, so installed copies still update and
 * can show where to go: a redirect would never reach them, because their
 * service worker answers every page from its cache. A browser keeps storage
 * per address, so moving means signing in again at the new one, and that is
 * what the notice on the old address asks people to do. */
export const OLD_HOST = 'macros-calculator-mu.vercel.app'
export const NEW_ORIGIN = 'https://trackaholic.app'

/** True only on the old address; the new one, previews and localhost never
 *  show the notice. */
export function isOldAddress(hostname: string): boolean {
  return hostname === OLD_HOST
}
