import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/ui/button'

/** What an unmatched URL renders.
 *
 * Before this route existed, a typed or stale path fell through every branch
 * and `<Routes>` matched nothing: signed in, that drew the nav above a blank
 * area; signed out, a white screen. Neither said anything had gone wrong, so
 * both read as the app being broken rather than the address being wrong.
 *
 * Only registered inside the authenticated Layout, which is enough: RequireAuth
 * redirects a signed-out visitor to /login before Layout renders, so there is
 * no unauthenticated path left for a second catch-all to cover.
 */
export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <div className="grid justify-items-start gap-4 py-2">
      <header className="grid gap-1">
        <h1 className="text-[20px] leading-tight font-bold [font-stretch:105%]">Page not found</h1>
        <p className="text-small text-ink-2">
          Nothing lives at <code className="text-ink">{pathname}</code>.
        </p>
      </header>
      <p className="text-small text-ink-2">
        If you followed a link from inside the app, that is a bug worth
        reporting. If you typed the address, check it for a typo.
      </p>
      <Button asChild>
        <Link to="/">Back to the dashboard</Link>
      </Button>
    </div>
  )
}
