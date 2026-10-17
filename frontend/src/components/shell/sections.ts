/** The navigation's four places (overhaul 0a, Option A), and which routes
 *  belong to each. The one place that knows. */
export type Section = 'today' | 'progress' | 'log' | 'you'

export const SECTION_HOME: Record<Section, string> = {
  today: '/',
  progress: '/progress',
  log: '/log',
  you: '/you',
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Which tab is current for a path, or null for a page that belongs to none
 *  (Admin, an unknown address). */
export function sectionFor(pathname: string): Section | null {
  // The day in detail, its meal screens and setup are pushed from Today.
  if (pathname === '/' || under(pathname, '/day') || pathname === '/setup') return 'today'
  if (under(pathname, '/progress')) return 'progress'
  if (under(pathname, '/log')) return 'log'
  if (under(pathname, '/you') || under(pathname, '/whats-new') || under(pathname, '/how-it-works')) return 'you'
  return null
}

/** How far a screen sits below its tab (DESIGN.md: Screen push and back).
 *  Each tab's own page is 0. The day in detail and the Progress screens with
 *  a back arrow are 1, a settings screen pushed from You is 1, and a meal,
 *  pushed from the day, is 2. */
export function screenDepth(pathname: string): number {
  if (/^\/day\/[^/]+\/meal\/[^/]+$/.test(pathname)) return 2
  if (/^\/day\/[^/]+$/.test(pathname)) return 1
  if (pathname === '/setup') return 1
  if (pathname === '/how-it-works/target') return 2
  if (pathname === '/how-it-works') return 1
  if (pathname.startsWith('/progress/')) return 1
  if (pathname.startsWith('/you/')) return 1
  return 0
}

/** What the page is keyed on, so a change of key replays its entrance: the
 *  whole path. Every settings screen holds its own draft now, so none of them
 *  needs to survive a change of address the way the old Settings tabs did. */
export function routeKey(pathname: string): string {
  return pathname
}

export type ScreenMotion = 'fade' | 'push' | 'back'

/** How the page arrives (DESIGN.md Motion). Going deeper pushes (slides in
 *  from the right), coming up goes back (from the left), whichever button or
 *  link did it, the phone's back button included. Moving to another tab's
 *  own page is a tab change, which crossfades, even from deep inside another
 *  tab. Anything else, the first page included, fades. */
export function screenMotion(from: string | null, to: string): ScreenMotion {
  if (from === null) return 'fade'
  const before = screenDepth(from)
  const after = screenDepth(to)
  if (after === 0 && sectionFor(from) !== sectionFor(to)) return 'fade'
  if (after > before) return 'push'
  if (after < before) return 'back'
  return 'fade'
}
