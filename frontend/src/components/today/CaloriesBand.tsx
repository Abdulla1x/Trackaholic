import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useOnTargetMoment } from '../../hooks/useOnTargetMoment'
import { plansLink } from '../../lib/planOrigin'
import { calorieBalance, litSegments, type DayTotals } from '../../lib/today'
import Gauge from '@/ui/gauge'
import { NextIcon } from '@/ui/icons'
import CountUp from '@/ui/count-up'
import RollingNumber from '@/ui/rolling-number'
import { cn } from '@/lib/utils'

export interface BandTargets {
  calorie_goal: number
  protein_goal: number
  carbs_goal: number
  fat_goal: number
}

const n = (value: number) => Math.round(value).toLocaleString()

/** One macro as a full-width row: its name, a 10-segment bar closed by the
 *  same plan-coloured target tick as the calories gauge, and "142 / 240 g"
 *  (rows chosen from the 3a prototype, 2026-10-12; the tick from a prototype
 *  after a phone test, 2026-10-13). One row each rather
 *  than fields side by side, so carbs and fat add rows instead of squeezing
 *  protein. The value column has a fixed width, so the bars of every row
 *  start and end on the same lines. With no goal there is nothing to fill
 *  towards, so the bar is left out and only the amount shows. */
function MacroRow({ label, value, goal }: { label: string; value: number; goal?: number }) {
  return (
    <div className="grid min-h-[34px] grid-cols-[74px_minmax(0,1fr)_112px] items-center gap-3 [&+&]:border-t [&+&]:border-band-rule">
      <span className="text-field-label text-band-ink-2">{label}</span>
      {goal === undefined ? (
        <span />
      ) : (
        <Gauge segments={10} lit={litSegments(value, goal, 10)} target tone="band" className="h-2" />
      )}
      <span className="text-right text-row-number whitespace-nowrap">
        <RollingNumber value={value} />
        <Unit>{goal === undefined ? 'g' : `/ ${n(goal)} g`}</Unit>
      </span>
    </div>
  )
}

const BAND =
  'relative -mx-4 grid grid-cols-[minmax(0,1fr)] gap-2.5 border-b border-band-rule bg-band px-4 pt-3.5 text-band-ink desk:mx-0 desk:px-7 desk:pt-5'

/** The whole band opens the day in detail: this link's hit area is stretched
 *  over it (after:inset-0), so the band is one big target with one short,
 *  honest name, rather than a link whose name would be every number on it. */
function DayLink({ day }: { day: string }) {
  return (
    <Link
      to={`/day/${day}`}
      className="flex items-center gap-0.5 text-field-label text-band-ink-2 after:absolute after:inset-0 after:content-[''] hover:text-band-ink focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-action"
    >
      Day in detail
      <NextIcon size={14} aria-hidden="true" />
    </Link>
  )
}

function Unit({ children }: { children: ReactNode }) {
  return <small className="ml-1 text-[14px] font-semibold text-band-ink-2 [font-stretch:100%]">{children}</small>
}

/** The top of Today (DESIGN.md: The calories band). Calories as the one
 *  headline (UA-2), "1,240 eaten of 2,300 target" in the line under it, a
 *  20-segment gauge closed by the plan-coloured target tick, then one row per
 *  macro: protein, and carbs and fat only when tracked (never mentioned
 *  otherwise).
 *
 *  Within 2% of the target, either side, the headline is the words "On
 *  target" instead of a number. The line under it stays, so the exact figure
 *  and the target are still on screen once (option A, chosen from the 3a
 *  prototype on 2026-10-12; it replaces the look-E rule of nothing under the
 *  words).
 *
 *  Tapping anywhere on it opens the day in detail, where calorie plans live.
 *
 *  Going over is drawn calmly: the label changes to "Kcal over", the gauge is
 *  simply full, and one plain line offers a way to spread it. No red, no
 *  motion (the No Red Rule, the Never Punish Rule).
 *
 *  Before the account has chosen a target (`targetSet` false) it shows what
 *  was eaten and nothing to measure it against: "no target yet" under the
 *  number, no gauge, no "left", and macro amounts without bars. Every account
 *  starts with a 2,000 kcal placeholder, and a gauge drawn against it would
 *  be an invented number (chosen from the first-use prototype, 2026-10-11). */
export default function CaloriesBand({
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
  /** The First target moment: the number counts up from zero and the gauge
   *  draws in, once, right after setup. */
  firstTarget?: boolean
  caption?: string
  trackCarbs: boolean
  trackFat: boolean
}) {
  const balance = calorieBalance(eaten.calories, targets.calorie_goal)
  const { amount, over: past } = balance
  // No target, nothing to be on: the moment below must never play for one.
  const onTarget = targetSet && balance.onTarget
  // Over in words only beyond the band: 8 kcal over is on target.
  const over = past && !onTarget
  const lit = litSegments(eaten.calories, targets.calorie_goal, 20)
  // Reaching it today is marked, once: the sweep runs, the target tick lifts,
  // and the words roll up. Nothing plays for going over (the Never Punish Rule).
  const moment = useOnTargetMoment(day, onTarget, lit)
  // Protein always, then carbs and fat only when tracked (never mentioned
  // otherwise). Without a target the rows show amounts and no bars.
  const macros = (
    <div className="grid border-t border-band-rule pt-1 pb-2">
      <MacroRow label="Protein" value={eaten.protein} goal={targetSet ? targets.protein_goal : undefined} />
      {trackCarbs && <MacroRow label="Carbs" value={eaten.carbs} goal={targetSet ? targets.carbs_goal : undefined} />}
      {trackFat && <MacroRow label="Fat" value={eaten.fat} goal={targetSet ? targets.fat_goal : undefined} />}
    </div>
  )

  if (!targetSet) {
    return (
      <section aria-label="Calories" className={BAND}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-field-label text-band-ink-2">{isToday ? 'Eaten today' : 'Eaten'}</h2>
          <DayLink day={day} />
        </div>
        <p className="text-display-number desk:text-[132px]">
          <RollingNumber value={eaten.calories} />
        </p>
        <p className="text-small text-band-ink-2">kcal · no target yet</p>
        {macros}
      </section>
    )
  }

  return (
    <section aria-label="Calories" className={BAND}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-field-label text-band-ink-2">{onTarget ? 'Calories' : over ? 'Kcal over' : 'Kcal left'}</h2>
        <DayLink day={day} />
      </div>
      {onTarget ? (
        // The display style at about two thirds of the number's size: nine
        // characters at 92px would not fit a phone.
        <p
          className={`pb-1 text-display-number text-[58px] leading-[0.9] desk:text-[84px] ${
            moment != null ? 'animate-words-in [animation-delay:var(--words)] motion-reduce:[animation-delay:0ms]' : ''
          }`}
          style={moment != null ? ({ '--words': `${moment}ms` } as CSSProperties) : undefined}
        >
          On target
        </p>
      ) : (
        <p className="text-display-number desk:text-[132px]">
          {firstTarget ? <CountUp value={amount} /> : <RollingNumber value={amount} />}
        </p>
      )}
      {/* Eaten lives in this line now, under the number or the words, so the
          target is on screen once either way (option A, 2026-10-12). */}
      <p className="text-small text-band-ink-2">
        <RollingNumber value={eaten.calories} /> eaten of {n(targets.calorie_goal)} target
      </p>
      <Gauge
        segments={20}
        lit={lit}
        target
        lift={moment}
        tone="band"
        className={cn('h-3.5', firstTarget && 'animate-gauge-draw')}
      />
      {(over || caption) && (
        <div className="grid gap-0.5 text-small text-band-ink-2">
          {over && (
            <p>
              Over is fine. The week evens out.{' '}
              {/* Above the band's stretched link, so it is its own target. */}
              <Link
                to={plansLink(day, 'compensating', 'today')}
                className="relative z-10 font-semibold text-band-ink underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Spread it
              </Link>
            </p>
          )}
          {caption && <p>{caption}</p>}
        </div>
      )}
      {macros}
    </section>
  )
}
