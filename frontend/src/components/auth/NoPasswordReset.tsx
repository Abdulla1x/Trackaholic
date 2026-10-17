import { CONTACT_EMAIL } from '../../lib/contact'
import { AUTH_LINK } from './AuthFrame'

/** Until password reset is switched on (the backend answers 503: sending
 *  email needs a provider), a forgotten password is sorted out by email.
 *  Shown on Login in place of the reset link, and on /forgot-password, which
 *  an old bookmark or the reset page's own link can still reach. */
export default function NoPasswordReset() {
  return (
    <p className="text-center text-small text-ink-2">
      No password reset yet. Locked out? Email{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className={`${AUTH_LINK} [overflow-wrap:anywhere]`}>
        {CONTACT_EMAIL}
      </a>
      .
    </p>
  )
}
