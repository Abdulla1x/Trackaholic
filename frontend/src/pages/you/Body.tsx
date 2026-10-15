import { useState } from 'react'
import GoalWeightField from '../../components/settings/GoalWeightField'
import HeightField from '../../components/settings/HeightField'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { ACTIVITY_OPTIONS, ACTIVITY_QUESTION } from '../../lib/activity'
import { PACE_CHIPS } from '../../lib/setup'
import { displayToKg, kgToDisplay } from '../../lib/units'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import Explainer from '@/ui/explainer'
import { FIELD } from '@/ui/field'
import { SettingNumber } from '@/ui/number-field'

type Direction = 'lose' | 'keep' | 'gain'

const SEXES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const

/** Body and goal weight, pushed from You: who the calculations are about, and
 *  where you are heading. Units sits on the You page itself and saves on tap;
 *  the height field follows it (centimetres, or feet and inches).
 *
 *  The pace is asked the way setup asks it: a direction, then how fast, so
 *  nobody has to type a minus sign to lose weight. Both are read back from the
 *  one signed number the server stores. */
export default function BodyScreen() {
  return (
    <SettingsScreen title="Body and goal weight">
      <BodyForm />
    </SettingsScreen>
  )
}

function BodyForm() {
  const { settings, update, guard } = useSettingsScreen()
  const unit = settings.weight_unit
  const rate = settings.goal_rate_kg_per_week
  const direction: Direction | null = rate === null ? null : rate === 0 ? 'keep' : rate < 0 ? 'lose' : 'gain'
  const sign = direction === 'lose' ? -1 : 1
  // How fast, in the person's unit, without the sign.
  const pace = rate === null || rate === 0 ? null : Math.round(Math.abs(kgToDisplay(rate, unit)) * 100) / 100
  const chips = PACE_CHIPS[unit]
  const matched = chips.find((chip) => pace !== null && Math.abs(Number(chip.value) - pace) < 0.01)
  // "My own" stays open once chosen, even if the typed pace happens to equal
  // a chip; it opens by itself for a stored pace no chip names.
  const [own, setOwn] = useState(pace !== null && !matched)

  const choose = (next: Direction) => {
    if (next === 'keep') {
      update({ goal_rate_kg_per_week: 0 })
      return
    }
    // Keep the pace when only the direction changes; otherwise start steady.
    const display = pace ?? Number(chips[1]?.value ?? 0.5)
    update({ goal_rate_kg_per_week: (next === 'lose' ? -1 : 1) * displayToKg(display, unit) })
  }

  return (
    <>
      <Block>
        <p className="text-small text-ink-2">Used to work out your target. Changing them moves it.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <HeightField settings={settings} update={update} onBlur={guard('height_cm')} />
          <label className="grid min-w-0 content-start gap-1.5">
            <span className="text-small text-ink-2">Date of birth</span>
            <input
              type="date"
              value={settings.birth_date ?? ''}
              onChange={(event) => update({ birth_date: event.target.value || null })}
              className={cn(FIELD, 'min-w-0')}
            />
          </label>
        </div>
        <div className="grid gap-1.5">
          <span id="body-sex" className="text-small text-ink-2">
            Sex, for the formula
          </span>
          <div role="radiogroup" aria-labelledby="body-sex" className="flex flex-wrap gap-1.5">
            {SEXES.map((option) => (
              <Chip
                key={option.value}
                role="radio"
                pressed={settings.sex === option.value}
                onClick={() => update({ sex: option.value })}
              >
                {option.label}
              </Chip>
            ))}
            <Chip role="radio" pressed={settings.sex === null} onClick={() => update({ sex: null })}>
              Not set
            </Chip>
          </div>
        </div>
        <Explainer label="Why does it ask?">
          The formula for your resting burn (Mifflin-St Jeor) only takes female or male. That is a limit of the formula,
          not of you. Without it, the target isn't worked out for you.
        </Explainer>
      </Block>

      <Block label="Activity">
        <p className="text-small text-ink-2">{ACTIVITY_QUESTION}</p>
        <div role="radiogroup" aria-label="Activity" className="grid divide-y divide-rule">
          {ACTIVITY_OPTIONS.map((option) => {
            const on = settings.activity_level === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ activity_level: option.value })}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                <span
                  aria-hidden="true"
                  className={cn('grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink', on && 'bg-ink')}
                >
                  {on && <span className="size-2 rounded-full bg-ground" />}
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-semibold">{option.name}</span>
                  <span className="text-small text-ink-2">{option.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Block>

      <Block label="Goal">
        <GoalWeightField settings={settings} update={update} onBlur={guard('goal_weight_kg')} />
        <div className="grid gap-1.5">
          <span id="body-direction" className="text-small text-ink-2">
            Your weight
          </span>
          <div role="radiogroup" aria-labelledby="body-direction" className="flex flex-wrap gap-1.5">
            {(
              [
                ['lose', 'Lose'],
                ['keep', 'Keep it'],
                ['gain', 'Gain'],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} role="radio" pressed={direction === value} onClick={() => choose(value)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        {(direction === 'lose' || direction === 'gain') && (
          <div className="grid gap-1.5">
            <span id="body-pace" className="text-small text-ink-2">
              How fast, per week
            </span>
            <div role="radiogroup" aria-labelledby="body-pace" className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Chip
                  key={chip.value}
                  role="radio"
                  pressed={!own && matched?.value === chip.value}
                  onClick={() => {
                    setOwn(false)
                    update({ goal_rate_kg_per_week: sign * displayToKg(Number(chip.value), unit) })
                  }}
                >
                  {chip.label}
                </Chip>
              ))}
              <Chip role="radio" pressed={own} onClick={() => setOwn(true)}>
                My own
              </Chip>
            </div>
            {own && (
              <SettingNumber
                id="body-pace-own"
                label="Pace"
                unit={`${unit} a week`}
                value={pace}
                onValue={(value) => value !== null && value > 0 && update({ goal_rate_kg_per_week: sign * displayToKg(value, unit) })}
                onBlur={guard('goal_rate_kg_per_week')}
                required
              />
            )}
          </div>
        )}
      </Block>
    </>
  )
}
