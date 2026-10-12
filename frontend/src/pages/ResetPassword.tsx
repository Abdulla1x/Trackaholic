import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import AuthFrame, { AUTH_LINK, AUTH_NOTE, AUTH_TITLE, AuthField } from '../components/auth/AuthFrame'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { useLiveMessage } from '../hooks/useLiveMessage'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  // Captured once, on the first render, because the effect below then removes
  // it from the URL. Reading it in an initialiser rather than an effect is what
  // makes that safe under StrictMode, which mounts every component twice in
  // dev — an effect-based read would find the query string already stripped on
  // the second pass.
  const [token] = useState(() => searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Take the token out of the address bar and the back-history entry. The
    // Referrer-Policy in vercel.json already stops it leaking to other origins,
    // but it would otherwise sit in browser history and in the host's request
    // logs for as long as those are kept.
    if (searchParams.has('token')) {
      navigate('/reset-password', { replace: true })
    }
  }, [searchParams, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await api.resetPassword(token, password)
      // Any session stored on THIS device is now revoked server-side — the
      // reset moved password_changed_at past its token. Clearing it locally
      // keeps AuthContext from holding a user it can no longer authenticate.
      logout()
      navigate('/login', {
        replace: true,
        state: { notice: 'Password updated — log in with your new password.' },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      {token ? (
        <form className="grid gap-3.5" onSubmit={handleSubmit}>
          <h1 className={AUTH_TITLE}>Choose a new password</h1>
          <AuthField label="New password">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
            <span className="text-small text-ink-2">At least 8 characters.</span>
          </AuthField>
          <AuthField label="Confirm password">
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={FIELD}
            />
          </AuthField>
          {error && <p className={AUTH_NOTE}>{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      ) : (
        <section className="grid gap-3 text-small">
          <h1 className={AUTH_TITLE}>That link is incomplete</h1>
          <p className="text-ink-2">
            This page needs the link from your reset email. Some mail apps cut
            long links in half — try copying the whole thing, or request a new
            one.
          </p>
          <p className="text-center">
            <Link to="/forgot-password" className={AUTH_LINK}>
              Request a new link
            </Link>
          </p>
        </section>
      )}
    </AuthFrame>
  )
}
