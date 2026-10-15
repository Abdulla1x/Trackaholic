import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { localIsoDate } from '../lib/dates'
import {
  everyDay,
  foodWindow,
  REMEMBERED_RANGE_KEY,
  resolveRange,
  RANGES,
  type Range,
  type RangeKey,
} from '../lib/progress'
import { readLocal, writeLocal } from '../lib/storage'
import { targetIsSet } from '../lib/today'
import { formatRate, formatWeight, unitLabel } from '../lib/units'
import {
  NO_PROJECTION,
  pointsFrom,
  projectionCaption,
  TREND_FETCH_DAYS,
  TREND_UNLOCK,
  weightRangeStart,
} from '../lib/weight'
import {
  chartGround,
  chartInk,
  chartInk2,
  chartPlan,
  chartRule,
  chartTick,
  chartTooltip,
  chartTooltipLabel,
  planDash,
  progressMargin,
  shortDate,
} from '../lib/chartTheme'
import { useSettings } from '../settings/SettingsContext'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { useSkeletonFloor } from '../hooks/useSkeletonFloor'
import { useUnlockMoment } from '../hooks/useUnlockMoment'
import type { AnalyticsSummary, BodyTargets, Settings, WeightTrend } from '../types'
import DailyBurnBlock from '../components/progress/DailyBurnBlock'
import LookingBackBlock from '../components/progress/LookingBackBlock'
import Block, { LABEL_BOX } from '@/ui/block'
import { Chip } from '@/ui/chip'
import Explainer from '@/ui/explainer'
import Gauge from '@/ui/gauge'
import Retry from '@/ui/retry'
import { RowLink } from '@/ui/row'
import Skeleton from '@/ui/skeleton'
import { Stat, StatGrid } from '@/ui/stat'

const n = (value: number) => Math.round(value).toLocaleString()

/** The series the Nutrition chart can show. Carbs and fat only when tracked:
 *  off, nothing on the page mentions them (0a). */
const SERIES = [
  { key: 'calories', label: 'Calories', unit: 'kcal', goal: 'calorie_goal' },
  { key: 'protein', label: 'Protein', unit: 'g', goal: 'protein_goal' },
  { key: 'carbs', label: 'Carbs', unit: 'g', goal: 'carbs_goal' },
  { key: 'fat', label: 'Fat', unit: 'g', goal: 'fat_goal' },
] as const
type Series = (typeof SERIES)[number]

/** Progress (0a): the weekly look back. One range for the whole page (UA-5),
 *  and the food in it ends yesterday (UA-4). The range moves what is DRAWN
 *  and averaged; the current-state numbers (trend weight, this week's change,
 *  the goal date) are each worked out over their own fixed window and do not
 *  follow it, and the page says so. */
export default function Progress() {
  const { settings } = useSettings()
  const today = localIsoDate()
  const [params, setParams] = useSearchParams()
  const range = resolveRange(params.get('range'), readLocal(REMEMBERED_RANGE_KEY))
  const floorPassed = useSkeletonFloor()

  const chooseRange = (key: RangeKey) => {
    writeLocal(REMEMBERED_RANGE_KEY, key)
    setParams(
      (now) => {
        const next = new URLSearchParams(now)
        next.set('range', key)
        return next
      },
      { replace: true },
    )
  }

  // The trend, once: never refetched with the range (lib/weight.ts).
  // undefined while loading, null when it failed.
  const [trend, setTrend] = useState<WeightTrend | null | undefined>(undefined)
  const loadTrend = useCallback(() => {
    setTrend(undefined)
    api.getWeightTrend(TREND_FETCH_DAYS).then(setTrend, () => setTrend(null))
  }, [])
  useEffect(loadTrend, [loadTrend])

  // The food, per range. Averaged on the server, which averages each macro
  // over the days it was recorded on; doing that again here would be a second
  // copy of a rule that has already been got wrong once.
  const span = foodWindow(range.days, today)
  const foodKey = `${span.start ?? 'all'}..${span.end}`
  const [food, setFood] = useState<{ key: string; data: AnalyticsSummary } | null>(null)
  const [foodFailed, setFoodFailed] = useState(false)
  const loadFood = useCallback(() => {
    let current = true
    setFoodFailed(false)
    api
      .getAnalytics(span.start ?? undefined, span.end)
      .then((data) => current && setFood({ key: foodKey, data }))
      .catch(() => current && setFoodFailed(true))
    // A quick run through the ranges must not let a slow answer for an
    // earlier one land last and draw under the wrong label.
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodKey])
  useEffect(loadFood, [loadFood])

  // What the profile and the logs work out to, for Daily burn. Not tied to
  // the range: measured burn has its own fixed four-week window.
  const [burn, setBurn] = useState<BodyTargets | null | undefined>(undefined)
  const loadBurn = useCallback(() => {
    setBurn(undefined)
    api.getBodyTargets().then(setBurn, () => setBurn(null))
  }, [])
  useEffect(loadBurn, [loadBurn])

  const error =
    trend === null || foodFailed || burn === null
      ? "Couldn't load all of Progress. Check your connection, then try again."
      : null
  useLiveMessage(error)

  const firstLoad =
    !floorPassed || !settings || trend === undefined || burn === undefined || (food === null && !foodFailed)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] desk:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] desk:gap-x-10">
      <header className="border-b border-rule pb-1.5 desk:col-span-2 label:border-b-[5px]">
        <h1 className="py-2.5 text-center text-title desk:text-left label:text-[18px] label:font-black label:tracking-[-0.01em]">Progress</h1>
      </header>

      <div className={`grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-rule py-3.5 desk:col-span-2 ${LABEL_BOX}`}>
        <RangeControl value={range.key} onChange={chooseRange} />
        <p className="text-small text-ink-2">The range changes the charts and averages.</p>
        <Explainer label="What doesn't change?">
          Trend weight, this week's change and the goal date always use your latest weigh-ins.
        </Explainer>
      </div>

      {firstLoad ? (
        <div role="status" aria-busy="true" className={COLUMNS}>
          <span className="sr-only">Loading Progress</span>
          <div className="grid content-start grid-cols-[minmax(0,1fr)]">
            <SkeletonBlock />
            <SkeletonBlock />
          </div>
          <div className="grid content-start grid-cols-[minmax(0,1fr)]">
            <SkeletonBlock short />
            <SkeletonBlock short />
          </div>
        </div>
      ) : (
        <div className={COLUMNS}>
          <div className="grid content-start grid-cols-[minmax(0,1fr)]">
            <WeightBlock trend={trend} range={range} today={today} settings={settings} onRetry={loadTrend} />
            <NutritionBlock
              food={food?.data ?? null}
              stale={food !== null && food.key !== foodKey}
              failed={foodFailed}
              range={range}
              start={span.start}
              end={span.end}
              settings={settings}
              onRetry={loadFood}
            />
          </div>
          {/* The right-hand column from 900px, below Nutrition on a phone: the
              numbers that keep their own windows rather than the range's. */}
          <div className="grid content-start grid-cols-[minmax(0,1fr)]">
            <DailyBurnBlock targets={burn ?? null} onRetry={loadBurn} />
            <LookingBackBlock today={today} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Weight and Nutrition on the left, the rest on the right from 900px (0a);
 *  one column, in that order, on a phone. */
const COLUMNS =
  'grid grid-cols-[minmax(0,1fr)] desk:col-span-2 desk:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] desk:gap-x-10'

/** One choice for the whole page (UA-5): five chips sharing the width, so
 *  they never wrap to a second row (UA-19), even at 320px. */
function RangeControl({ value, onChange }: { value: RangeKey; onChange: (key: RangeKey) => void }) {
  return (
    <div role="group" aria-label="Range" className="flex gap-1">
      {RANGES.map((range) => (
        <Chip
          key={range.key}
          pressed={range.key === value}
          onClick={() => onChange(range.key)}
          className="min-w-0 flex-1 justify-center px-1"
        >
          {range.label}
        </Chip>
      ))}
    </div>
  )
}

function SkeletonBlock({ short = false }: { short?: boolean }) {
  return (
    <div className={`grid gap-2.5 border-b border-rule py-3.5 ${LABEL_BOX}`}>
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-9 w-3/5" />
      <Skeleton className={short ? 'h-[72px]' : 'h-[200px]'} />
    </div>
  )
}

function WeightBlock({
  trend,
  range,
  today,
  settings,
  onRetry,
}: {
  trend: WeightTrend | null | undefined
  range: Range
  today: string
  settings: Settings
  onRetry: () => void
}) {
  const reduced = useReducedMotion()
  const unit = settings.weight_unit
  const label = unitLabel(unit)
  const unlocking = useUnlockMoment('weight_trend', trend ? trend.point_count >= TREND_UNLOCK : undefined)
  useLiveMessage(unlocking ? UNLOCKED_LINE : null)

  if (!trend) {
    return (
      <Block label="Weight">
        <Retry text="Couldn't load your weigh-ins." onRetry={onRetry} />
      </Block>
    )
  }

  // Locked until seven weigh-ins (DESIGN.md: show what unlocks it, not a
  // trend built on two points).
  if (trend.point_count < TREND_UNLOCK) {
    return (
      <Block label="Weight trend" value={`${trend.point_count} of ${TREND_UNLOCK}`}>
        <Gauge segments={10} lit={Math.round((trend.point_count / TREND_UNLOCK) * 10)} className="h-2.5" />
        <p className="text-small text-ink-2">
          Seven weigh-ins and the trend line appears. Weigh in from Today; a weigh-in made today counts.
        </p>
        {trend.point_count > 0 && <AllWeighIns />}
      </Block>
    )
  }

  const goal = trend.projection ?? NO_PROJECTION
  const goalShown = goal.goal_weight_kg === null ? null : Number(formatWeight(goal.goal_weight_kg, unit))
  const shown = pointsFrom(trend.points, weightRangeStart(range.days, today)).map((point) => ({
    date: point.date,
    weight: Number(formatWeight(point.weight_kg, unit)),
    trend: Number(formatWeight(point.trend_kg, unit)),
  }))
  const axis = weightAxis(shown, goalShown)

  return (
    <Block
      label="Weight"
      value={trend.latest_trend_kg === null ? undefined : `${formatWeight(trend.latest_trend_kg, unit)} ${label} trend`}
      className={unlocking ? 'animate-unlock' : undefined}
    >
      {unlocking && <p className="font-semibold">{UNLOCKED_LINE}</p>}
      <StatGrid>
        <Stat label="This week" unit={trend.weekly_rate_kg === null ? undefined : label}>
          {trend.weekly_rate_kg === null ? '—' : formatRate(trend.weekly_rate_kg, unit)}
        </Stat>
        <Stat
          // The projected date in the label, where it never wraps the figure:
          // in the unit it pushed "kg" onto a second line once the date was in
          // another year and so carried one.
          label={goal.status === 'on_course' && goal.reach_date ? `Goal · ${shortDate(goal.reach_date)}` : 'Goal'}
          unit={goal.goal_weight_kg === null ? undefined : label}
        >
          {goal.goal_weight_kg === null ? '—' : formatWeight(goal.goal_weight_kg, unit)}
        </Stat>
      </StatGrid>
      <p className="text-small text-ink-2">{projectionCaption(trend, unit)}</p>

      {shown.length === 0 ? (
        <p className="py-6 text-center text-small text-ink-2">No weigh-ins in these {range.days} days.</p>
      ) : (
        <figure className="m-0">
          <figcaption className="sr-only">
            Weight chart: weigh-ins as dots, the trend as a line
            {goal.goal_weight_kg === null ? '' : `, the goal as a dashed line at ${formatWeight(goal.goal_weight_kg, unit)} ${label}`}.
          </figcaption>
          {/* Keyed by the range so a change redraws the line from the start
              (DESIGN.md Motion: Charts) instead of morphing between two
              unrelated sets of points. */}
          <ResponsiveContainer key={range.key} width="100%" height={200}>
            <ComposedChart data={shown} margin={progressMargin}>
              <CartesianGrid stroke={chartRule} vertical={false} />
              <XAxis
                dataKey="date"
                tick={chartTick}
                tickFormatter={shortDate}
                stroke={chartRule}
                tickLine={false}
                minTickGap={24}
              />
              {/* Not zero-based: body weight varies by a few percent, and a
                  0-anchored axis would flatten every real change to nothing.
                  Whole numbers at the ends, so the ticks land on round
                  weights instead of "84.8" and "80.8". The goal is inside, so
                  its line is always drawn. */}
              <YAxis
                tick={chartTick}
                stroke={chartRule}
                tickLine={false}
                width="auto"
                domain={axis.domain}
                ticks={axis.ticks}
                interval={0}
              />
              <Tooltip
                contentStyle={chartTooltip}
                labelStyle={chartTooltipLabel}
                labelFormatter={(value) => shortDate(String(value))}
                formatter={(value, name) => [`${Number(value).toFixed(1)} ${label}`, name]}
                cursor={{ stroke: chartRule }}
              />
              {/* The goal comes from the projection rather than settings, so
                  the line and the sentence above can never name two different
                  goals. weightAxis already takes the goal in; extendDomain
                  stays as the guard, since a goal outside an explicit domain
                  is dropped silently, and a goal line you cannot see is not a
                  feature. */}
              {goal.goal_weight_kg !== null && (
                <ReferenceLine
                  y={goalShown ?? undefined}
                  stroke={chartPlan}
                  strokeWidth={2}
                  strokeDasharray={planDash}
                  ifOverflow="extendDomain"
                />
              )}
              {/* Context in ink 2, the subject in ink (DESIGN.md). */}
              <Line
                name="Weigh-in"
                dataKey="weight"
                stroke={chartInk2}
                strokeWidth={0}
                dot={{ r: shown.length > 120 ? 1.5 : 2.5, fill: chartInk2, stroke: 'none' }}
                activeDot={{ r: 4, fill: chartInk2, stroke: chartGround, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Line
                name="Trend"
                type="monotone"
                dataKey="trend"
                stroke={chartInk}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: chartInk, stroke: chartGround, strokeWidth: 2 }}
                isAnimationActive={!reduced}
                // A range change redraws it in 700ms; the visit it unlocks on,
                // it draws itself more slowly, after the block has arrived.
                animationDuration={unlocking ? 1100 : 700}
                animationBegin={unlocking ? 300 : 0}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </figure>
      )}
      {shown.length > 0 && goalShown !== null && (
        <PlanKey>
          Goal {goalShown.toFixed(1)} {label}
        </PlanKey>
      )}
      <AllWeighIns />
    </Block>
  )
}

/** The dashed line's key, under a chart rather than written inside it, where
 *  the label sat on top of the bars or the weigh-ins whenever they reached it
 *  (DESIGN.md: Charts). Decorative to a screen reader: the figure caption
 *  already says what the dashed line is. */
function PlanKey({ children }: { children: ReactNode }) {
  return (
    <p aria-hidden="true" className="flex items-center gap-2 text-small text-ink-2">
      <span className="w-5 border-t-2 border-dashed border-plan" />
      {children}
    </p>
  )
}

function AllWeighIns() {
  return <RowLink to="/progress/weigh-ins" label="All weigh-ins" detail="Change or delete any day" className="border-t border-rule" />
}

/** DESIGN.md Voice: "Weight trend unlocks". */
const UNLOCKED_LINE = "Seven weigh-ins. You've earned a trend line."

/** The weight axis: a little room around the weigh-ins and the goal, cut into
 *  four even whole-number steps, so the labels read 80 · 82 · 84 · 86 rather
 *  than wherever the chart library's own steps happen to land. */
function weightAxis(points: { weight: number; trend: number }[], goal: number | null) {
  const values = points.flatMap((point) => [point.weight, point.trend])
  if (goal !== null) values.push(goal)
  const low = Math.floor(Math.min(...values) - 0.5)
  const step = Math.max(1, Math.ceil((Math.max(...values) + 0.5 - low) / 4))
  const ticks = [0, 1, 2, 3, 4].map((index) => low + index * step)
  return { domain: [low, low + 4 * step] as [number, number], ticks }
}

function NutritionBlock({
  food,
  stale,
  failed,
  range,
  start,
  end,
  settings,
  onRetry,
}: {
  food: AnalyticsSummary | null
  stale: boolean
  failed: boolean
  range: Range
  start: string | null
  end: string
  settings: Settings
  onRetry: () => void
}) {
  const reduced = useReducedMotion()
  const offered = SERIES.filter(
    (series) =>
      (series.key !== 'carbs' || settings.track_carbs) && (series.key !== 'fat' || settings.track_fat),
  )
  const [picked, setPicked] = useState<Series['key']>('calories')
  // A series switched off on You since it was picked falls back.
  const series = offered.find((option) => option.key === picked) ?? SERIES[0]

  if (failed || !food) {
    return (
      <Block label="Nutrition">
        <Retry text="Couldn't load your meals." onRetry={onRetry} />
      </Block>
    )
  }

  const first = start ?? food.days[0]?.date ?? end
  const days = everyDay(first, end)
  const byDate = new Map(food.days.map((day) => [day.date, day]))
  const data = days.map((date) => {
    const day = byDate.get(date)
    return { date, value: day ? (day[series.key] ?? null) : null }
  })
  const counted = food.average_days[series.key]
  // No line until a target is chosen: the signup placeholder drawn across the
  // bars would read as a target the person set.
  const target = targetIsSet(settings) ? settings[series.goal] : null

  return (
    <Block
      label="Nutrition"
      value={
        counted > 0
          ? `avg ${n(food.averages[series.key])} ${series.unit} · ${counted} of ${days.length} days`
          : undefined
      }
      className={stale ? 'opacity-60 transition-opacity' : undefined}
    >
      <div role="group" aria-label="Series" className="flex flex-wrap gap-1.5">
        {offered.map((option) => (
          <Chip key={option.key} pressed={option.key === series.key} onClick={() => setPicked(option.key)}>
            {option.label}
          </Chip>
        ))}
      </div>

      {food.logged_days === 0 ? (
        <p className="py-6 text-center text-small text-ink-2">
          {range.days === null ? 'Nothing logged before today yet.' : `Nothing logged in these ${range.days} days.`}{' '}
          Today joins the chart tomorrow.
        </p>
      ) : (
        <figure className="m-0">
          <figcaption className="sr-only">
            Daily {series.label.toLowerCase()} from {shortDate(first)} to {shortDate(end)}, as bars
            {target === null ? '.' : `, with your target of ${n(target)} ${series.unit} as a dashed line.`}
          </figcaption>
          <ResponsiveContainer key={`${range.key}-${series.key}`} width="100%" height={200}>
            <BarChart data={data} margin={progressMargin} barCategoryGap="20%">
              <CartesianGrid stroke={chartRule} vertical={false} />
              <XAxis
                dataKey="date"
                tick={chartTick}
                tickFormatter={shortDate}
                stroke={chartRule}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={chartTick}
                stroke={chartRule}
                tickLine={false}
                width="auto"
                tickFormatter={(value: number) => n(value)}
              />
              <Tooltip
                contentStyle={chartTooltip}
                labelStyle={chartTooltipLabel}
                labelFormatter={(value) => shortDate(String(value))}
                formatter={(value) => [`${n(Number(value))} ${series.unit}`, series.label]}
                cursor={{ fill: chartRule, opacity: 0.5 }}
              />
              {/* Data is ink, the target is the plan colour (the Plan Rule). */}
              <Bar
                dataKey="value"
                name={series.label}
                fill={chartInk}
                maxBarSize={28}
                isAnimationActive={!reduced}
                animationDuration={400}
                animationEasing="ease-out"
              />
              {target !== null && (
                <ReferenceLine
                  y={target}
                  stroke={chartPlan}
                  strokeWidth={2}
                  strokeDasharray={planDash}
                  ifOverflow="extendDomain"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </figure>
      )}
      {food.logged_days > 0 && target !== null && (
        <PlanKey>
          Target {n(target)} {series.unit}
        </PlanKey>
      )}
      {food.logged_days > 0 && <p className="text-small text-ink-2">Today is left out until it's over.</p>}
      <RowLink
        to={`/progress/days?range=${range.key}`}
        label="Daily totals"
        detail="Each day's calories and macros"
        className="border-t border-rule"
      />
    </Block>
  )
}
