import ScreenBar from '../../components/shell/ScreenBar'
import { useSettings } from '../../settings/SettingsContext'
import { useInstantSave } from '../../settings/useInstantSave'
import Block from '@/ui/block'
import { SwitchRow } from '@/ui/switch'

/** Appearance, from You: how the app looks. For now it holds what Today
 *  shows; the theme and colours join it next (overhaul 3b).
 *
 *  Meal times moved here from Goals: it changes what Today shows and is not a
 *  goal, so it read oddly there (decided from the 3a prototype). */
export default function Appearance() {
  const { settings } = useSettings()
  const saveNow = useInstantSave()
  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="Appearance" back="/you" backLabel="Back to You" />
      {settings && (
        <Block label="Today">
          <SwitchRow
            label="Show meal times"
            detail="When each meal was logged, beside it on Today"
            checked={settings.show_meal_times}
            onCheckedChange={(on) => saveNow({ show_meal_times: on })}
          />
        </Block>
      )}
    </div>
  )
}
