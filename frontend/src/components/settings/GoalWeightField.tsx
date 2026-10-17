import { useState } from 'react'
import { NumberField } from '@/ui/number-field'
import { goalWeightAdvice } from '../../lib/limits'
import { num } from '../../lib/parse'
import { kgToDisplay, displayToKg, unitLabel } from '../../lib/units'
import type { Settings as SettingsType } from '../../types'

/** The weight being aimed for, in whichever unit the weight preference implies.
 *
 * The API is always kilograms; pounds exist only here and in lib/units.ts, the
 * same arrangement HeightField has with centimetres.
 *
 * ⚠️ Unlike HeightField this does NOT derive the shown value from the stored
 * one on every render. It cannot: feet and inches are whole numbers, so that
 * round trip is stable, but a weight has a decimal place. Typing "78." would
 * parse to 78, convert, convert back, and render as "78" — deleting the point
 * the moment it was typed. "A controlled input bound to a round-trip is
 * unresponsive by construction" is a bug this project has already shipped once.
 *
 * So the typed text is held locally *while the field has focus* and the derived
 * value is shown the rest of the time. That keeps the two things that must
 * still work: switching units re-renders the box in the new unit, and the
 * out-of-range guard undoing a value on blur is visible immediately, because
 * blur is exactly when the local copy stops being used.
 */
export default function GoalWeightField({
  settings,
  update,
  onBlur,
}: {
  settings: SettingsType
  update: (patch: Partial<SettingsType>) => void
  onBlur: () => void
}) {
  const [typed, setTyped] = useState<string | null>(null)
  const unit = settings.weight_unit
  const label = unitLabel(unit)
  const stored = settings.goal_weight_kg

  // Rounded to one decimal — the precision a scale reports — and passed
  // through Number so a whole value shows as "78" rather than "78.0".
  const derived =
    stored === null ? '' : String(Number(kgToDisplay(stored, unit).toFixed(1)))
  const advice = goalWeightAdvice(stored, settings.height_cm)

  return (
    <div className="grid min-w-0 gap-1.5">
      <NumberField
        id="body-goal-weight"
        label="Goal weight"
        unit={label}
        placeholder="None"
        value={typed ?? derived}
        onChange={(text) => {
          setTyped(text)
          const entered = num(text)
          update({ goal_weight_kg: entered === null ? null : displayToKg(entered, unit) })
        }}
        onBlur={() => {
          setTyped(null)
          onBlur()
        }}
      />
      {advice && <p className="text-small text-ink-2">{advice}</p>}
    </div>
  )
}
