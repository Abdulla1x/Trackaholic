import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { accuracySummary } from '../../lib/accuracy'
import { addDays, shortDate } from '../../lib/dates'
import { reviewHeadline, reviewLocked } from '../../lib/review'
import type { Calibration, WeeklyReview } from '../../types'
import Block from '@/ui/block'
import { RowLink } from '@/ui/row'

/** The two weekly things (0a: "then Weekly review, AI accuracy"), as rows
 *  that open their screens, each with one line of what is in it. Both are
 *  fetched here and not by the page: they are secondary, so a slow or failed
 *  answer leaves a plain row rather than holding the page back. */
export default function LookingBackBlock({ today }: { today: string }) {
  const end = addDays(today, -1)
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [accuracy, setAccuracy] = useState<Calibration | null>(null)

  useEffect(() => {
    let live = true
    api.getReview(end).then(
      (next) => live && setReview(next),
      () => undefined,
    )
    api.getCalibration().then(
      (next) => live && setAccuracy(next),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [end])

  // Until a week has anything to say, a plain "nothing yet" rather than a
  // review of nothing. reviewLocked means zero logged days, so no count.
  const reviewDetail = !review
    ? 'The seven days before today'
    : reviewLocked(review)
      ? 'Nothing logged in these seven days yet.'
      : `${shortDate(review.window_start)} to ${shortDate(review.window_end)}. ${reviewHeadline(review)}`

  return (
    <Block label="Looking back">
      <div className="divide-y divide-rule">
        <RowLink to="/progress/review" label="Weekly review" detail={reviewDetail} />
        <RowLink
          to="/progress/accuracy"
          label="AI accuracy"
          detail={accuracy ? accuracySummary(accuracy) : 'How close the estimates were'}
        />
      </div>
    </Block>
  )
}
