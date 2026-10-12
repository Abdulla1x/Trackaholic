import FoodDataCredits from '../../components/settings/FoodDataCredits'
import FoodLibrarySection from '../../components/settings/FoodLibrarySection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'

/** Food library, pushed from You: the foods the app has remembered on your
 *  behalf, in one place to correct. Writes straight to the server, so no Save
 *  bar ever appears here. */
export default function LibraryScreen() {
  return (
    <SettingsScreen title="Food library">
      <LibraryList />
    </SettingsScreen>
  )
}

function LibraryList() {
  const { onRejected } = useSettingsScreen()
  return (
    <div className="space-y-6 py-3.5">
      <FoodLibrarySection onRejected={onRejected} />
      <FoodDataCredits />
    </div>
  )
}
