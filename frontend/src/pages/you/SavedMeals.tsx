import SavedMealsSection from '../../components/settings/SavedMealsSection'
import SettingsScreen from '../../components/you/SettingsScreen'

/** Saved meals, pushed from You. Writes straight to the server. */
export default function SavedMealsScreen() {
  return (
    <SettingsScreen title="Saved meals">
      <div className="py-3.5">
        <SavedMealsSection />
      </div>
    </SettingsScreen>
  )
}
