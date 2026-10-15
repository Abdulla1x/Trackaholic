import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  hasEverSeenAnnouncements,
  markAnnouncementsSeen,
  seenAnnouncementIds,
} from '../lib/dismissals'
import type { Announcement } from '../types'
import { NoteList } from './AnnouncementBody'
import { Button } from '@/ui/button'
import Sheet from '@/ui/sheet'
import { CONTACT_EMAIL } from '../lib/contact'

// Rolling cap, and it has to stay rolling: every session that ships adds a note,
// so an uncapped modal only ever grows. Measured before capping -- a fresh
// signup got all 18 notes at 11,106px of content inside a 661px window, roughly
// seventeen screens, over a page it also blocked every click on.
const MAX_MODAL_NOTES = 3

type View =
  | { kind: 'hidden' }
  | { kind: 'notes'; shown: Announcement[]; pending: string[]; remaining: number }

/** "What's new", shown once per release note per device.
 *
 * Dismissal is per-id rather than a single "last seen" marker so that adding an
 * older-dated note, or shipping two at once, can't silently skip one.
 *
 * Drawn as the one-time popup (DESIGN.md: Sheets and the one-time popup): a
 * bottom sheet on phones, a 440px dialog in the middle on desktop. */
export default function AnnouncementsModal({
  items,
  hold = false,
  onShownChange,
}: {
  items: Announcement[]
  /** True while the account has not chosen a target: someone getting started
   *  sees no release notes. Nothing is marked seen meanwhile, so a note
   *  published in that time still shows once they are set up. */
  hold?: boolean
  /** Told when the notes open and close, so a popup waiting behind them
   *  opens only after. */
  onShownChange?: (shown: boolean) => void
}) {
  const [view, setView] = useState<View>({ kind: 'hidden' })

  useEffect(() => {
    if (items.length === 0 || hold) return

    // First run on this device. Every note is marked seen, silently: the
    // backlog is history this account was not present for, and a changelog is
    // the wrong first thing to meet. It used to open a "Welcome" view saying
    // so; a brand-new user now meets no popup at all (decided 2026-10-11).
    // Capping the *display* while leaving the rest unseen would be worse than
    // not capping -- the next reload would serve the next three, and the one
    // after that the next three.
    if (!hasEverSeenAnnouncements()) {
      markAnnouncementsSeen(items.map((item) => item.id))
      return
    }

    const seen = seenAnnouncementIds()
    const unseen = items.filter((item) => !seen.includes(item.id))
    if (unseen.length === 0) {
      setView({ kind: 'hidden' })
      return
    }
    onShownChange?.(true)
    setView({
      kind: 'notes',
      shown: unseen.slice(0, MAX_MODAL_NOTES),
      pending: unseen.map((item) => item.id),
      remaining: Math.max(0, unseen.length - MAX_MODAL_NOTES),
    })
  }, [items, hold, onShownChange])

  const close = () => {
    // Every unseen id, not only the ones displayed. Marking just the shown three
    // is exactly what turns a cap into a dismiss-three-reload-repeat gauntlet.
    // Nothing is lost by marking the rest: /whats-new keeps the full list.
    if (view.kind === 'notes') markAnnouncementsSeen(view.pending)
    setView({ kind: 'hidden' })
    onShownChange?.(false)
  }

  const open = view.kind === 'notes'
  const shown = open ? view.shown : []
  const remaining = open ? view.remaining : 0

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()} title="What's new" desk="center">
      <div className="grid gap-4 py-2">
        <NoteList heading="h3" items={shown} />
        {remaining > 0 && (
          <p className="text-center text-small text-ink-2">
            and {remaining} older {remaining === 1 ? 'note' : 'notes'} in{' '}
            <Link to="/whats-new" onClick={close} className={LINK}>
              What's new
            </Link>
          </p>
        )}
        <Button onClick={close} className="w-full">
          Got it
        </Button>
        <p className="text-center text-small text-ink-2">
          Found a bug or want something?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </Sheet>
  )
}

const LINK =
  'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'
