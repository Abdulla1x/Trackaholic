/** Calorie plans opened from a day, and the way back to it.
 *
 *  Plans live under You, but a day's numbers open them too: Day in detail's
 *  "Plan a bigger day" and "Make up a day", and Today's "Spread it". Arriving
 *  that way, Back, a saved plan and Cancel all return to the day the plan was
 *  about, not to You, which the planner was only borrowed from.
 *
 *  Where it was opened travels in the address as `from`, beside the `plan` day
 *  and `kind` the screen already reads: a search param rather than router
 *  state, for the reason Plans gives (state is lost on a reload). Only the two
 *  known values are honoured, and the day must look like a date, so the
 *  address can never send Back somewhere arbitrary. */

import type { PlanKind } from '../types.ts'

export type PlanFrom = 'day' | 'today'

export interface PlanOrigin {
  to: string
  label: string
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** The address of the planner, opened on `kind`'s form for `day`. */
export function plansLink(day: string, kind: PlanKind, from: PlanFrom): string {
  return `/you/plans?plan=${day}&kind=${kind}&from=${from}`
}

/** Where to return to, or null for the planner's own home under You. */
export function planOrigin(from: string | null, day: string | null, today: string): PlanOrigin | null {
  if (!day || !ISO_DAY.test(day)) return null
  if (from === 'day') return { to: `/day/${day}`, label: 'Back to the day' }
  // Today shows past days through ?day=, the same address Day's own back uses.
  if (from === 'today') return { to: day === today ? '/' : `/?day=${day}`, label: 'Back to Today' }
  return null
}
