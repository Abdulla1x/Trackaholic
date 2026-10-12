import { useEffect, type ReactNode } from 'react'
import ScreenBar from '../shell/ScreenBar'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { useSettingsDraft } from '../../settings/useSettingsDraft'
import { SCREEN_FRAME, SettingsScreenContext } from './screenContext'
import { AlertDialog } from '@/ui/alert-dialog'
import { SaveBar } from '@/ui/save-bar'
import { useToast } from '@/ui/toast'

/** The Save bar going away already says it worked, so "Saved" only has to
 *  flash: 1.5 s rather than the usual five, which covered the bottom of the
 *  screen (and took taps meant for it) long after the point was made. */
const SAVED_TOAST_MS = 1_500

/** One settings screen, pushed from You: the back arrow, the form, and its
 *  own Save bar.
 *
 *  Each screen holds its own draft, and leaving the screen with unsaved
 *  changes asks first, whichever way you leave: the back arrow, a tab, or the
 *  phone's back button. The old Settings shell kept one draft across all its
 *  tabs; with a page of rows that each open a screen, a change left behind on
 *  a screen you can no longer see would be a surprise when it was saved, so
 *  the question is asked at the screen's edge instead. */
export default function SettingsScreen({ title, children }: { title: string; children: ReactNode }) {
  const { loadError, draft, dirty, status, error, rejected, setRejected, targetsKey, blocker, update, guard, save, discard } =
    useSettingsDraft((from, to) => from !== to)
  const toast = useToast()
  useLiveMessage(loadError)

  useEffect(() => {
    if (status === 'saved') toast.show({ text: 'Saved', duration: SAVED_TOAST_MS })
    // Only the transition into 'saved' should show it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return (
    <div className={SCREEN_FRAME}>
      <ScreenBar title={title} back="/you" backLabel="Back to You" />
      {draft ? (
        <SettingsScreenContext.Provider
          value={{ settings: draft, update, guard, onRejected: setRejected, targetsKey }}
        >
          {children}
        </SettingsScreenContext.Provider>
      ) : (
        <p className="py-3.5 text-ink-2">{loadError || 'Loading…'}</p>
      )}
      {(dirty || status === 'saving') && (
        <SaveBar
          saving={status === 'saving'}
          error={status === 'error' ? error : undefined}
          onSave={save}
          onUndo={discard}
        />
      )}
      <AlertDialog
        open={blocker.state === 'blocked'}
        title="Leave without saving?"
        cancel="Stay"
        confirm="Leave without saving"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        Your changes on this screen haven’t been saved.
      </AlertDialog>
      <AlertDialog
        open={rejected !== null}
        title="That value can’t be used"
        cancel="OK"
        onCancel={() => setRejected(null)}
      >
        {rejected}
      </AlertDialog>
    </div>
  )
}
