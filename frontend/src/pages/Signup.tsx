import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isSessionPersistent } from '../auth/token'
import AuthFrame, { AUTH_LINK, AUTH_NOTE, AUTH_TITLE, AuthField } from '../components/auth/AuthFrame'
import GoogleButton from '../components/auth/GoogleButton'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { useLiveMessage } from '../hooks/useLiveMessage'

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  // Arrived from the demo's Create an account, which ends the demo.
  const fromDemo = Boolean((useLocation().state as { fromDemo?: boolean } | null)?.fromDemo)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  // Probed once per mount: the answer cannot change while the page is open.
  const [persistentSession] = useState(isSessionPersistent)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await signup(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  // The same call as on Log in: the server creates the account the first
  // time it sees this Google account, and signs it in every time after.
  async function continueWithGoogle(credential: string) {
    setError(null)
    setSubmitting(true)
    try {
      await loginWithGoogle(credential)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      <form className="grid gap-3.5" onSubmit={handleSubmit}>
        <h1 className={AUTH_TITLE}>Create your account</h1>
        {fromDemo && (
          <p className={AUTH_NOTE}>
            Your demo has ended. A new account starts empty, so every number you see from here on is yours.
          </p>
        )}
        {!persistentSession && (
          <p className={AUTH_NOTE}>
            This browser is blocking site data, so you&rsquo;ll stay signed in
            only until you close this tab. Allowing it for this site, or
            leaving private browsing, keeps you signed in.
          </p>
        )}
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
          <span className="text-small text-ink-2">At least 8 characters.</span>
        </AuthField>
        {error && <p className={AUTH_NOTE}>{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
        {/* Email first, Google under it: the form is the way in, and Google
            a quieter second one (chosen on a prototype, 2026-10-22). */}
        <GoogleButton onCredential={(credential) => void continueWithGoogle(credential)} />
        <p className="text-center text-small text-ink-2">
          Already have an account?{' '}
          <Link to="/login" className={AUTH_LINK}>
            Log in
          </Link>
        </p>
        <p className="text-center text-small text-ink-2">
          <Link to="/privacy" className={AUTH_LINK}>
            Privacy
          </Link>
        </p>
      </form>
    </AuthFrame>
  )
}
