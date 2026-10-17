import { useEffect, useState } from 'react'
import { dismissBanner, isBannerDismissed } from '../lib/dismissals'
import { CloseIcon } from '@/ui/icons'

/** The live status notice, when the server has one set.
 *
 * Presentational: the text comes from whoever already fetched
 * `/api/announcements`, so the logged-in shell and the login page can each show
 * it without a second request.
 *
 * The role="status" wrapper is rendered unconditionally, even with no banner.
 * That is the whole point: a live region has to be in the DOM *before* its
 * content arrives, or assistive technology has nothing to observe. The banner
 * always arrives from an async fetch, so returning null until it lands — which
 * is what this component used to do — meant the notice was never announced.
 * Checked before doing this: none of the five call sites uses space-y-*, so an
 * extra always-present child cannot silently eat a sibling's margin.
 *
 * A ruled note in ink, not an amber box: DESIGN.md says a warning is ink plus
 * words, never colour alone, and the theme has no amber to give it anyway. */
export default function StatusBanner({ banner }: { banner: string | null }) {
  const [dismissed, setDismissed] = useState(false)

  // A banner that arrives (or changes) after mount has to be re-checked, or a
  // new notice would stay hidden behind the previous one's dismissal.
  useEffect(() => {
    setDismissed(banner !== null && isBannerDismissed(banner))
  }, [banner])

  return (
    <div role="status" aria-live="polite">
      {banner && !dismissed && (
        <div className="mb-4 flex items-start gap-2 border-l-2 border-ink bg-field py-1 pr-1 pl-3 text-small">
          <p className="flex-1 py-2">{banner}</p>
          <button
            type="button"
            onClick={() => {
              dismissBanner(banner)
              setDismissed(true)
            }}
            aria-label="Dismiss notice"
            className="grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:text-ink"
          >
            <CloseIcon size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
