/** When the installed app asks the server whether a new version exists.
 *
 * A browser checks for a new service worker on its own only when a page is
 * navigated to. An installed app that is reopened from the recent-apps list
 * is not navigated, it is just shown again, so on a phone a deploy could go
 * unnoticed for several reopens. So the app also asks: every hour while it is
 * open, and each time it comes back to the foreground.
 *
 * Kept free of the service worker plumbing (swUpdate.ts) so it can be tested
 * on its own. */

/** The steady check while the app stays open. */
export const CHECK_EVERY_MS = 60 * 60 * 1000

/** At most one check a minute: switching apps back and forth fires a
 *  visibility change each time, and each check is a request for sw.js. */
export const MIN_GAP_MS = 60 * 1000

export interface CheckState {
  now: number
  /** When the last check ran; registration itself counts as one. */
  lastCheckAt: number
  /** navigator.onLine: false means certainly offline, so don't try. */
  online: boolean
  /** A new version is already downloading; checking again would restart it. */
  installing: boolean
}

export function shouldCheckForUpdate({ now, lastCheckAt, online, installing }: CheckState): boolean {
  return online && !installing && now - lastCheckAt >= MIN_GAP_MS
}
