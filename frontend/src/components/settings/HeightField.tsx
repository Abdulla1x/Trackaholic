import { cmToFtIn, ftInToCm } from '../../lib/units'
import { SettingNumber } from '@/ui/number-field'
import type { Settings as SettingsType } from '../../types'

/** Height, in whichever unit the weight preference implies.
 *
 * The API is always centimetres; feet and inches exist only here and in
 * lib/units.ts. The round trip is stable — cmToFtIn rounds to the nearest inch
 * and ftInToCm to the nearest millimetre — so this can derive the displayed
 * feet/inches from the stored cm each render instead of holding a second copy
 * of the value that could drift out of step with it. */
export default function HeightField({
  settings,
  update,
  onBlur,
}: {
  settings: SettingsType
  update: (patch: Partial<SettingsType>) => void
  onBlur: () => void
}) {
  if (settings.weight_unit !== 'lb') {
    return (
      <SettingNumber
        id="body-height"
        label="Height"
        unit="cm"
        inputMode="numeric"
        value={settings.height_cm}
        onValue={(value) => update({ height_cm: value })}
        onBlur={onBlur}
      />
    )
  }

  const { feet, inches } = settings.height_cm ? cmToFtIn(settings.height_cm) : { feet: 0, inches: 0 }
  const set = (nextFeet: number | null, nextInches: number | null) => {
    // Both boxes empty means "not set", not "zero tall".
    if (nextFeet === null && nextInches === null) {
      update({ height_cm: null })
      return
    }
    update({ height_cm: ftInToCm(nextFeet ?? 0, nextInches ?? 0) })
  }

  // Stored in centimetres; shown in feet and inches because the weight unit
  // is pounds.
  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="mb-1.5 text-small text-ink-2">Height</legend>
      <div className="flex gap-3">
        <SettingNumber
          id="body-height-ft"
          label="Feet"
          unit="ft"
          inputMode="numeric"
          value={settings.height_cm ? feet : null}
          onValue={(value) => set(value, settings.height_cm ? inches : null)}
          onBlur={onBlur}
          className="[&_input]:w-[72px]"
        />
        <SettingNumber
          id="body-height-in"
          label="Inches"
          unit="in"
          inputMode="numeric"
          value={settings.height_cm ? inches : null}
          onValue={(value) => set(settings.height_cm ? feet : null, value)}
          onBlur={onBlur}
          className="[&_input]:w-[72px]"
        />
      </div>
    </fieldset>
  )
}
