import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import NotFound from '../pages/NotFound'

/**
 * Gate for the admin page. Nested inside RequireAuth, so by the time this
 * renders there is definitely a loaded, logged-in user — which is why it has
 * none of RequireAuth's loading or redirect branches.
 *
 * This is presentation, not protection. It decides whether to draw the page;
 * the API decides whether to answer it, independently, on every request. If
 * this check were the only one, editing `is_admin` in memory would be enough
 * to read everyone's metrics.
 *
 * The app's own 404 page rather than a redirect to /: there is no nav link to
 * this page, so anyone arriving here without access typed or followed the URL,
 * and bouncing them somewhere else would confirm the route exists while also
 * looking like a broken link. The same page as any other unknown address, not
 * a panel of its own, which would give the route away just as well.
 */
export default function RequireAdmin() {
  const { user } = useAuth()

  if (!user?.is_admin) {
    return <NotFound />
  }
  return <Outlet />
}
