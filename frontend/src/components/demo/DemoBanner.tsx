import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { AlertDialog } from '@/ui/alert-dialog'
import { useToast } from '@/ui/toast'

/** The demo's two ways out, shared by the banner and the You page.
 *
 *  Create an account starts clean: the made-up month is not carried over, so
 *  every number in the new account is the visitor's own. It opens sign-up
 *  first and ends the demo behind it, quietly.
 *
 *  End demo asks first (chosen on a prototype, 2026-10-24), with Keep looking
 *  as the filled, safe choice. Once the server has deleted it, signing out
 *  sends RequireAuth to the login page, which says the demo ended. */
export function useLeaveDemo() {
  const { endDemo } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [asking, setAsking] = useState(false)
  const [ending, setEnding] = useState(false)

  const createAccount = () => {
    navigate('/signup', { state: { fromDemo: true } })
    void endDemo({ quiet: true })
  }

  const end = async () => {
    setEnding(true)
    try {
      await endDemo()
    } catch {
      setEnding(false)
      setAsking(false)
      toast.show({ text: "The demo didn't end. Check your connection, then try again." })
    }
  }

  const dialog = (
    <AlertDialog
      open={asking}
      title="End the demo?"
      cancel="Keep looking"
      confirm={ending ? 'Ending…' : 'End demo'}
      onCancel={() => setAsking(false)}
      onConfirm={() => void end()}
    >
      The demo account and its made-up data are deleted now. You can start a new one any time.
    </AlertDialog>
  )

  return { createAccount, askToEnd: () => setAsking(true), dialog }
}

const LINK =
  'font-semibold underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

/** A thin ruled strip above every screen of a demo account (picked on a
 *  prototype over a note block and a pinned bar, 2026-10-24): what this is,
 *  and the two ways out. Quiet, so the app under it is what gets looked at. */
export default function DemoBanner() {
  const { user } = useAuth()
  const leave = useLeaveDemo()
  if (!user?.is_demo) return null
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
      <p className="text-field-label text-ink">Demo · made-up data · gone in 24 h</p>
      <p className="flex gap-4 text-small">
        <button type="button" className={`${LINK} text-action`} onClick={leave.createAccount}>
          Create an account
        </button>
        <button type="button" className={`${LINK} text-ink`} onClick={leave.askToEnd}>
          End demo
        </button>
      </p>
      {leave.dialog}
    </div>
  )
}
