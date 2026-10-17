import { useState, useSyncExternalStore } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { CloseIcon } from '@/ui/icons'
import { DURATION, SPRING } from '@/lib/motion'
import { isUpdateReady, reloadIntoUpdate, subscribeToUpdate } from '@/lib/swUpdate'

/** "Update ready", once a new version of the app has downloaded (swUpdate.ts).
 *
 * The toast's look (an ink ground, DESIGN.md Components -> Toasts) but not a
 * toast: it stays until it is used or dismissed, because the update is only
 * worth offering while it is waiting. Dismissing is safe, the new version
 * still takes over the next time the app is fully closed.
 *
 * At the top of the screen, where nothing else is pinned. At the bottom it
 * would sit on the tab bar's Log button, Settings' Save bar and every toast.
 *
 * Mounted once in App, outside the router, so it shows on the sign-in screens
 * too. The role="status" wrapper is always in the page, empty until there is
 * something to say: a live region inserted with its message is not reliably
 * read out (the same rule as the toast and StatusBanner). */
export default function UpdateReadyBar() {
  const ready = useSyncExternalStore(subscribeToUpdate, isUpdateReady)
  const [dismissed, setDismissed] = useState(false)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+12px)] right-3 left-3 z-50 desk:top-6 desk:right-6 desk:left-auto desk:w-[400px]"
    >
      <AnimatePresence>
        {ready && !dismissed && (
          <m.div
            className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-ink py-2.5 pr-2.5 pl-3.5 text-ground label:rounded-none label:text-label"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0, transition: SPRING.toast }}
            exit={{ opacity: 0, y: -8, transition: { duration: DURATION.fast } }}
          >
            <p className="flex-1 text-[14px]">A new version is ready.</p>
            <button
              type="button"
              onClick={reloadIntoUpdate}
              className="inline-flex h-[38px] items-center rounded-control border-[1.5px] border-ground px-3 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Not now"
              className="grid size-[38px] place-items-center rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ground"
            >
              <CloseIcon size={18} aria-hidden />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
