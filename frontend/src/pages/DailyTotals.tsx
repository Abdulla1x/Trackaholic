import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { localIsoDate, shortDate } from '../lib/dates'
import { foodWindow, REMEMBERED_RANGE_KEY, resolveRange } from '../lib/progress'
import { readLocal } from '../lib/storage'
import { useSettings } from '../settings/SettingsContext'
import { useLiveMessage } from '../hooks/useLiveMessage'
import type { AnalyticsSummary, DayTotals } from '../types'

const n = (value: number) => Math.round(value).toLocaleString()

/** Every logged day in Progress's range, newest first, one row each: the date
 *  and its calories, the macros under them. It replaces the old 30-row table,
 *  which wrapped each date onto two lines and pushed the fat column off a
 *  phone screen behind a sideways scroll nothing pointed to (UA-7). A row
 *  wraps instead of scrolling, so nothing is ever off the side.
 *
 *  The range is the page's own (address, else this device's last choice), and
 *  like every food figure in Progress it ends yesterday. */
export default function DailyTotals() {
  const { settings } = useSettings()
  const [params] = useSearchParams()
  const range = resolveRange(params.get('range'), readLocal(REMEMBERED_RANGE_KEY))
  const span = foodWindow(range.days, localIsoDate())
  const [food, setFood] = useState<AnalyticsSummary | null>(null)
  const [failed, setFailed] = useState(false)
  useLiveMessage(failed ? "Couldn't load your daily totals." : null)

  const load = useCallback(() => {
    setFailed(false)
    api.getAnalytics(span.start ?? undefined, span.end).then(setFood, () => setFailed(true))
  }, [span.start, span.end])
  useEffect(load, [load])

  const days = food ? [...food.days].reverse() : []
  const within =
    range.days === null ? 'Every day you logged, up to yesterday.' : `The ${range.days} days before today.`

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="Daily totals" back={`/progress?range=${range.key}`} backLabel="Back to Progress" />

      <p className="py-3 text-small text-ink-2">
        {within} Today joins tomorrow, once it’s over.
        {food && food.logged_days > 0 && range.days !== null && ` ${food.logged_days} of ${range.days} days logged.`}
      </p>

      {failed && (
        <p role="alert" className="border-l-2 border-ink pl-3 text-small">
          Couldn't load your daily totals. Check your connection, then try again.{' '}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-3">
            Retry
          </button>
        </p>
      )}

      {!food && !failed && (
        <p role="status" className="py-6 text-center text-small text-ink-2">
          Loading your daily totals…
        </p>
      )}

      {food && days.length === 0 && (
        <p className="py-6 text-center text-small text-ink-2">Nothing logged in these days.</p>
      )}

      {days.length > 0 && settings && (
        <ul className="divide-y divide-rule border-y border-rule">
          {days.map((day) => (
            <li key={day.date} className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 py-2">
              <span className="font-semibold">{shortDate(day.date)}</span>
              <span className="text-row-number tabular-nums">
                {n(day.calories)} <small className="text-small font-normal text-ink-2">kcal</small>
              </span>
              <span className="col-span-2 text-small text-ink-2">
                {macros(day, settings.track_carbs, settings.track_fat)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "150 g protein · 210 g carbs · 60 g fat". Carbs and fat only when tracked,
 *  and only when that day recorded them: a gap is not a zero. */
function macros(day: DayTotals, carbs: boolean, fat: boolean): string {
  const parts = [`${n(day.protein)} g protein`]
  if (carbs && day.carbs !== null) parts.push(`${n(day.carbs)} g carbs`)
  if (fat && day.fat !== null) parts.push(`${n(day.fat)} g fat`)
  return parts.join(' · ')
}
