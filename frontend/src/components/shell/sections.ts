/** The navigation's four places (overhaul 0a, Option A), and which routes
 *  belong to each. The one place that knows. */
export type Section = 'today' | 'progress' | 'log' | 'you'

export const SECTION_HOME: Record<Section, string> = {
  today: '/',
  progress: '/progress',
  log: '/log',
  you: '/settings',
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Which tab is current for a path, or null for a page that belongs to none
 *  (Admin, an unknown address). */
export function sectionFor(pathname: string): Section | null {
  // The day in detail and its meal screens are pushed from Today.
  if (pathname === '/' || under(pathname, '/day')) return 'today'
  if (under(pathname, '/progress')) return 'progress'
  if (under(pathname, '/log')) return 'log'
  if (under(pathname, '/settings') || under(pathname, '/whats-new')) return 'you'
  return null
}
