import { useCallback, useEffect, useState } from 'react'
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
import { everyDay, foodWindow, resolveRange, RANGES, type Range, type RangeKey } from '../lib/progress'
import { readLocal, writeLocal } from '../lib/storage'
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
import type { AnalyticsSummary, Settings, WeightTrend } from '../types'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import Gauge from '@/ui/gauge'
import Skeleton from '@/ui/skeleton'
import { Stat, StatGrid } from '@/ui/stat'

/** Where this device last left the range: a per-device convenience, so the
 *  page reopens where it was. The address still wins (a link, back, reload). */
const RANGE_KEY = 'trackaholic_progress_range'

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
  const range = resolveRange(params.get('range'), readLocal(RANGE_KEY))
  const floorPassed = useSkeletonFloor()

  const chooseRange = (key: RangeKey) => {
    writeLocal(RANGE_KEY, key)
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

  const error =
    trend === null || foodFailed ? "Couldn't load all of Progress. Check your connection, then try again." : null
  useLiveMessage(error)

  const firstLoad = !floorPassed || !settings || trend === undefined || (food === null && !foodFailed)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] desk:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] desk:gap-x-10">
      <header className="border-b border-rule pb-1.5 desk:col-span-2">
        <h1 className="py-2.5 text-center text-title desk:text-left">Progress</h1>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-rule py-3.5 desk:col-span-2">
        <RangeControl value={range.key} onChange={chooseRange} />
        <p className="text-small text-ink-2">
          The range changes the charts and averages. Trend weight, this week’s change and the goal date always use your
          latest weigh-ins.
        </p>
      </div>

      {firstLoad ? (
        <div role="status" aria-busy="true" className="grid grid-cols-[minmax(0,1fr)]">
          <span className="sr-only">Loading Progress</span>
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : (
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
      )}
    </div>
  )
}

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

function SkeletonBlock() {
  return (
    <div className="grid gap-2.5 border-b border-rule py-3.5">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-9 w-3/5" />
      <Skeleton className="h-[200px]" />
    </div>
  )
}

function Retry({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <p className="border-l-2 border-ink pl-3 text-small">
      {text}{' '}
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-3">
        Retry
      </button>
    </p>
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
    >
      <StatGrid>
        <Stat label="This week" unit={trend.weekly_rate_kg === null ? undefined : label}>
          {trend.weekly_rate_kg === null ? '—' : formatRate(trend.weekly_rate_kg, unit)}
        </Stat>
        <Stat
          label="Goal"
          unit={
            goal.goal_weight_kg === null
              ? undefined
              : `${label}${goal.status === 'on_course' && goal.reach_date ? ` · ${shortDate(goal.reach_date)}` : ''}`
          }
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
                width={44}
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
                  label={{
                    value: `Goal ${formatWeight(goal.goal_weight_kg, unit)} ${label}`,
                    position: 'insideBottomRight',
                    fill: chartPlan,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
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
                animationDuration={700}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </figure>
      )}
    </Block>
  )
}

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
  // A series switched off in Settings since it was picked falls back.
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
  const target = settings[series.goal]

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
            Daily {series.label.toLowerCase()} from {shortDate(first)} to {shortDate(end)}, as bars, with your target
            of {n(target)} {series.unit} as a dashed line.
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
                width={44}
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
              <ReferenceLine
                y={target}
                stroke={chartPlan}
                strokeWidth={2}
                strokeDasharray={planDash}
                ifOverflow="extendDomain"
                label={{ value: 'Target', position: 'insideTopRight', fill: chartPlan, fontSize: 12, fontWeight: 700 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </figure>
      )}
      <p className="text-small text-ink-2">Today is left out until it’s over.</p>
    </Block>
  )
}
