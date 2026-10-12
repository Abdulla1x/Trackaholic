import AccountSection from '../../components/settings/AccountSection'
import SettingsScreen from '../../components/you/SettingsScreen'

/** Password, export and deletion, pushed from You. Writes immediately, so no
 *  Save bar appears here. */
export default function AccountScreen() {
  return (
    <SettingsScreen title="Account and data">
      <div className="space-y-6 py-3.5">
        <AccountSection />
      </div>
    </SettingsScreen>
  )
}
