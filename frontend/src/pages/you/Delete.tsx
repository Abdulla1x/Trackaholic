import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import ScreenBar from '../../components/shell/ScreenBar'
import { SCREEN_FRAME } from '../../components/you/screenContext'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { downloadExport } from '../../lib/downloadExport'
import { AlertDialog } from '@/ui/alert-dialog'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { cn } from '@/lib/utils'
import { FIELD, FIELD_DESK_WIDTH } from '@/ui/field'

/** Delete account, pushed from You.
 *
 *  Plain ink, no red (DESIGN.md: the No Red rule); the words carry the
 *  weight. The download comes first on the screen, because once the account
 *  is gone there is nothing left to download, and nobody can bring it back.
 *  The button is the quiet secondary one, and it still asks once more. */
export default function DeleteScreen() {
  const { deleteAccount } = useAuth()
  const [password, setPassword] = useState('')
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  useLiveMessage(error)

  const download = async () => {
    setError('')
    try {
      await downloadExport('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The download failed. Try again.')
    }
  }

  const remove = async () => {
    setAsking(false)
    setDeleting(true)
    setError('')
    try {
      await deleteAccount(password)
      // AuthContext clears the user, so RequireAuth sends you to Log in.
    } catch (err) {
      setError(err instanceof Error ? err.message : "The account wasn't deleted. Try again.")
      setDeleting(false)
    }
  }

  return (
    <div className={SCREEN_FRAME}>
      <ScreenBar title="Delete account" back="/you" backLabel="Back to You" />
      <Block>
        <p className="font-bold">This deletes everything: meals, weigh-ins, foods. It can't be undone.</p>
        <p className="text-small text-ink-2">
          Want a copy first?{' '}
          <button
            type="button"
            onClick={download}
            className="font-semibold text-ink underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Download all my data
          </button>
        </p>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-small text-ink-2">Type your password to confirm</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn(FIELD, FIELD_DESK_WIDTH)}
          />
        </label>
        <div>
          <Button variant="secondary" disabled={password === '' || deleting} onClick={() => setAsking(true)}>
            {deleting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
        {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}
      </Block>
      <AlertDialog
        open={asking}
        title="Delete your account?"
        confirm="Delete my account"
        onCancel={() => setAsking(false)}
        onConfirm={remove}
      >
        Everything goes, for good. There is no way to get it back.
      </AlertDialog>
    </div>
  )
}
