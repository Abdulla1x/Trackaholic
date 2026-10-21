import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import ScreenBar from '../../components/shell/ScreenBar'
import { SCREEN_FRAME } from '../../components/you/screenContext'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { AlertDialog } from '@/ui/alert-dialog'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { cn } from '@/lib/utils'
import { FIELD, FIELD_DESK_WIDTH } from '@/ui/field'
import { SaveBar } from '@/ui/save-bar'

const EMPTY = { current: '', next: '', again: '' }
type Fields = typeof EMPTY

/** Change password, pushed from You.
 *
 *  Like a settings screen, typing raises the Save bar and leaving with
 *  something typed asks first, but the draft is these three boxes rather than
 *  the settings row, so it has its own small state instead of SettingsScreen.
 *
 *  The new password is asked for twice, though the prototype drew one box.
 *  A typo here locks the account until a reset email gets the user back in;
 *  the second box catches it before that. */
export default function PasswordScreen() {
  const { user } = useAuth()
  return user?.has_password === false ? <SetPasswordScreen email={user.email} /> : <ChangePasswordScreen />
}

/** For an account made through Google: it has no current password to type,
 *  so a first one is set through the reset email. The server refuses to set
 *  one from a signed-in session alone, so a stolen session can't turn itself
 *  into a permanent login; the email proves the mailbox instead. */
function SetPasswordScreen({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')
  useLiveMessage(error)
  useLiveMessage(state === 'sent' ? 'Link sent.' : '')

  const send = async () => {
    setError('')
    setState('sending')
    try {
      await api.forgotPassword(email)
      setState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : "The link wasn't sent. Try again.")
      setState('idle')
    }
  }

  return (
    <div className={SCREEN_FRAME}>
      <ScreenBar title="Set a password" back="/you" backLabel="Back to You" />
      <Block>
        <p>You sign in with Google, so this account has no password yet. You don&rsquo;t need one.</p>
        <p className="text-small text-ink-2">
          To be able to log in with your email as well, set one through a link sent to {email}.
        </p>
        {state === 'sent' ? (
          <p className="text-small font-semibold">
            Sent. Open the link in that email within an hour to choose your password.
          </p>
        ) : (
          <div>
            <Button variant="secondary" disabled={state === 'sending'} onClick={send}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
          </div>
        )}
        {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}
      </Block>
    </div>
  )
}

function ChangePasswordScreen() {
  const { user, changePassword } = useAuth()
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  useLiveMessage(error)
  useLiveMessage(changed ? 'Password changed.' : '')

  const dirty = fields.current !== '' || fields.next !== '' || fields.again !== ''

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
  )

  const edit = (key: keyof Fields) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFields((now) => ({ ...now, [key]: event.target.value }))
    setError('')
    setChanged(false)
  }

  const save = async () => {
    if (fields.current === '') return setError('Type your current password.')
    if (fields.next.length < 8) return setError('The new password needs at least 8 characters.')
    if (fields.next !== fields.again) return setError("The two new passwords don't match.")
    setSaving(true)
    try {
      // Signs every other device out; this one gets a fresh token.
      await changePassword(fields.current, fields.next)
      setFields(EMPTY)
      setChanged(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password wasn't changed. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof Fields, label: string, autoComplete: string) => (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-small text-ink-2">{label}</span>
      <input
        type="password"
        autoComplete={autoComplete}
        value={fields[key]}
        onChange={edit(key)}
        className={cn(FIELD, FIELD_DESK_WIDTH)}
      />
    </label>
  )

  return (
    <div className={SCREEN_FRAME}>
      <ScreenBar title="Change password" back="/you" backLabel="Back to You" />
      <Block>
        {/* For password managers, which file the new password under the
            account's email when they can see one. */}
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password, at least 8 characters', 'new-password')}
        {field('again', 'Type the new password again', 'new-password')}
        <p className="text-small text-ink-2">Other devices are signed out. This one stays signed in.</p>
        {changed && <p className="text-small font-semibold">Password changed.</p>}
      </Block>
      {(dirty || saving) && (
        <SaveBar saving={saving} error={error || undefined} onSave={save} onUndo={() => setFields(EMPTY)} />
      )}
      <AlertDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        cancel="Stay"
        confirm="Leave without saving"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        The new password hasn't been saved.
      </AlertDialog>
    </div>
  )
}
