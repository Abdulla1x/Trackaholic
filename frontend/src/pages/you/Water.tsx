import WaterSection from '../../components/settings/WaterSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'

/** Water, pushed from You. Its goals are columns on the settings row, so they
 *  wait for the Save bar. */
export default function WaterScreen() {
  return (
    <SettingsScreen title="Water">
      <Water />
    </SettingsScreen>
  )
}

function Water() {
  const { settings, update, onRejected } = useSettingsScreen()
  return (
    <div className="py-3.5">
      <WaterSection settings={settings} update={update} onRejected={onRejected} />
    </div>
  )
}
