import { Navigate, useLocation } from 'react-router-dom'

const MOVED: Record<string, string> = {
  body: '/you/body',
  food: '/you/library',
}

/** The old Settings addresses, sent to where each part lives now. They are
 *  still out there: bookmarks, a phone's home-screen shortcut, links in old
 *  release notes. The query string goes along, so a day's "Spread it" link
 *  (/settings/goals?plan=…&kind=…) still opens the planner on that day. */
export default function SettingsRedirect() {
  const { pathname, search } = useLocation()
  const segment = pathname.split('/')[2] ?? ''
  const to =
    segment === 'goals'
      ? new URLSearchParams(search).has('plan')
        ? '/you/plans'
        : '/you/targets'
      : (MOVED[segment] ?? '/you')
  return <Navigate replace to={{ pathname: to, search }} />
}
