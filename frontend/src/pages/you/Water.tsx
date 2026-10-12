import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { localIsoDate } from '../../lib/dates'
import {
  DEFAULT_WATER_QUICK_ADDS,
  MAX_WATER_QUICK_ADDS,
  validateWaterQuickAdd,
  WATER_ML_PER_KG,
} from '../../lib/limits'
import { useSettings } from '../../settings/SettingsContext'
import type { WaterDay } from '../../types'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import Explainer from '@/ui/explainer'
import { SettingNumber } from '@/ui/number-field'

/** What "My own" starts at when it is first chosen. */
const OWN_GOAL_ML = 2500

/** Water, pushed from You: where the daily goal comes from, and the quick-add
 *  buttons on the Today card. All of it is columns on the settings row, so it
 *  waits for the Save bar.
 *
 *  The goal is a pair of chips rather than a "leave blank to derive it" box,
 *  because an empty box does not say what an empty box means. "From my
 *  weight" writes null, which is what the server reads as "derive it". */
export default function WaterScreen() {
  return (
    <SettingsScreen title="Water">
      <Water />
    </SettingsScreen>
  )
}

function Water() {
  const { settings, update, guard, onRejected, targetsKey } = useSettingsScreen()
  const { settings: saved } = useSettings()
  const derived = settings.water_goal_ml === null
  const quickAdds = settings.water_quick_adds ?? DEFAULT_WATER_QUICK_ADDS
  const [day, setDay] = useState<WaterDay | null>(null)

  // The worked-out goal comes from the server, which owns the formula and the
  // trend weight it reads. Refetched after each save (targetsKey).
  useEffect(() => {
    let cancelled = false
    api
      .getWaterDay(localIsoDate())
      .then((next) => !cancelled && setDay(next))
      .catch(() => !cancelled && setDay(null))
    return () => {
      cancelled = true
    }
  }, [targetsKey])

  // A blank box drops that button rather than storing a zero, so the boxes can
  // express anywhere from one button up to MAX_WATER_QUICK_ADDS without extra
  // UI. The count comes from the constant rather than from the length of
  // DEFAULT_WATER_QUICK_ADDS, which has three entries and is where an
  // off-by-one once came from: the server accepts four and the fourth box was
  // never rendered.
  //
  // The list is compacted on every edit, and that is not tidiness. Assigning
  // past the end of a shorter array leaves a *hole* — clear two boxes, type
  // into the third, and you get [300, <empty>, 500]. JSON.stringify writes a
  // hole as `null`, the server refuses null for a float, and the user gets a
  // 422 they cannot act on for a field they cannot see is wrong. `filter`
  // skips holes, which is what makes this the fix rather than a workaround.
  const setQuickAdd = (index: number, ml: number | null) => {
    const next = [...quickAdds]
    if (ml === null) next.splice(index, 1)
    else next[index] = ml
    const dense = next.filter((value) => Number.isFinite(value))
    update({ water_quick_adds: dense.length > 0 ? dense : null })
  }

  const guardQuickAdd = (index: number) => () => {
    const problem = validateWaterQuickAdd(quickAdds[index] ?? null)
    if (!problem) return
    onRejected(problem)
    // Undone back to the saved amount, the same rule the other fields follow
    // (`guard`). Dropping the button instead would make a typo on 250 delete
    // the 250.
    const before = (saved?.water_quick_adds ?? DEFAULT_WATER_QUICK_ADDS)[index]
    const next = [...quickAdds]
    if (before === undefined) next.splice(index, 1)
    else next[index] = before
    update({ water_quick_adds: next.length > 0 ? next : null })
  }

  // The saved row is still the derived one, so the day's goal is the worked-out
  // number; otherwise "From my weight" is only chosen in the draft so far.
  const workedOut = saved?.water_goal_ml === null && day ? day : null

  return (
    <>
      <Block label="Daily goal">
        <div role="radiogroup" aria-label="Where the daily goal comes from" className="flex flex-wrap gap-1.5">
          <Chip role="radio" pressed={derived} onClick={() => update({ water_goal_ml: null })}>
            From my weight
          </Chip>
          <Chip
            role="radio"
            pressed={!derived}
            onClick={() => derived && update({ water_goal_ml: saved?.water_goal_ml ?? OWN_GOAL_ML })}
          >
            My own
          </Chip>
        </div>
        {derived ? (
          <>
            <p className="text-small text-ink-2">
              {!workedOut
                ? `${WATER_ML_PER_KG} ml for every kg you weigh.`
                : workedOut.goal_basis.source === 'weight'
                  ? `${workedOut.goal_ml.toLocaleString()} ml for your weight.`
                  : `${workedOut.goal_ml.toLocaleString()} ml until your first weigh-in.`}
            </p>
            <Explainer>
              {WATER_ML_PER_KG} ml for every kg of your trend weight, rounded to 50 ml. That is a common rule of thumb,
              not a medical one: drink to thirst, and more in heat or when you exercise.
            </Explainer>
          </>
        ) : (
          <SettingNumber
            id="water-goal"
            label="Goal"
            unit="ml"
            inputMode="numeric"
            // Required: an empty box would send null, which the server reads
            // as "from my weight", flipping the chip behind your back.
            required
            value={settings.water_goal_ml}
            onValue={(value) => value !== null && update({ water_goal_ml: value })}
            onBlur={guard('water_goal_ml')}
          />
        )}
      </Block>

      <Block label="Quick-add buttons">
        <p className="text-small text-ink-2">The buttons on the Water card. Clear one to remove it.</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 desk:grid-cols-4">
          {Array.from({ length: MAX_WATER_QUICK_ADDS }).map((_, index) => (
            <SettingNumber
              key={index}
              id={`water-quick-${index}`}
              label={`Button ${index + 1}`}
              unit="ml"
              inputMode="numeric"
              value={quickAdds[index] ?? null}
              onValue={(value) => setQuickAdd(index, value)}
              onBlur={guardQuickAdd(index)}
            />
          ))}
        </div>
      </Block>
    </>
  )
}
