import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { dayDate } from '../../lib/dates'
import { plansLink } from '../../lib/planOrigin'
import { calorieBalance, type DayTotals } from '../../lib/today'
import { NextIcon } from '@/ui/icons'
import CountUp from '@/ui/count-up'
import RollingNumber from '@/ui/rolling-number'
import { cn } from '@/lib/utils'
import type { BandTargets } from './CaloriesBand'

const n = (value: number) => Math.round(value).toLocaleString()

/** The thick rules that divide a nutrition label: 10px under the title and
 *  before the fine print, 5px between the calories and the macros. */
function Rule({ heavy = false }: { heavy?: boolean }) {
  return <span aria-hidden="true" className={cn('block bg-ink', heavy ? '-mx-1 my-1 h-2.5' : 'my-0.5 h-[5px]')} />
}

/** One line of the label: a name at the left, its amount at the right, over
 *  a hairline unless it follows a thick rule (`first`). */
function Line({
  children,
  value,
  first = false,
  indent = false,
  big = false,
}: {
  children: ReactNode
  value: ReactNode
  first?: boolean
  indent?: boolean
  big?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2.5 py-1 text-[15px]',
        !first && 'border-t border-ink',
        indent && 'pl-4',
        big && 'pt-0.5 pb-1 text-[22px] font-black',
      )}
    >
      <span className="min-w-0">{children}</span>
      <span className={cn('shrink-0 text-right', big && 'text-[38px] leading-none tracking-[-0.02em]')}>{value}</span>
    </div>
  )
}

/** Today's calories in the Label style: the nutrition-label object, in place
 *  of the calories band (0b's look-b, as drawn on the 3a prototype). It
 *  shows what the band shows, as a label reads: the title and date, the
 *  calories left as the big line, what was eaten and the target indented
 *  under it, then protein (and carbs and fat when tracked) "of" their
 *  targets, and the fine print.
 *
 *  Within 2% of the target the big line reads "On target", the band's rule;
 *  past it, "Calories over" with the band's calm "Spread it" line in the
 *  fine print (the No Red and Never Punish rules hold here too). Like the
 *  band, the whole label opens the day in detail.
 *
 *  Before the account has a target, neither prototype drew it: this is
 *  "Calories" with what was eaten, the macro amounts with nothing to measure
 *  them against, and "No target yet" in the fine print. */
export default function NutritionLabel({
  day,
  isToday,
  eaten,
  targets,
  targetSet,
  firstTarget = false,
  caption,
  trackCarbs,
  trackFat,
}: {
  day: string
  isToday: boolean
  eaten: DayTotals
  targets: BandTargets
  targetSet: boolean
  firstTarget?: boolean
  caption?: string
  trackCarbs: boolean
  trackFat: boolean
}) {
  const balance = calorieBalance(eaten.calories, targets.calorie_goal)
  const onTarget = targetSet && balance.onTarget
  const over = targetSet && balance.over && !onTarget
  const date = dayDate(day)

  const macro = (name: string, value: number, goal: number, first = false) => (
    <Line first={first} value={targetSet ? `of ${n(goal)} g` : ''}>
      <b className="font-extrabold">{name}</b> <RollingNumber value={value} /> g
    </Line>
  )

  return (
    <section aria-label="Calories" className="relative grid border-2 border-ink bg-label px-3 pt-2 pb-2.5 text-ink">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[40px] leading-none font-black tracking-[-0.03em] desk:text-[56px]">
          {isToday ? 'Today' : date}
        </h2>
        {/* Stretched over the whole label, as on the band: one big target
            with one short name. */}
        <Link
          to={`/day/${day}`}
          className="mt-1 flex shrink-0 items-center gap-0.5 text-[13px] font-bold after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
        >
          Day in detail
          <NextIcon size={14} aria-hidden="true" />
        </Link>
      </div>
      {isToday && <p className="pt-0.5 pb-1 text-[13.5px]">{date}</p>}
      <Rule heavy />

      {!targetSet ? (
        <Line first big value={<RollingNumber value={eaten.calories} />}>
          Calories
        </Line>
      ) : onTarget ? (
        <>
          <Line first big value="On target">
            Calories
          </Line>
          <Line first indent value={<RollingNumber value={eaten.calories} />}>
            {isToday ? 'Eaten so far' : 'Eaten'}
          </Line>
          <Line indent value={n(targets.calorie_goal)}>
            Target
          </Line>
        </>
      ) : (
        <>
          <Line
            first
            big
            value={firstTarget ? <CountUp value={balance.amount} /> : <RollingNumber value={balance.amount} />}
          >
            {over ? 'Calories over' : 'Calories left'}
          </Line>
          <Line first indent value={<RollingNumber value={eaten.calories} />}>
            {isToday ? 'Eaten so far' : 'Eaten'}
          </Line>
          <Line indent value={n(targets.calorie_goal)}>
            Target
          </Line>
        </>
      )}

      <Rule />
      {macro('Protein', eaten.protein, targets.protein_goal, true)}
      {trackCarbs && macro('Carbohydrate', eaten.carbs, targets.carbs_goal)}
      {trackFat && macro('Fat', eaten.fat, targets.fat_goal)}
      <Rule heavy />

      <div className="grid gap-0.5 pt-1 text-[12.5px] leading-[1.45] text-ink-2">
        {!targetSet ? (
          <p>No target yet.</p>
        ) : over ? (
          <p>
            Over is fine. The week evens out.{' '}
            {/* Above the label's stretched link, so it is its own target. */}
            <Link
              to={plansLink(day, 'compensating', 'today')}
              className="relative z-10 font-bold text-ink underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            >
              Spread it
            </Link>
          </p>
        ) : (
          <p>Targets are a guide, not a rule.</p>
        )}
        {caption && <p>{caption}</p>}
      </div>
    </section>
  )
}
