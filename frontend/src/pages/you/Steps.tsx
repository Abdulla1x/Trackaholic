import StepsSection from '../../components/settings/StepsSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'

/** Steps, pushed from You. Its goals are columns on the settings row, so they
 *  wait for the Save bar. */
export default function StepsScreen() {
  return (
    <SettingsScreen title="Steps">
      <Steps />
    </SettingsScreen>
  )
}

function Steps() {
  const { settings, update, onRejected } = useSettingsScreen()
  return (
    <div className="py-3.5">
      <StepsSection settings={settings} update={update} onRejected={onRejected} />
    </div>
  )
}
