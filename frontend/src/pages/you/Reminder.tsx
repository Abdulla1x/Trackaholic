import WeighInReminderSection from '../../components/settings/WeighInReminderSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'

/** Weigh-in reminder, pushed from You. */
export default function ReminderScreen() {
  return (
    <SettingsScreen title="Weigh-in reminder">
      <Reminder />
    </SettingsScreen>
  )
}

function Reminder() {
  const { settings, update, guard } = useSettingsScreen()
  return (
    <div className="py-3.5">
      <WeighInReminderSection settings={settings} update={update} onBlur={guard('weigh_in_reminder_days')} />
    </div>
  )
}
