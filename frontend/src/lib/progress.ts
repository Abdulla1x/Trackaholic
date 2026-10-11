import { addDays, dayRange, daysBetween } from './dates.ts'

/** Progress's one range control (0a, UA-4/UA-5), kept apart from the page so
 *  its rules can be tested without a browser. */

export const RANGES = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '365', label: '1 year', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const

export type Range = (typeof RANGES)[number]
export type RangeKey = Range['key']

/** Where this device last left the range: a per-device convenience, so the
 *  page reopens where it was. The address still wins (a link, back, reload). */
export const REMEMBERED_RANGE_KEY = 'trackaholic_progress_range'

/** Where the page opens when nothing says otherwise (decided 2026-10-10). */
export const DEFAULT_RANGE: RangeKey = '30'

/** The range from the address, else the one this device last used, else the
 *  default. Resolved by value, never by position in RANGES: a default taken by
 *  index moved the last time a range was added at the front. */
export function resolveRange(fromAddress: string | null, remembered: string | null): Range {
  const byKey = (key: string | null) => RANGES.find((range) => range.key === key)
  // Never undefined: DEFAULT_RANGE is one of RANGES' keys, and the type says so.
  return byKey(fromAddress) ?? byKey(remembered) ?? (byKey(DEFAULT_RANGE) as Range)
}

/** The days the food charts and averages cover. They end YESTERDAY: today is
 *  still being logged, and a half-logged day drawn as a finished one is the
 *  cliff UA-4 found at the end of every series. `start` is null for All, which
 *  the server reads as "from the first meal". */
export function foodWindow(days: number | null, today: string): { start: string | null; end: string } {
  const end = addDays(today, -1)
  return { start: days === null ? null : addDays(end, -(days - 1)), end }
}

/** Every date from `start` to `end`, oldest first, so a day with nothing
 *  logged is a gap in the chart rather than a missing column that slides the
 *  rest along. */
export function everyDay(start: string, end: string): string[] {
  return dayRange(start, daysBetween(start, end) + 1)
}
