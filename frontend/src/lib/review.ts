import type { ReviewCheck, WeeklyReview } from '../types.ts'
import { addDays, localIsoDate, parseIsoDate } from './dates.ts'

/** The end of the last full Monday-to-Sunday week before `today`: the most
 *  recent Sunday that has already finished. Monday gives yesterday, and a
 *  Sunday gives the Sunday a week back, because today's week is not over.
 *  Today's review card covers this week, all week (decided 2026-10-13 from a
 *  prototype, replacing the Mondays-only card of 2026-10-10). */
export function lastWeekEnd(today: string): string {
  const weekday = parseIsoDate(today).getDay()
  return addDays(today, -(weekday === 0 ? 7 : weekday))
}

/** The week the review page shows, from its `?end=` parameter: a real date
 *  no later than yesterday, which is how Today's card opens the same Mon-Sun
 *  week it summarised. Anything else (none, junk, today, the future) falls
 *  back to yesterday, the page's own "last seven full days". */
export function reviewEndFrom(param: string | null, today: string): string {
  const yesterday = addDays(today, -1)
  if (param === null || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return yesterday
  // 2026-02-30 matches the pattern but rolls over to March: not a real date.
  if (localIsoDate(parseIsoDate(param)) !== param) return yesterday
  return param <= yesterday ? param : yesterday
}

/** One plain sentence for the card, from the review's own checks. Nothing to
 *  fix gets the wry line (DESIGN.md: Voice); anything else just counts, and
 *  the review page says what and why. */
export function reviewHeadline(review: WeeklyReview): string {
  if (review.logged_days === 0) return 'No meals logged last week, so there is nothing to review yet.'
  const judged = review.checks.filter((check) => check.status === 'on_track' || check.status === 'off_track')
  const off = judged.filter((check) => check.status === 'off_track').length
  const days = `${review.logged_days} of 7 days logged`
  if (judged.length === 0) return `${days}.`
  if (off === 0) return `${days}. Nothing to fix this week. Carry on.`
  return `${days}. ${off} of ${judged.length} ${judged.length === 1 ? 'check is' : 'checks are'} off target.`
}

/** What each check is called on screen.
 *
 *  Presentation only: the server owns every sentence, and this owns the
 *  heading above it. A key missing here falls back to the key itself, so a
 *  server that grows a new check renders it with a plain heading rather than
 *  crashing a page that is otherwise fine. */
const LABELS: Record<string, string> = {
  logging: 'How much you logged',
  intake: 'Calories',
  protein: 'Protein',
  weight: 'Weight',
  targets: 'Your daily burn',
  water: 'Water',
  steps: 'Steps',
  calibration: "The AI's estimates",
}

export function checkLabel(check: ReviewCheck): string {
  return LABELS[check.key] ?? check.key
}

/** The word beside each check. "Off target", not "failed": the number is off
 *  a target the user set, which is not a judgement about them. A note has no
 *  target, so no word. */
export function checkStatus(check: ReviewCheck): string | null {
  switch (check.status) {
    case 'on_track':
      return 'On track'
    case 'off_track':
      return 'Off target'
    case 'unknown':
      return 'Not enough data'
    case 'note':
      return null
  }
}

/** The scannable number, or null when the check is a sentence and nothing
 *  more. Every figure also appears in the check's own sentence; the figure is
 *  what makes the page readable at a glance. */
export function checkFigure(check: ReviewCheck): string | null {
  if (check.value === null) return null
  switch (check.unit) {
    case 'days':
      return `${Math.round(check.value)} of ${Math.round(check.target ?? 0)}`
    case 'kg/week':
      // Two decimals: a rate rounded to one is mostly zeroes, and the
      // difference between 0.35 and 0.5 kg/week is the whole comparison.
      return `${check.value > 0 ? '+' : ''}${check.value.toFixed(2)} kg/wk`
    case '%':
      return `${check.value > 0 ? '+' : ''}${Math.round(check.value)}%`
    default:
      return `${Math.round(check.value).toLocaleString()} ${check.unit}`
  }
}

/** True while the week has no meals logged at all: Progress then shows how
 *  much of a week is logged rather than a review of nothing. Not "every check
 *  unknown": the logging check always has an answer, and at 0 of 7 days that
 *  answer is "off target", so a brand-new account would never count as
 *  locked. */
export function reviewLocked(review: WeeklyReview): boolean {
  return review.logged_days === 0
}
