import { Link } from 'react-router-dom'
import AuthFrame, { AUTH_LINK, AUTH_TITLE } from '../components/auth/AuthFrame'
import NoPasswordReset from '../components/auth/NoPasswordReset'

/** No reset form until sending email is switched on: the form could only
 *  ever answer "not available", after asking for an address. The form and
 *  its "check your inbox" step are in git history, to bring back with the
 *  email provider. */
export default function ForgotPassword() {
  return (
    <AuthFrame>
      <section className="grid gap-3.5">
        <h1 className={AUTH_TITLE}>Forgot your password?</h1>
        <NoPasswordReset />
        <p className="text-center text-small text-ink-2">
          <Link to="/login" className={AUTH_LINK}>
            Back to log in
          </Link>
        </p>
      </section>
    </AuthFrame>
  )
}
