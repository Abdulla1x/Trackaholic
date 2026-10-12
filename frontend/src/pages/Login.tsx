import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isSessionPersistent } from '../auth/token'
import AuthFrame, { AUTH_LINK, AUTH_NOTE, AUTH_TITLE, AuthField } from '../components/auth/AuthFrame'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { useLiveMessage } from '../hooks/useLiveMessage'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  // Probed once per mount: the answer cannot change while the page is open.
  const [persistentSession] = useState(isSessionPersistent)
  const [submitting, setSubmitting] = useState(false)
  // Set by the reset page, which sends people here rather than logging them in.
  const notice = (location.state as { notice?: string } | null)?.notice ?? null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', {
        replace: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <form className="grid gap-3.5" onSubmit={handleSubmit}>
        <h1 className={AUTH_TITLE}>Log in</h1>
        {!persistentSession && (
          <p className={AUTH_NOTE}>
            This browser is blocking site data, so you&rsquo;ll stay signed in
            only until you close this tab. Allowing it for this site, or
            leaving private browsing, keeps you signed in.
          </p>
        )}
        {notice && <p className="text-small font-semibold">{notice}</p>}
        <AuthField label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
        </AuthField>
        {error && <p className={AUTH_NOTE}>{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
        {/* Underlined, not told apart by colour alone (WCAG 1.4.1). Each of
            these is the only thing in its paragraph, so strictly the rule does
            not reach it; it is underlined anyway, because a reader who has
            learnt that underline means link should not meet one that is not. */}
        <p className="text-center text-small text-ink-2">
          <Link to="/forgot-password" className={AUTH_LINK}>
            Forgot your password?
          </Link>
        </p>
        <p className="text-center text-small text-ink-2">
          No account?{' '}
          <Link to="/signup" className={AUTH_LINK}>
            Sign up
          </Link>
        </p>
      </form>
    </AuthFrame>
  )
}
