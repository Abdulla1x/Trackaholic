import SupplementsSection from '../../components/settings/SupplementsSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'

/** Supplements, pushed from You. Its own table with its own endpoints, so
 *  every change saves straight away and no Save bar appears. */
export default function SupplementsScreen() {
  return (
    <SettingsScreen title="Supplements">
      <Supplements />
    </SettingsScreen>
  )
}

function Supplements() {
  const { onRejected } = useSettingsScreen()
  return (
    <div className="py-3.5">
      <SupplementsSection onRejected={onRejected} />
    </div>
  )
}
