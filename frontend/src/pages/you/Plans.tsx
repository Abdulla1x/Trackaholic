import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import CaloriePlanSection from '../../components/settings/CaloriePlanSection'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { localIsoDate } from '../../lib/dates'
import { planOrigin, type PlanOrigin } from '../../lib/planOrigin'
import { targetIsSet } from '../../lib/today'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { useToast } from '@/ui/toast'

/** Calorie plans, pushed from You or from a day's numbers.
 *
 * The day being looked at arrives as ?plan=, and which form as ?kind=, so the
 * planner opens on that day's form. A search param rather than router state:
 * state does not survive a reload and cannot be bookmarked, and this app has
 * already shipped one bug from state outliving what it described. Where it
 * was opened from arrives the same way, as ?from= (lib/planOrigin.ts): opened
 * from a day, Back, a saved plan and Cancel all lead back to that day. */
export default function PlansScreen() {
  const [search] = useSearchParams()
  const origin = planOrigin(search.get('from'), search.get('plan'), localIsoDate())
  return (
    <SettingsScreen title="Calorie plans" back={origin?.to} backLabel={origin?.label}>
      <Plans origin={origin} />
    </SettingsScreen>
  )
}

function Plans({ origin }: { origin: PlanOrigin | null }) {
  const { settings, onRejected } = useSettingsScreen()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const planDate = search.get('plan') ?? undefined
  const kind = search.get('kind')
  const planKind = kind === 'planned' || kind === 'compensating' ? kind : undefined
  // Back where it was opened. The day it lands on shows the moved target
  // itself, so the toast confirms the save rather than being the only sign.
  const done = origin
    ? (saved: boolean) => {
        if (saved) toast.show({ text: 'Plan saved' })
        navigate(origin.to)
      }
    : undefined

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
  return (
    <CaloriePlanSection onRejected={onRejected} initialDate={planDate} initialKind={planKind} onDone={done} />
  )
}
