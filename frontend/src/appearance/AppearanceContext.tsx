import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  APPEARANCE_KEY,
  parseAppearance,
  resolveTheme,
  type Appearance,
} from '../lib/appearance'
import { readLocal, writeLocal } from '../lib/storage'

/** The device's Automatic / Light / Dark, palette and style, once the app is
 *  running. public/theme-init.js has already set the same attributes before
 *  the first paint; this takes over from there, so a change on You →
 *  Appearance shows at once and Automatic keeps following the phone.
 *
 *  Outside AuthProvider (main.tsx): the sign-in screens follow the device
 *  too, and none of this belongs to an account. */
interface AppearanceState {
  appearance: Appearance
  /** The theme on screen now: Automatic resolved against the phone. */
  theme: 'light' | 'dark'
  setAppearance: (change: Partial<Appearance>) => void
}

const AppearanceContext = createContext<AppearanceState | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'

function phoneQuery(): MediaQueryList | null {
  try {
    return window.matchMedia(DARK_QUERY)
  } catch {
    return null
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setChoice] = useState(() => parseAppearance(readLocal(APPEARANCE_KEY)))
  const [phoneIsDark, setPhoneIsDark] = useState(() => phoneQuery()?.matches ?? false)
  const theme = resolveTheme(appearance.theme, phoneIsDark)

  // Follow the phone's dark mode while it changes (only Automatic uses it),
  // and another tab's choice, so two open tabs never disagree.
  useEffect(() => {
    const query = phoneQuery()
    const onPhone = (event: MediaQueryListEvent) => setPhoneIsDark(event.matches)
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY) setChoice(parseAppearance(event.newValue))
    }
    query?.addEventListener('change', onPhone)
    window.addEventListener('storage', onStorage)
    return () => {
      query?.removeEventListener('change', onPhone)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // One place writes the choice everywhere it goes: storage, the three
  // attributes theme.css switches on, and the browser bar's colour. Writing
  // storage here rather than in setAppearance keeps the updater pure; on the
  // first run it rewrites what was read, tidying a removed palette away.
  useEffect(() => {
    writeLocal(APPEARANCE_KEY, JSON.stringify(appearance))
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    if (appearance.palette === 'daylight') root.removeAttribute('data-palette')
    else root.setAttribute('data-palette', appearance.palette)
    if (appearance.style === 'fields') root.removeAttribute('data-style')
    else root.setAttribute('data-style', appearance.style)
    // Read back from the CSS rather than from a table, so the bar always
    // matches the ground actually painted, whatever the palette and style.
    const ground = getComputedStyle(root).getPropertyValue('--ground').trim()
    if (ground) {
      for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
        meta.content = ground
      }
    }
  }, [appearance, theme])

  const setAppearance = useCallback(
    (change: Partial<Appearance>) => setChoice((current) => ({ ...current, ...change })),
    [],
  )

  return (
    <AppearanceContext.Provider value={{ appearance, theme, setAppearance }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance(): AppearanceState {
  const state = useContext(AppearanceContext)
  if (!state) throw new Error('useAppearance must be used within AppearanceProvider')
  return state
}
