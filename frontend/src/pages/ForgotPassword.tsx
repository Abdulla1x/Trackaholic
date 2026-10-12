import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import AuthFrame, { AUTH_LINK, AUTH_NOTE, AUTH_TITLE, AuthField } from '../components/auth/AuthFrame'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { useLiveMessage } from '../hooks/useLiveMessage'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.forgotPassword(email)
      setSent(true)
    } catch (err) {
      // Only real failures land here — a 503 when email isn't configured, a 429,
      // or the network. An address with no account still answers 200, by design.
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame>
      {sent ? (
        <section className="grid gap-3 text-small">
          <h1 className={AUTH_TITLE}>Check your inbox</h1>
          <p className="text-ink-2">
            If an account exists for <span className="text-ink">{email}</span>,
            a reset link is on its way. It works for one hour and can only be
            used once.
          </p>
          {/* Written here rather than echoed from the API: this is a fact
              about how the mail is delivered, not about the request. Our
              sending address is rewritten by the email provider because we
              don't own a domain yet, so the message genuinely looks like it
              came from a stranger — saying so up front is the difference
              between "check spam" and "report phishing". */}
          <p className="text-ink-2">
            It arrives from <span className="text-ink">Trackaholic</span>{' '}
            but at an unfamiliar <code className="text-ink">brevosend.com</code>{' '}
            address, so check your spam folder if it isn't there in a few
            minutes.
          </p>
          <p className="text-center text-ink-2">
            <Link to="/login" className={AUTH_LINK}>
              Back to log in
            </Link>
          </p>
        </section>
      ) : (
        <form className="grid gap-3.5" onSubmit={handleSubmit}>
          <h1 className={AUTH_TITLE}>Reset your password</h1>
          <p className="text-small text-ink-2">
            Enter your email and we'll send you a link to choose a new
            password.
          </p>
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
          {error && <p className={AUTH_NOTE}>{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="text-center text-small text-ink-2">
            Remembered it?{' '}
            <Link to="/login" className={AUTH_LINK}>
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthFrame>
  )
}
