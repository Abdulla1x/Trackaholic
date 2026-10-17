import type { ReactNode } from 'react'
import { useAnnouncements } from '../../hooks/useAnnouncements'
import Wordmark from '../shell/Wordmark'
import MovedNotice from '../MovedNotice'
import StatusBanner from '../StatusBanner'
import WarmupNotice from '../WarmupNotice'

/** The frame the four signed-out pages share (log in, sign up, forgot and
 *  reset password): the large wordmark, the live status notice (and, on the
 *  old address, the moved notice), the page's form, and the server's warm-up
 *  state, in one centred column (the 0b prototype's sign-in screen). The wordmark and the page title are centred
 *  over the form, like a front door; labels, boxes and notes keep the left
 *  edge, and the links under the button stay centred.
 *
 *  It fetches the announcements itself: an outage notice matters most here,
 *  where someone lands when the app looks broken to them, and every one of the
 *  four pages fetched it the same way. Mounting WarmupNotice is what fires the
 *  warm-up ping, so that stays in one place too.
 *
 *  No card around the form: in the Fields style a box is for things you press
 *  (DESIGN.md: Blocks and rows). */
export default function AuthFrame({ children }: { children: ReactNode }) {
  const announcements = useAnnouncements()
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-6">
      <div className="grid w-full max-w-[380px] grid-cols-[minmax(0,1fr)] gap-3.5">
        <Wordmark size="large" className="mb-2 justify-self-center" />
        <StatusBanner banner={announcements?.banner ?? null} />
        <MovedNotice />
        {children}
        <WarmupNotice />
      </div>
    </div>
  )
}

/** A labelled text box on a signed-out page. The label wraps the input, so the
 *  two are associated without an id. */
export function AuthField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-small text-ink-2">{label}</span>
      {children}
    </label>
  )
}

/** The page title: what this page is for, centred under the wordmark. The
 *  wordmark above it is branding, not a heading. */
export const AUTH_TITLE = 'text-center text-[20px] leading-tight font-bold text-balance [font-stretch:105%]'

/** A note the reader must not miss (blocked site data, an error): ink and a
 *  rule, never colour alone (DESIGN.md: the No Red Rule). */
export const AUTH_NOTE = 'border-l-2 border-ink pl-3 text-small'

/** A link in a sentence: underlined, so it is not told apart by colour alone. */
export const AUTH_LINK =
  'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'
