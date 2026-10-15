import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { addDays, localIsoDate, shortDate } from '../lib/dates'
import { hideReview } from '../lib/dismissals'
import { checkFigure, checkLabel, checkStatus, lastWeekEnd, reviewEndFrom, reviewStartsLine } from '../lib/review'
import { useLiveMessage } from '../hooks/useLiveMessage'
import type { ReviewCheck, WeeklyReview as Review } from '../types'
import Block, { LABEL_BOX, LABEL_TITLE } from '@/ui/block'
import { Button } from '@/ui/button'
import Explainer from '@/ui/explainer'
import Retry from '@/ui/retry'
import { cn } from '@/lib/utils'

/** The weekly review, in Progress (0a: a periodic output, not a tab). The
 *  seven days before today, or the week Today's card names in `?end=`. Never
 *  today: it is only half logged, and averaging a day that still has dinner
 *  to come would flatter every week.
 *
 *  Every number is worked out on the server from what was logged. The AI is
 *  only ever asked to put those numbers into words, on request. */
export default function WeeklyReview() {
  // Yesterday by the BROWSER's clock, not the server's: no timezone is stored
  // for anyone and the server's today is UTC, so letting it choose would give
  // the wrong week to everyone hours off UTC. Today's review card passes
  // `?end=` instead, the Sunday closing the week it summarised, so the page
  // opens on that same Monday-to-Sunday week on any day of the next one.
  const [searchParams] = useSearchParams()
  const today = localIsoDate()
  const end = reviewEndFrom(searchParams.get('end'), today)
  const upToYesterday = end === addDays(today, -1)

  // Seeing last week's review here counts as seeing it on Today too, however
  // it was reached, so Today's card stays away until the next week.
  useEffect(() => {
    if (end === lastWeekEnd(today)) hideReview(end)
  }, [end, today])
  const [review, setReview] = useState<Review | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useLiveMessage(failed ? "Couldn't load your review." : null)

  useEffect(() => {
    let live = true
    setFailed(false)
    api.getReview(end).then(
      (next) => live && setReview(next),
      () => live && setFailed(true),
    )
    return () => {
      live = false
    }
  }, [end, attempt])

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="Weekly review" back="/progress" backLabel="Back to Progress" />

      <p className="py-3 text-small text-ink-2">
        {review
          ? `${shortDate(review.window_start)} to ${shortDate(review.window_end)}. `
          : upToYesterday
            ? 'Your last seven full days. '
            : `The week to ${shortDate(end)}. `}
        {/* Only true of a week that runs up to yesterday: on a Wednesday, last
            Mon-Sun from Today's card has nothing to say about today. */}
        {upToYesterday && "Today is left out until it's over."}
      </p>

      {failed ? (
        // No role: useLiveMessage above already speaks the failure.
        <Retry
          text="Couldn't load your review. Check your connection, then try again."
          onRetry={() => setAttempt((now) => now + 1)}
        />
      ) : !review ? (
        <p role="status" className="py-6 text-center text-small text-ink-2">
          Working it out…
        </p>
      ) : reviewStartsLine(review) ? (
        // A brand-new account: say when the review starts instead of judging
        // a week before anything was logged.
        <p className="border-t border-rule py-4">{reviewStartsLine(review)}</p>
      ) : (
        <>
          <ul className="border-t border-rule">
            {review.checks.map((check, index) => (
              <Check key={check.key} check={check} turn={index} />
            ))}
          </ul>
          {/* Nothing logged, nothing to word: the server refuses it too. */}
          {review.logged_days > 0 && <InWords end={end} />}
        </>
      )}
    </div>
  )
}

/** One check: its name and word, the figure, and the server's sentence. The
 *  checks arrive one after another, 80 ms apart (DESIGN.md Motion); under
 *  reduced motion they fade in together. */
function Check({ check, turn }: { check: ReviewCheck; turn: number }) {
  const status = checkStatus(check)
  const figure = checkFigure(check)
  return (
    <li
      className={`grid animate-rise gap-1 border-b border-rule py-3.5 [animation-delay:var(--turn)] motion-reduce:[animation-delay:0ms] ${LABEL_BOX}`}
      style={{ '--turn': `${turn * 80}ms` } as CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-field-label text-ink-2 ${LABEL_TITLE}`}>{checkLabel(check)}</h2>
        {status && (
          <span className={cn('text-small', check.status === 'on_track' ? 'font-semibold text-ink' : 'text-ink-2')}>
            {status}
          </span>
        )}
      </div>
      {figure && <p className="text-field-number tabular-nums">{figure}</p>}
      <p className="text-small text-ink-2">{check.detail || check.unavailable_reason}</p>
    </li>
  )
}

/** "Put this into words": the AI reads the figures above back as prose. It is
 *  given those figures and nothing else, and may not add a number or advice. */
function InWords({ end }: { end: string }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)

  const write = async () => {
    setWriting(true)
    setError(null)
    try {
      // The same week the figures were fetched for, or the words would
      // describe a different week from the numbers they sit under.
      setSummary((await api.phraseReview(end)).summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Check your connection, then try again.")
    } finally {
      setWriting(false)
    }
  }

  return (
    <Block label="In words">
      {summary ? (
        <>
          {/* Paragraph by paragraph, so the model's own breaks survive. Plain
              text, never markup. */}
          {summary.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
          <p className="text-small text-ink-2">
            Worded by the AI; the numbers are the ones above.
          </p>
        </>
      ) : (
        <>
          <p className="text-small text-ink-2">
            The AI can put the figures above into a couple of paragraphs, with no new numbers or advice.
          </p>
          <div>
            <Button onClick={write} disabled={writing}>
              {writing ? 'Writing…' : 'Put this into words'}
            </Button>
          </div>
          <Explainer>
            It is given these figures and nothing else, and every number stays on this page, where it can be checked.
            It uses one of a small daily allowance, separate from your meal estimates, and the wording is not saved:
            reopening the review shows the figures again.
          </Explainer>
        </>
      )}
      {error && (
        <p role="alert" className="border-l-2 border-ink pl-3 text-small">
          {error}
        </p>
      )}
    </Block>
  )
}
