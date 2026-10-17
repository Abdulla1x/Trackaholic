import { registerSW } from 'virtual:pwa-register'
import { CHECK_EVERY_MS, shouldCheckForUpdate } from './updateCheck'

/** The service worker, and whether a new version of the app is waiting.
 *
 * The worker is registered in "prompt" mode: a new version downloads in the
 * background and then waits instead of taking over. Taking over means a
 * reload, and a reload nobody asked for can throw away a half-typed meal. So
 * the app says "Update ready" (UpdateReadyBar) and reloads when the user
 * taps it. Left alone, the new version takes over the next time every window
 * of the app has been closed, as before.
 *
 * A module-level store rather than React state, because registration happens
 * in main.tsx before React renders anything. The bar reads it through
 * useSyncExternalStore. */

let updateReady = false
let updateServiceWorker: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()

export function subscribeToUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isUpdateReady(): boolean {
  return updateReady
}

/** Tells the waiting version to take over. The page reloads as soon as it
 *  has, in every open window of the app, not just this one. */
export function reloadIntoUpdate(): void {
  void updateServiceWorker?.()
}

export function startServiceWorker(): void {
  updateServiceWorker = registerSW({
    onNeedRefresh() {
      updateReady = true
      listeners.forEach((listener) => listener())
    },
    onRegisteredSW(swUrl, registration) {
      if (registration) checkForUpdates(swUrl, registration)
    },
  })
}

function checkForUpdates(swUrl: string, registration: ServiceWorkerRegistration): void {
  // Registering has just fetched sw.js, so that counts as the first check.
  let lastCheckAt = Date.now()

  const check = async () => {
    const now = Date.now()
    const due = shouldCheckForUpdate({
      now,
      lastCheckAt,
      online: navigator.onLine,
      installing: registration.installing !== null,
    })
    if (!due) return
    lastCheckAt = now
    // Fetch sw.js first and only update on a 200, as vite-plugin-pwa's docs
    // do: update() rejects when the server can't be reached, and a failed
    // check should stay quiet. The next one tries again.
    try {
      const response = await fetch(swUrl, {
        cache: 'no-store',
        headers: { cache: 'no-store', 'cache-control': 'no-cache' },
      })
      if (response.status === 200) await registration.update()
    } catch {
      // Offline or the server is down.
    }
  }

  setInterval(() => void check(), CHECK_EVERY_MS)
  // Coming back to the foreground: on a phone, the usual way to "open" an
  // installed app that was never really closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}
