import { Link } from 'react-router-dom'
import {
  TDEE_MIN_SPAN_DAYS,
  TDEE_MIN_WEIGH_INS,
  tdeeLoggedDaysNeeded,
} from '../../lib/limits'
import type { BodyTargets } from '../../types'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { useUnlockMoment } from '../../hooks/useUnlockMoment'
import Block from '@/ui/block'
import Explainer from '@/ui/explainer'
import Gauge from '@/ui/gauge'

const n = (value: number) => Math.round(value).toLocaleString()

/** DESIGN.md Voice: "Daily burn unlocks". */
const UNLOCKED_LINE = 'Enough data. Here’s what you actually burn, measured, not guessed.'

/** Daily burn in Progress (0a: moved here from Settings). Measured from the
 *  user's own logs once there is enough of them: what they ate, against how
 *  their weight actually moved. Until then the block shows what unlocks it,
 *  three meters with the server's own sentence, rather than a formula's guess
 *  presented as a measurement (DESIGN.md: show what unlocks it).
 *
 *  `null` targets means the request failed. */
export default function DailyBurnBlock({ targets, onRetry }: { targets: BodyTargets | null; onRetry: () => void }) {
  const unlocking = useUnlockMoment('measured_burn', targets ? targets.tdee_source === 'measured' : undefined)
  useLiveMessage(unlocking ? UNLOCKED_LINE : null)

  if (!targets) {
    return (
      <Block label="Daily burn">
        <p className="border-l-2 border-ink pl-3 text-small">
          Couldn't load your daily burn.{' '}
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-3">
            Retry
          </button>
        </p>
      </Block>
    )
  }

  const basis = targets.tdee_basis

  if (targets.tdee_source === 'measured' && targets.tdee !== null && basis) {
    return (
      <Block label="Daily burn" value="Measured" className={unlocking ? 'animate-unlock' : undefined}>
        {unlocking && <p className="font-semibold">{UNLOCKED_LINE}</p>}
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-field-number text-[40px] tabular-nums">{n(targets.tdee)}</span>
          <span className="text-small text-ink-2">kcal a day, from your weigh-ins and logging</span>
        </p>
        <Explainer>
          <p>
            What you ate on {basis.logged_days} logged days, against how your weight moved across {basis.weigh_ins}{' '}
            weigh-ins over {basis.span_days} days. An unlogged day counts as “not logged”, never as “ate nothing”.
            {targets.tdee_estimated !== null &&
              ` A formula from your profile would have said ${n(targets.tdee_estimated)} kcal.`}
          </p>
          {targets.clamped_reason && <p className="mt-1.5">{targets.clamped_reason}</p>}
        </Explainer>
      </Block>
    )
  }

  // No basis: the profile is too incomplete for the server to even start.
  if (!basis) {
    return (
      <Block label="Daily burn">
        <p className="text-small text-ink-2">
          Add your height, birth year and a weigh-in in{' '}
          <Link to="/you/body" className="font-semibold text-ink underline underline-offset-3">
            You → Body and goal weight
          </Link>{' '}
          and it starts working this out.
        </p>
      </Block>
    )
  }

  const meters = [
    { label: 'Weigh-ins', have: basis.weigh_ins, need: TDEE_MIN_WEIGH_INS },
    { label: 'Days they cover', have: basis.span_days, need: TDEE_MIN_SPAN_DAYS },
    { label: 'Days logged', have: basis.logged_days, need: tdeeLoggedDaysNeeded(basis.span_days) },
  ]
  return (
    <Block label="Daily burn" value="Not measured yet">
      <p className="text-small text-ink-2">
        Measured from your own weigh-ins and meals over the last four weeks, once there are enough of them.
      </p>
      <ul className="grid gap-3">
        {meters.map((meter) => (
          <li key={meter.label} className="grid gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-small">
              <span>{meter.label}</span>
              <span className="font-semibold tabular-nums">
                {Math.min(meter.have, meter.need)} of {meter.need}
              </span>
            </span>
            <Gauge segments={10} lit={Math.min(10, Math.floor((meter.have / meter.need) * 10))} className="h-2" />
          </li>
        ))}
      </ul>
      {basis.unavailable_reason && <p className="text-small">{basis.unavailable_reason}</p>}
      {targets.tdee !== null && (
        <p className="text-small text-ink-2">
          Until then your target uses an estimate from your profile: {n(targets.tdee)} kcal a day.
        </p>
      )}
    </Block>
  )
}
