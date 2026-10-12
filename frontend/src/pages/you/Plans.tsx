import { Link, useSearchParams } from 'react-router-dom'
import CaloriePlanSection from '../../components/settings/CaloriePlanSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { targetIsSet } from '../../lib/today'
import Block from '@/ui/block'
import { Button } from '@/ui/button'

/** Calorie plans, pushed from You or from a day's numbers.
 *
 * The day being looked at arrives as ?plan=, and which form as ?kind=, so the
 * planner opens on that day's form. A search param rather than router state:
 * state does not survive a reload and cannot be bookmarked, and this app has
 * already shipped one bug from state outliving what it described. */
export default function PlansScreen() {
  return (
    <SettingsScreen title="Calorie plans">
      <Plans />
    </SettingsScreen>
  )
}

function Plans() {
  const { settings, onRejected } = useSettingsScreen()
  const [search] = useSearchParams()
  const planDate = search.get('plan') ?? undefined
  const kind = search.get('kind')
  const planKind = kind === 'planned' || kind === 'compensating' ? kind : undefined

  // Plans move a target between days, so there is nothing to plan until one
  // is chosen.
  if (!targetIsSet(settings)) {
    return (
      <Block>
        <p>Plans move your target between days, so they need a target first.</p>
        <div>
          <Button asChild>
            <Link to="/setup">Set my target</Link>
          </Button>
        </div>
      </Block>
    )
  }
  return <CaloriePlanSection onRejected={onRejected} initialDate={planDate} initialKind={planKind} />
}
