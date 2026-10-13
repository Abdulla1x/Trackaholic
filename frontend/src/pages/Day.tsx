import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { addDays, localIsoDate } from '../lib/dates'
import { plansLink } from '../lib/planOrigin'
import { calorieBalance, dayHeading, dayTotals, planCaption, targetIsSet, viewedDay } from '../lib/today'
import { useSettings } from '../settings/SettingsContext'
import { useLiveMessage } from '../hooks/useLiveMessage'
import type { Meal, PlanDay } from '../types'
import Block from '@/ui/block'
import { RowLink } from '@/ui/row'
import { Stat, StatGrid } from '@/ui/stat'

const n = (value: number) => Math.round(value).toLocaleString()

/** The day in detail: what the calories band opens (DESIGN.md: "Tap: opens the
 *  day in detail, with calorie plans"). The band keeps one headline; the rest
 *  of the day's numbers, and the way into calorie plans, live one tap behind
 *  it. Calorie plans have never been used on any account, so they stay here
 *  rather than on Today (0a: "one tap behind the calories hero, without more
 *  prominence").
 *
 *  No measured daily burn here: the endpoint for it has no date, so on a past
 *  day it would show today's figure under that day's name. */
export default function Day() {
  const { settings } = useSettings()
  const today = localIsoDate()
  const day = viewedDay(useParams().date ?? null, today)
  const [meals, setMeals] = useState<Meal[] | null>(null)
  const [plan, setPlan] = useState<PlanDay | null>(null)
  const [planFailed, setPlanFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)

  const load = useCallback(() => {
    setError(null)
    api
      .getMeals(day)
      .then(setMeals)
      .catch(() => setError("Couldn't load this day. Check your connection, then try again."))
    // The targets in force that day, plan included; resolved by the server,
    // as on Today. A failure falls back to the usual goals and says so.
    api
      .getPlanDay(day)
      .then((next) => {
        setPlan(next)
        setPlanFailed(false)
      })
      .catch(() => {
        setPlan(null)
        setPlanFailed(true)
      })
  }, [day])

  useEffect(load, [load])

  const goals = plan?.date === day ? plan : settings
  const eaten = dayTotals(meals ?? [])
  const balance = goals ? calorieBalance(eaten.calories, goals.calorie_goal) : null
  const caption = planCaption(plan?.date === day ? plan : null, planFailed)
  // Before a target is chosen the day is what was eaten, with nothing to
  // measure it against, and calorie plans have no target to move around.
  const hasTarget = settings ? targetIsSet(settings) : true

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar
        title={dayHeading(day, today, addDays(today, -1))}
        back={day === today ? '/' : `/?day=${day}`}
        backLabel="Back to Today"
      />

      <Block label="The day in numbers" value={meals ? `${meals.length} ${meals.length === 1 ? 'meal' : 'meals'}` : undefined}>
        {error ? (
          <p role="alert" className="border-l-2 border-ink pl-3 text-small">
            {error}{' '}
            <button type="button" onClick={load} className="font-semibold underline underline-offset-3">
              Retry
            </button>
          </p>
        ) : !meals || !goals || !settings || !balance ? (
          <div aria-hidden="true" className="grid grid-cols-2 gap-4 py-2.5">
            {[0, 1, 2, 3].map((key) => (
              <span key={key} className="h-[52px] rounded-control bg-track motion-safe:animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <StatGrid>
              <Stat label="Eaten" unit="kcal">
                {n(eaten.calories)}
              </Stat>
              {hasTarget && (
                <>
                  <Stat label="Target" unit="kcal">
                    {n(goals.calorie_goal)}
                  </Stat>
                  <Stat label={balance.over ? 'Over' : 'Left'} unit="kcal">
                    {n(balance.amount)}
                  </Stat>
                </>
              )}
              <Stat label="Protein" unit={hasTarget ? `/ ${n(goals.protein_goal)} g` : 'g'}>
                {n(eaten.protein)}
              </Stat>
              {settings.track_carbs && (
                <Stat label="Carbs" unit={hasTarget ? `/ ${n(goals.carbs_goal)} g` : 'g'}>
                  {n(eaten.carbs)}
                </Stat>
              )}
              {settings.track_fat && (
                <Stat label="Fat" unit={hasTarget ? `/ ${n(goals.fat_goal)} g` : 'g'}>
                  {n(eaten.fat)}
                </Stat>
              )}
            </StatGrid>
            {!hasTarget && <p className="text-small text-ink-2">No target yet. Once you set one, this day is measured against it.</p>}
            {hasTarget && caption && <p className="text-small text-ink-2">{caption}</p>}
            {hasTarget && (
              <Link
                to="/how-it-works/target"
                state={{ from: `/day/${day}` }}
                className="justify-self-start text-small text-ink-2 underline underline-offset-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                How your target is worked out
              </Link>
            )}
            {/* The stat above stays exact ("Over 8"); the reassurance is for a
                day past the on-target band, as on Today's band. */}
            {hasTarget && balance.over && !balance.onTarget && (
              <p className="text-small text-ink-2">Over is fine. The week evens out, or make it up below.</p>
            )}
          </>
        )}
      </Block>

      {hasTarget && (
        <Block label="Calorie plans">
          <p className="text-small text-ink-2">
            Move calories between days: plan a bigger day, or spread one that ran over.
          </p>
          <div className="divide-y divide-rule">
            <RowLink to={plansLink(day, 'planned', 'day')} label="Plan a bigger day" detail="Fund a dinner out from the days around it" />
            <RowLink to={plansLink(day, 'compensating', 'day')} label="Make up a day" detail="Move what ran over onto the next few days" />
          </div>
        </Block>
      )}
    </div>
  )
}
