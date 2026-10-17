import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { shortDate } from '../../lib/dates'
import { hideReview, reviewHidden } from '../../lib/dismissals'
import { reviewHeadline } from '../../lib/review'
import type { WeeklyReview } from '../../types'
import { Button } from '@/ui/button'
import Block from '@/ui/block'
import { CloseIcon } from '@/ui/icons'
import { useToast } from '@/ui/toast'

/** The weekly review, brought up on Today (0a: "Review appears as a card on
 *  review day"). One sentence from the review's own checks, and the way in.
 *  The week is the last full Monday to Sunday, ending on `end`, and the link
 *  opens the review on that same week whatever day it is pressed.
 *  If the review can't be read, the card still offers the way in rather than
 *  inventing a summary.
 *
 *  It shows from the first open of the week until it is closed or the review
 *  is opened (decided 2026-10-13 from a prototype, after a phone test found
 *  the Mondays-only card could not be put away). Either one hides it on this
 *  device until the next week.
 *
 *  A week with nothing logged has nothing to review, so there is no card:
 *  otherwise a new account's first week opens with "Your week is in. No
 *  meals logged last week". Nothing is drawn until the review answers, so the
 *  card never appears only to vanish. */
export default function ReviewCard({ end }: { end: string }) {
  const toast = useToast()
  const [hidden, setHidden] = useState(() => reviewHidden(end))
  // undefined while asking, null when the review could not be read.
  const [review, setReview] = useState<WeeklyReview | null | undefined>(undefined)

  useEffect(() => {
    // Hidden for this week: no card, so no request for one.
    if (hidden) return
    let live = true
    api
      .getReview(end)
      .then((next) => live && setReview(next))
      .catch(() => live && setReview(null))
    return () => {
      live = false
    }
  }, [end, hidden])

  if (hidden || review === undefined || review?.logged_days === 0) return null

  function close() {
    hideReview(end)
    setHidden(true)
    // The card going is the first sign; this says where the review went.
    toast.show({ text: 'Hidden until next week. The review is under Progress.' })
  }

  return (
    <Block
      label="Weekly review"
      value={
        <span className="inline-flex items-center gap-1">
          {review && `${shortDate(review.window_start)} to ${shortDate(review.window_end)}`}
          <Button variant="ghost" size="icon" className="-my-2.5 -mr-2 size-9 label:my-0 label:mr-0" onClick={close} aria-label="Hide until next week">
            <CloseIcon size={18} aria-hidden />
          </Button>
        </span>
      }
    >
      <p>
        <b className="font-semibold">Your week is in.</b> {review ? reviewHeadline(review) : null}
      </p>
      <div>
        <Button asChild>
          {/* Opening it counts as seeing it. Marked here as well as on the
              review page, so Back doesn't land on a card still asking. */}
          <Link to={`/progress/review?end=${end}`} onClick={() => hideReview(end)}>
            Open the review
          </Link>
        </Button>
      </div>
    </Block>
  )
}
