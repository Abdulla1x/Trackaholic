import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../api/client'
import { addDays, dayRange, localIsoDate, parseIsoDate } from '../../lib/dates'
import { MAX_PLAN_DAYS, MAX_PLAN_HORIZON_DAYS, validatePlan } from '../../lib/limits'
import { num } from '../../lib/parse'
import type { CaloriePlan, DaySurplus, PlanKind } from '../../types'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { Chip } from '@/ui/chip'
import Explainer from '@/ui/explainer'
import { FIELD } from '@/ui/field'
import { NumberField } from '@/ui/number-field'

/** Move calories between days without moving the week.
 *
 * The body of You -> Calorie plans: a form to make a plan (two kinds) and the
 * list of plans already made.
 *
 * **This screen never offers.** Nothing here appears because you went over --
 * no prompt, no "shall we cut the next four days?". You come looking for it.
 * An app that asks every time you overshoot is not a tool for planning around a
 * dinner, it is a mechanism for turning one into a debt, and the difference is
 * entirely in who starts the conversation.
 *
 * The other half of that: you choose which days absorb the change. The server
 * never picks them. All it does is refuse a set that would drop a day below the
 * calorie floor, and say which day and why.
 */

const short = (iso: string) =>
  parseIsoDate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

const signed = (kcal: number) =>
  `${kcal > 0 ? '+' : '−'}${Math.abs(Math.round(kcal)).toLocaleString()}`

// Server refusals name the offending day, and the server only knows a date as
// an ISO string. Every other date on this screen reads "Wed, Aug 26", so an
// unconverted 2026-08-26 in the one message that matters most leaves the user
// matching a number against the buttons above it.
//
// A narrow transform rather than a parse: YYYY-MM-DD is the only token of that
// shape these sentences contain, and anything that does not match is left
// exactly as the server wrote it.
const humaniseDates = (message: string) =>
  message.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => short(iso))

export default function CaloriePlanSection({
  onRejected,
  initialDate,
  initialKind,
  onDone,
}: {
  onRejected: (message: string) => void
  /** Prefills the day being planned around, when arriving from a day's
   *  numbers rather than from the settings page itself. */
  initialDate?: string
  /** Opens that kind of plan straight away: the day screen offers "Plan a
   *  bigger day" and "Make up a day" as two rows, and each should land on its
   *  own form rather than on a choice the user already made. */
  initialKind?: PlanKind
  /** Called once a plan is saved (true) or its form cancelled (false), when
   *  the planner was opened from a day: the caller takes the user back there. */
  onDone?: (saved: boolean) => void
}) {
  const [plans, setPlans] = useState<CaloriePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useLiveMessage(error)
  const [mode, setMode] = useState<PlanKind | null>(null)
  // Today until a mode is opened, at which point `open` clamps the prefill to
  // that mode's range. There is no form on screen before then.
  const [eventDate, setEventDate] = useState(localIsoDate)
  const [amount, setAmount] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [surplus, setSurplus] = useState<DaySurplus | null>(null)
  const [surplusFailed, setSurplusFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const today = localIsoDate()

  const load = useCallback(() => {
    setLoading(true)
    api
      .getPlans()
      .then((next) => {
        setPlans(next)
        setError('')
      })
      // No plans and a failed fetch render identically otherwise, and one means
      // "nothing planned" while the other means "try again".
      .catch(() => setError("Couldn't load your calorie plans."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  // The surplus is measured server-side, so it is fetched rather than derived.
  // Refetched on every change of the day in question because the answer moves:
  // logging another meal changes it, and so does changing your calorie goal.
  useEffect(() => {
    if (mode !== 'compensating') return
    let live = true
    setSurplus(null)
    setSurplusFailed(false)
    api
      .getDaySurplus(eventDate)
      .then((next) => {
        if (live) setSurplus(next)
      })
      .catch(() => {
        if (live) setSurplusFailed(true)
      })
    return () => {
      live = false
    }
  }, [mode, eventDate])

  // The days offered to absorb the change. Centred on the day being planned
  // for rather than always starting today, so funding a dinner three weeks out
  // offers the days around it instead of a fortnight of irrelevant ones.
  //
  // Never a day before today: a day whose meals are already logged cannot have
  // the target it was measured against changed after the fact. The server
  // enforces that too; this is what stops the user meeting the refusal.
  const candidates = useMemo(() => {
    const start = mode === 'planned' && addDays(eventDate, -7) > today
      ? addDays(eventDate, -7)
      : today
    return dayRange(start, MAX_PLAN_DAYS).filter(
      (day) => day !== eventDate && day >= today,
    )
  }, [mode, eventDate, today])

  // Days already claimed by another plan. Shown as unavailable rather than
  // offered and then refused: the server answers with a 409 naming the owner,
  // which is the right answer to a race but a poor way to learn the rule.
  const claimed = useMemo(() => {
    const taken = new Set<string>()
    for (const plan of plans) for (const day of plan.days) taken.add(day.date)
    return taken
  }, [plans])

  const open = (kind: PlanKind) => {
    setError('')
    setMode(kind)
    setSelected([])
    setAmount('')
    // Clamped to each mode's own legal range rather than used as given. The
    // prefill is whatever day the dashboard was showing, and that day is often
    // wrong for the mode being opened -- arriving from yesterday and choosing
    // "Plan a bigger day" would otherwise open the form on a date the server is
    // certain to refuse. A day to compensate for has to have happened; a day to
    // plan for cannot have.
    if (kind === 'compensating') {
      setEventDate(initialDate && initialDate <= today ? initialDate : addDays(today, -1))
    } else {
      setEventDate(initialDate && initialDate >= today ? initialDate : today)
    }
  }

  // Once, on arrival. A ref rather than an empty dependency list, because
  // `open` is a fresh function every render and the rule about listing it is
  // right in general; here it must not re-run when it changes.
  const form = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  useEffect(() => {
    if (!initialKind || opened.current) return
    opened.current = true
    open(initialKind)
    requestAnimationFrame(() => form.current?.scrollIntoView({ block: 'center' }))
  })

  const close = () => {
    setError('')
    setMode(null)
    setSelected([])
  }

  const toggle = (day: string) => {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const submit = async () => {
    if (mode === null) return
    const moved = num(amount)
    const problem = validatePlan(selected, moved, mode === 'planned')
    if (problem) {
      onRejected(problem)
      return
    }

    setBusy(true)
    setError('')
    try {
      await api.createPlan({
        kind: mode,
        event_date: eventDate,
        // Sorted so the plan reads in date order the moment it comes back;
        // the server does not care, and the user does.
        dates: [...selected].sort(),
        calorie_delta: mode === 'planned' ? moved : null,
      })
      close()
      if (onDone) onDone(true)
      else load()
    } catch (err) {
      // Server refusals arrive here whole -- every offending day at once,
      // because a plan is validated as a set. Shown next to the form rather
      // than in the shared modal: they are several sentences long and they
      // answer the thing still on screen.
      setError(
        err instanceof Error
          ? humaniseDates(err.message)
          : "That plan didn't save. Check your connection, then try again.",
      )
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (eventDay: string) => {
    setBusy(true)
    setError('')
    try {
      await api.cancelPlan(eventDay)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That plan didn't cancel. Check your connection, then try again.")
    } finally {
      setBusy(false)
    }
  }

  const problem = error && (
    // Ink, not red (the No Red Rule): a refusal names what to change, it is
    // not an alarm.
    <p role="alert" className="border-l-2 border-ink pl-3 text-small">
      {error}
    </p>
  )

  return (
    <>
      <Block>
        <p>Eat more on one day and less on others, or spread a day that went over. The week evens out.</p>
        {/* The honest note, one tap away. The app is not keeping a ledger and
            it is not going to collect: your measured burn is fitted from
            average intake against your weight trend, so one large day already
            shows up as a slightly slower week whether or not you plan it. */}
        <Explainer>
          <div className="grid gap-1.5">
            <p>Nothing here is a debt: a plan only decides where a big day lands.</p>
            <p>
              Calories are split evenly across the days you pick; protein never moves, carbs and fat take the
              difference. No day goes below your calorie floor.
            </p>
            <p>Plans apply straight away, without a Save bar.</p>
          </div>
        </Explainer>
        {mode === null && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => open('planned')}>Plan a bigger day</Button>
            <Button variant="secondary" onClick={() => open('compensating')}>
              Make up a day
            </Button>
          </div>
        )}
        {mode === null && problem}
      </Block>

      {mode !== null && (
        <div ref={form}>
          <Block label={mode === 'planned' ? 'Plan a bigger day' : 'Make up a day'}>
            <div className="flex flex-wrap items-start gap-4">
              <label className="grid gap-1.5">
                <span className="text-small text-ink-2">{mode === 'planned' ? 'Day to plan for' : 'Day to make up'}</span>
                <input
                  type="date"
                  value={eventDate}
                  // The mirror image of every other date input in this app. A
                  // weigh-in or a meal can only describe something that has
                  // happened; a plan is the one thing that reaches forward.
                  min={mode === 'planned' ? today : undefined}
                  max={mode === 'planned' ? addDays(today, MAX_PLAN_HORIZON_DAYS) : today}
                  onChange={(e) => {
                    if (!e.target.value) return
                    setEventDate(e.target.value)
                    setSelected([])
                  }}
                  className={cn(FIELD, 'w-[200px]')}
                />
              </label>
              {mode === 'planned' && (
                <div className="grid gap-1.5">
                  <NumberField
                    id="plan-amount"
                    label="Calories to move"
                    unit="kcal"
                    inputMode="numeric"
                    value={amount}
                    placeholder="600"
                    onChange={setAmount}
                  />
                  <span className="text-small text-ink-2">Negative for a smaller day.</span>
                </div>
              )}
            </div>

            {mode === 'compensating' && (
              <div className="grid gap-1 text-small">
                {surplusFailed ? (
                  <p className="text-ink-2">Couldn't work out how that day went. Try again.</p>
                ) : surplus === null ? (
                  <p className="text-ink-2">Checking that day…</p>
                ) : surplus.meal_count === 0 ? (
                  <p className="text-ink-2">
                    Nothing is logged on {short(eventDate)}, so there's nothing to spread.
                  </p>
                ) : (
                  <>
                    <p>
                      {Math.round(surplus.consumed_calories).toLocaleString()} kcal eaten against a{' '}
                      {Math.round(surplus.reference_calories).toLocaleString()} kcal target:{' '}
                      <b className="font-semibold">{signed(surplus.surplus_calories)} kcal</b>.
                    </p>
                    {/* Said plainly because it is a real limitation: this app
                        stores one calorie goal, not a history of them, so a past
                        day can only be measured against the target it has now. */}
                    <p className="text-ink-2">Measured against that day's target as it is now.</p>
                  </>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <p className="text-small text-ink-2">
                {mode === 'planned' ? 'Days to take it from' : 'Days to spread it across'} ({selected.length} of up to{' '}
                {MAX_PLAN_DAYS})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map((day) => {
                  const taken = claimed.has(day)
                  return (
                    <Chip
                      key={day}
                      pressed={selected.includes(day)}
                      onClick={() => toggle(day)}
                      disabled={taken || busy}
                      title={taken ? 'Already moved by another plan' : undefined}
                      className="disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {short(day)}
                    </Chip>
                  )
                })}
              </div>
            </div>

            {problem}

            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={busy}>
                {busy ? 'Saving…' : 'Save plan'}
              </Button>
              <Button variant="ghost" onClick={onDone ? () => onDone(false) : close} disabled={busy}>
                Cancel
              </Button>
            </div>
          </Block>
        </div>
      )}

      <Block label="Planned">
        {loading ? (
          <p className="text-small text-ink-2">Loading…</p>
        ) : plans.length === 0 ? (
          <p className="text-small text-ink-2">Nothing planned.</p>
        ) : (
          <ul className="grid divide-y divide-rule">
            {plans.map((plan) => (
              <li key={plan.event_date} className="grid gap-1.5 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {plan.kind === 'planned' ? `Bigger day on ${short(plan.event_date)}` : `Making up ${short(plan.event_date)}`}
                  </span>
                  {/* GET /api/plan only returns plans with a day still ahead,
                      so this is always true today. Kept as a condition: the
                      server refuses to cancel a fully-past plan with a 409, and
                      a Cancel button that 409s is the failure that would appear
                      if this list ever widened to finished plans. */}
                  {plan.can_cancel && (
                    <Button variant="ghost" onClick={() => cancel(plan.event_date)} disabled={busy}>
                      Cancel plan
                    </Button>
                  )}
                </div>
                <ul className="grid gap-0.5 text-small text-ink-2">
                  {plan.days.map((day) => (
                    <li key={day.date} className="flex justify-between gap-3">
                      <span>
                        {short(day.date)}
                        {day.date < today && ' · passed'}
                      </span>
                      <span className="tabular-nums">
                        <b className="font-semibold text-ink">{Math.round(day.calorie_goal).toLocaleString()} kcal</b> (
                        {signed(day.calorie_delta ?? 0)})
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  )
}
