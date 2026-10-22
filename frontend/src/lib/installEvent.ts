// The browser half of "Add to home screen" (the rules are in lib/install.ts).
//
// Chromium fires `beforeinstallprompt` once it decides the app can be
// installed, often before React has mounted anything, so listenForInstall()
// runs from main.tsx and holds the event until the popup or the You row
// wants it. preventDefault keeps Chrome's own install bar away: the app asks
// at its own moment, after the first meal, rather than on a first visit.

import { useSyncExternalStore } from 'react'

/** Not in TypeScript's DOM types: Chromium only. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface InstallState {
  /** An event is held and not used up yet: the Install button can work. */
  canPrompt: boolean
  /** Installed from this page just now (`appinstalled`). */
  installed: boolean
}

let held: BeforeInstallPromptEvent | null = null
let state: InstallState = { canPrompt: false, installed: false }
const listeners = new Set<() => void>()

function set(next: Partial<InstallState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export function listenForInstall() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    held = event as BeforeInstallPromptEvent
    set({ canPrompt: true })
  })
  window.addEventListener('appinstalled', () => {
    held = null
    set({ canPrompt: false, installed: true })
  })
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

/** Opens the phone's own install dialog. An event works once, so it is let go
 *  whatever the answer; Chromium may offer a fresh one later. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = held
  if (!event) return 'unavailable'
  held = null
  set({ canPrompt: false })
  await event.prompt()
  return (await event.userChoice).outcome
}

/** Opened from the home screen (or as an installed desktop app). Every
 *  display mode but `browser` means the manifest's window, and iOS reports
 *  its home screen apps through navigator.standalone instead. */
export function isStandalone(): boolean {
  const modes = ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
  if (modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches)) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}
