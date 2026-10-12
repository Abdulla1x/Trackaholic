import { useCallback, useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { validateSettingsField } from '../lib/limits'
import type { Settings } from '../types'
import { useSettings } from './SettingsContext'

/** Does the working copy differ from the row the server has?
 *
 * Deliberately not `JSON.stringify(a) !== JSON.stringify(b)`. That is correct
 * only while key order stays stable, which holds today purely because the
 * draft is built by spreading the saved row -- a rule that holds by luck, and
 * this codebase has been bitten before by a comment asserting an invariant its
 * own contents did not enforce. Walking the keys costs nothing and needs no
 * such assumption. `water_quick_adds` and `trackers` are the arrays on the
 * row, hence the element-wise arm.
 */
export function settingsDiffer(a: Settings, b: Settings): boolean {
  return (Object.keys(a) as (keyof Settings)[]).some((key) => {
    const left = a[key]
    const right = b[key]
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length !== right.length || left.some((value, index) => value !== right[index])
    }
    return left !== right
  })
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Unsaved edits to the settings row, held back until Save.
 *
 * Only the EDITS are kept, not a copy of the whole row. The working copy is
 * the saved row with the edits laid over it, so when the saved row changes
 * underneath (another save, a weigh-in recomputing an automatic target) the
 * fields nobody touched follow it, and the ones being typed into stay as
 * typed. A full copy would have to choose between the two.
 *
 * Edits are not published to the rest of the app until Save: editing the
 * shared row directly would make Today follow every keystroke, including a
 * half-typed "1" on the way to "1800".
 *
 * `blocks` decides which in-app navigations ask "Leave without saving?" while
 * there are unsaved edits. A reload, a closed tab or an external link always
 * gets the browser's own prompt, which is all a page is allowed to show there.
 */
export function useSettingsDraft(blocks: (from: string, to: string) => boolean) {
  const { settings: saved, error: loadError, updateSettings } = useSettings()
  const [edits, setEdits] = useState<Partial<Settings>>({})
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState('')
  // The refusal message for a value that has just been rejected and undone.
  const [rejected, setRejected] = useState<string | null>(null)
  // Bumped after every successful save, so anything derived from the row
  // (the worked-out targets) refetches instead of sitting stale beside it.
  const [targetsKey, setTargetsKey] = useState(0)

  const draft = saved ? { ...saved, ...edits } : null
  const dirty = draft !== null && saved !== null && settingsDiffer(draft, saved)

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && blocks(currentLocation.pathname, nextLocation.pathname),
  )

  // "Saved" is an acknowledgement, not a state to sit in.
  useEffect(() => {
    if (status !== 'saved') return
    const timer = setTimeout(() => setStatus('idle'), 2_500)
    return () => clearTimeout(timer)
  }, [status])

  const update = useCallback((patch: Partial<Settings>) => {
    setEdits((now) => ({ ...now, ...patch }))
    setStatus('idle')
  }, [])

  /** Refuse an out-of-range value the moment the user leaves the field.
   *
   * On blur rather than on change: validating every keystroke would reject
   * "7" on the way to typing "0.7". On blur the user has finished, and the
   * answer arrives while they are still looking at the field.
   *
   * The value is *undone*, not merely flagged: a number the server is certain
   * to refuse, left in the box, looks accepted and fails again on the next
   * save for a reason the user has by then forgotten. */
  const guard = (field: keyof Settings) => () => {
    if (!draft) return
    const problem = validateSettingsField(field, draft[field] as number | null)
    if (!problem) return
    setRejected(problem)
    setEdits(({ [field]: _undone, ...rest }) => rest)
  }

  const save = async () => {
    if (!draft) return
    setStatus('saving')
    try {
      // Through the context, so Today and Progress pick the change up at once.
      await updateSettings(draft)
      setEdits({})
      setTargetsKey((key) => key + 1)
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return {
    saved,
    loadError,
    draft,
    dirty,
    status,
    error,
    rejected,
    setRejected,
    targetsKey,
    blocker,
    update,
    guard,
    save,
  }
}
