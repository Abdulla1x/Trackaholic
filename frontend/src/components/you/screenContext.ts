import { createContext, useContext } from 'react'
import type { Settings } from '../../types'
import { SCREEN_WIDTH } from '@/ui/screen'

/** What a settings screen hands the form inside it.
 *
 * A React context rather than props, so a screen's sections can sit at any
 * depth under it. It lives in its own .ts file because oxlint's
 * react/only-export-components warns on a hook exported beside a component.
 */
export interface SettingsScreenValue {
  /** The working copy, not the saved row (see useSettingsDraft). */
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** Refuses an out-of-range value on blur and undoes it. Bind to onBlur. */
  guard: (field: keyof Settings) => () => void
  /** Raises the screen's refusal dialog. The sections that write straight to
   *  the server report their own bound violations through this too. */
  onRejected: (message: string) => void
  /** Bumped after every successful save, so anything derived from the row
   *  refetches instead of sitting stale beside it. */
  targetsKey: number
}

export const SettingsScreenContext = createContext<SettingsScreenValue | null>(null)

export function useSettingsScreen(): SettingsScreenValue {
  const value = useContext(SettingsScreenContext)
  if (!value) throw new Error('useSettingsScreen must be used inside a SettingsScreen')
  return value
}

/** A screen pushed from You, at least as tall as the space between the bars,
 *  so a Save bar (`mt-auto`) sits at the bottom even when the form is short. */
export const SCREEN_FRAME = `${SCREEN_WIDTH} flex min-h-[calc(100dvh-var(--shell-bottom)-env(safe-area-inset-top)-3rem)] flex-col desk:min-h-[calc(100dvh-4rem)]`
