import type { GoalProjection, WeightTrend, WeightTrendPoint } from '../types.ts'
import { addDays, daysBetween, localIsoDate, parseIsoDate } from './dates.ts'
import { formatRate, formatWeight, unitLabel, type WeightUnit } from './units.ts'

/** The weight trend's arithmetic and wording, kept apart from the pages so it
 *  can be tested without a browser. Moved here from the old Weight page when
 *  Progress took the chart over. */

// How much history is FETCHED -- the endpoint's own maximum, and deliberately
// not the range the chart happens to be showing.
//
// ⚠️ `days` on GET /api/weights/trend decides what the numbers are computed
// FROM, not just what is drawn. The EWMA seeds at the first weigh-in it sees
// and the rate needs seven points inside 28 days. Wiring a range control to it
// would move the trend weight, the weekly rate and the projected date every
// time someone zoomed the chart, and a short enough range would blank the last
// two outright. So the fetch is fixed and the range slices what came back.
// Choosing which points to draw is a display decision; recomputing a number
// client-side is not, and this stays on the right side of that line.
export const TREND_FETCH_DAYS = 1825

/** Weigh-ins before the trend is drawn at all (DESIGN.md Voice: "Seven
 *  weigh-ins. You've earned a trend line."). The same seven the server needs
 *  for a weekly rate, so the chart never appears without the numbers beside
 *  it having something to say. */
export const TREND_UNLOCK = 7

/** The points from `start` on, or all of them for no start. Display only. */
export function pointsFrom(points: readonly WeightTrendPoint[], start: string | null): WeightTrendPoint[] {
  return start === null ? [...points] : points.filter((point) => point.date >= start)
}

// What the page uses when the response has no `projection` at all.
//
// Not defensive programming for its own sake, and not a type the API can
// return: the frontend ships from Vercel and the API from Render,
// independently, so for a minute after any release a page runs against a
// backend that predates the field. Reading through `trend.projection`
// unguarded in that gap throws and replaces the whole page with the error
// boundary. AILatencyCard in Admin.tsx carries the same `??` for the same
// reason, and its comment records that the bug was caught exactly that way
// rather than reasoned about.
export const NO_PROJECTION: GoalProjection = {
  status: 'no_goal',
  goal_weight_kg: null,
  remaining_kg: null,
  weeks: null,
  reach_date: null,
  from_date: null,
}

/** A date far enough ahead that the year matters. Short dates drop it; a
 *  projection is the one that can land in another year. */
export const longDate = (iso: string, locale?: string) =>
  parseIsoDate(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/** The projection, as a sentence. Assembled here rather than server-side
 *  because it has to name a weight in the reader's own unit and a date in
 *  their own locale, and the server knows neither.
 *
 *  Every branch is driven by `status`, never by which fields are null: the
 *  server decides what it is willing to claim, and this only says it.
 *
 *  `today` and `locale` exist for the tests; the app passes neither. */
export function projectionCaption(
  trend: WeightTrend,
  unit: WeightUnit,
  today: string = localIsoDate(),
  locale?: string,
): string {
  const goal = trend.projection ?? NO_PROJECTION
  const rate = trend.weekly_rate_kg
  const label = unitLabel(unit)
  // Signed towards the goal, so the sign is the direction and the magnitude is
  // the gap. A rate conversion works on a difference for the same reason it
  // works on a weight -- both scales are linear through zero.
  const gap =
    goal.remaining_kg === null
      ? ''
      : `${formatWeight(Math.abs(goal.remaining_kg), unit)} ${label} ` +
        `${goal.remaining_kg < 0 ? 'to lose' : 'to gain'}`

  switch (goal.status) {
    case 'no_goal':
      return "Set a goal weight in Settings and we'll work out when you would reach it."
    case 'reached':
      return goal.from_date === null
        ? 'You are there.'
        : `You were there at your weigh-in on ${longDate(goal.from_date, locale)}.`
    case 'no_rate':
      return 'Needs at least 7 weigh-ins in the last 28 days before a date can be worked out.'
    case 'stale':
      return goal.from_date === null
        ? 'No recent weigh-ins to project from.'
        : `Your last weigh-in was ${daysBetween(goal.from_date, today)} days ago, so there is no current rate to project from.`
    case 'holding':
      return `${gap}, but your weight is holding steady, so there is no date to give.`
    case 'moving_away':
      return `${gap}, and the trend is currently going the other way.`
    case 'too_far':
      return `${gap}. At your current rate that is more than two years out, so we will not name a date.`
    case 'on_course':
      // Both are always set alongside this status. Guarded anyway because the
      // alternative to a fallback here is longDate('') throwing, which takes
      // the page down rather than degrading the sentence.
      return goal.reach_date === null || rate === null
        ? `${gap}.`
        : `${gap}. At your measured ${formatRate(rate, unit)} ${label}/week, around ${longDate(goal.reach_date, locale)}.`
  }
}

/** The first day a range shows weigh-ins from: today counts (a weigh-in made
 *  this morning is real), so seven days are today and the six before it. */
export function weightRangeStart(days: number | null, today: string): string | null {
  return days === null ? null : addDays(today, -(days - 1))
}
