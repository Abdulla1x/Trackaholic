/** Whether a failed "who am I?" means the stored login is no good.
 *
 * Only a 401 says that. Everything else (a dead network, a timeout, a 5xx, a
 * server mid-restart, which the client sees as status 0) says nothing about
 * the login, and signing someone out for it would be the app's mistake, not
 * theirs. */
export function isInvalidSession(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && err.status === 401
}
