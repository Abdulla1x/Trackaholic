import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import AuthFrame, { AUTH_TITLE } from './auth/AuthFrame'
import Retry from '@/ui/retry'

export default function RequireAuth() {
  const { user, loading, unreachable, retry } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-small text-ink-2">Loading…</p>
      </div>
    )
  }
  // The login is still stored; the server just couldn't confirm it. Sending
  // this to the login page would sign someone out for the server's fault.
  // AuthFrame brings the warm-up notice with it, so a server that is booting
  // says so here too.
  if (!user && unreachable) {
    return (
      <AuthFrame>
        <h1 className={AUTH_TITLE}>Can&rsquo;t reach the server</h1>
        <Retry
          role="alert"
          text="You're still signed in. The server didn't answer, so try again in a moment."
          onRetry={retry}
        />
      </AuthFrame>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <Outlet />
}
