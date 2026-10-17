import { useSettings } from './SettingsContext'
import { useToast } from '@/ui/toast'
import type { Settings } from '../types'

/** Save one setting the moment it is tapped: switches, and chips that stand
 *  alone (Units on the You page). No Save bar, because there is no half-made
 *  value to hold back; "Saved" appears as a toast instead.
 *
 *  Only the patch is laid over the SAVED row, never over a screen's draft, so
 *  tapping a switch cannot quietly save numbers still being typed beside it.
 *  Those stay in the draft, which keeps only edits and so survives the saved
 *  row changing under it. */
export function useInstantSave() {
  const { settings, updateSettings } = useSettings()
  const toast = useToast()
  return async (patch: Partial<Settings>) => {
    if (!settings) return
    try {
      await updateSettings({ ...settings, ...patch })
      toast.show({ text: 'Saved' })
    } catch (err) {
      toast.show({ text: err instanceof Error ? err.message : "Couldn't save that. Try again." })
    }
  }
}
