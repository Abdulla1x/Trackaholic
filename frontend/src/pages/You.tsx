import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { useAppearance } from '../appearance/AppearanceContext'
import { useAuth } from '../auth/AuthContext'
import InstallSheet from '../components/install/InstallSheet'
import TrackersSheet from '../components/today/TrackersSheet'
import YourData from '../components/you/YourData'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { activityName } from '../lib/activity'
import { paletteName, type Appearance } from '../lib/appearance'
import { localIsoDate } from '../lib/dates'
import { livePairs, readDismissed } from '../lib/foodDuplicates'
import { installRoute } from '../lib/install'
import { isStandalone, useInstallState } from '../lib/installEvent'
import { DEFAULT_WATER_QUICK_ADDS } from '../lib/limits'
import { targetIsSet } from '../lib/today'
import { canChooseTrackers, CHANGE_TRACKERS, TRACKERS } from '../lib/trackers'
import { formatHeight, formatWeight, unitLabel } from '../lib/units'
import { useSettings } from '../settings/SettingsContext'
import { useInstantSave } from '../settings/useInstantSave'
import type { Food, FoodDuplicatePair, MealTemplate, Settings, Supplement, WaterDay } from '../types'
import { AlertDialog } from '@/ui/alert-dialog'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import { RowButton, RowLink } from '@/ui/row'
import { n } from '@/lib/format'
import Screen from '@/ui/screen'

/** A group of rows under one label, hairlines between them. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Block label={label}>
      <div className="grid divide-y divide-rule">{children}</div>
    </Block>
  )
}

function targetsDetail(settings: Settings, proteinFits: boolean): string {
  if (!targetIsSet(settings)) return 'Not set yet'
  const kcal = `${n(settings.calorie_goal)} kcal`
  if (settings.targets_auto && settings.protein_own) {
    return `${kcal} · ${n(settings.protein_goal)} g protein (yours)${proteinFits ? '' : " · doesn't fit"}`
  }
  const how = settings.targets_auto ? 'automatic' : 'your own numbers'
  return `${kcal} · ${n(settings.protein_goal)} g protein · ${how}`
}

function bodyDetail(settings: Settings): string {
  const parts = [
    settings.height_cm !== null && formatHeight(settings.height_cm, settings.weight_unit),
    settings.activity_level !== null && activityName(settings.activity_level),
    settings.goal_weight_kg !== null && `goal ${formatWeight(settings.goal_weight_kg, settings.weight_unit)} ${unitLabel(settings.weight_unit)}`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Not filled in yet'
}

function reminderDetail(settings: Settings): string {
  if (settings.weigh_in_reminder_time === null) return 'Off'
  const days = settings.weigh_in_reminder_days
  return `${settings.weigh_in_reminder_time} · after ${days === 1 ? 'a day' : `${days} days`} without one`
}

function waterDetail(settings: Settings, day: WaterDay | null): string {
  const buttons = (settings.water_quick_adds ?? DEFAULT_WATER_QUICK_ADDS).map((ml) => `+${n(ml)}`).join(' ')
  // The day's goal is the server's (it owns the formula); until it arrives,
  // a derived goal is described rather than guessed.
  const goal =
    settings.water_goal_ml !== null
      ? `${n(settings.water_goal_ml)} ml a day`
      : day
        ? `${n(day.goal_ml)} ml a day, from your weight`
        : 'Goal from your weight'
  return `${goal} · ${buttons}`
}

function supplementsDetail(items: Supplement[] | null): string {
  if (!items || items.length === 0) return 'What you take, and when'
  const doses = items.filter((item) => item.active).reduce((sum, item) => sum + item.times.length, 0)
  const paused = items.length - items.filter((item) => item.active).length
  const text = `${doses} ${doses === 1 ? 'dose' : 'doses'} a day`
  return paused > 0 ? `${text} · ${paused} paused` : text
}

function libraryDetail(foods: Food[] | null, pairs: FoodDuplicatePair[]): string {
  if (!foods) return 'Your foods, and where the numbers come from'
  if (foods.length === 0) return 'No foods saved yet'
  // The same pairs the library screen shows: dismissed ones on this device and
  // pairs missing a row are left out.
  const duplicates = livePairs(pairs, foods, readDismissed()).length
  const text = `${foods.length} ${foods.length === 1 ? 'food' : 'foods'}`
  return duplicates > 0 ? `${text} · ${duplicates} possible ${duplicates === 1 ? 'duplicate' : 'duplicates'}` : text
}

function savedMealsDetail(meals: MealTemplate[] | null): string {
  if (!meals) return 'Meals you log again and again'
  if (meals.length === 0) return 'None saved yet'
  return `${meals.length} saved ${meals.length === 1 ? 'meal' : 'meals'}`
}

const THEME_NAMES = { auto: 'Automatic', light: 'Light', dark: 'Dark' } as const

/** "Automatic · Daylight": the theme, then the palette, or "Dark · Label
 *  style", since palettes don't apply to Label. */
function appearanceDetail(appearance: Appearance): string {
  const look = appearance.style === 'label' ? 'Label style' : paletteName(appearance.palette)
  return `${THEME_NAMES[appearance.theme]} · ${look}`
}

function trackersDetail(settings: Settings): string | undefined {
  if (!settings.trackers) return undefined
  const names = ['Weigh-in', ...TRACKERS.filter((tracker) => settings.trackers?.includes(tracker.key)).map((tracker) => tracker.name)]
  return `Today shows ${names.join(', ')}`
}

/** You: every setting on one page, grouped from daily to rare, each row
 *  opening its own screen (overhaul 3a, chosen from a prototype).
 *
 *  Rows show the current value under their name, so most visits end here
 *  without opening anything. Units is the one setting answered on the page
 *  itself: two chips, saved on tap. */
export default function You() {
  const { settings, error } = useSettings()
  const { user, logout } = useAuth()
  const { appearance } = useAppearance()
  const saveNow = useInstantSave()
  const [choosingTrackers, setChoosingTrackers] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  // Add to home screen: offered wherever the popup could help, so not inside
  // the installed app and not on a computer without an install dialog.
  const [installing, setInstalling] = useState(false)
  const { canPrompt } = useInstallState()
  const [standalone] = useState(isStandalone)
  const canInstall =
    !standalone &&
    installRoute({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, canPrompt }) !== 'none'
  const [waterDay, setWaterDay] = useState<WaterDay | null>(null)
  const [supplements, setSupplements] = useState<Supplement[] | null>(null)
  const [foods, setFoods] = useState<Food[] | null>(null)
  const [pairs, setPairs] = useState<FoodDuplicatePair[]>([])
  const [meals, setMeals] = useState<MealTemplate[] | null>(null)
  // Small reads so the rows can say what is set. Any failing leaves its row
  // with the general wording, which is still true.
  useEffect(() => {
    let cancelled = false
    api.getWaterDay(localIsoDate()).then((day) => !cancelled && setWaterDay(day), () => {})
    api.getSupplements().then((items) => !cancelled && setSupplements(items), () => {})
    api.getFoods().then((items) => !cancelled && setFoods(items), () => {})
    api.getFoodDuplicates().then((items) => !cancelled && setPairs(items), () => {})
    api.getMealTemplates().then((items) => !cancelled && setMeals(items), () => {})
    return () => {
      cancelled = true
    }
  }, [])
  // Only typed protein can stop fitting, so only then is it asked.
  const ownProtein = Boolean(settings?.targets_auto && settings.protein_own)
  const [proteinFits, setProteinFits] = useState(true)
  useEffect(() => {
    if (!ownProtein) return
    let cancelled = false
    api.getBodyTargets().then((body) => !cancelled && setProteinFits(body.protein_fits ?? true), () => {})
    return () => {
      cancelled = true
    }
  }, [ownProtein, settings?.protein_goal, settings?.calorie_goal])
  useLiveMessage(error)

  return (
    <Screen>
      <header className="border-b border-rule pb-1.5 text-center desk:text-left label:border-b-[5px]">
        <h1 className="pt-2.5 text-title label:text-[18px] label:font-black label:tracking-[-0.01em]">You</h1>
        {user && <p className="truncate pb-1 text-small text-ink-2">{user.email}</p>}
      </header>

      {!settings ? (
        <p className="py-3.5 text-ink-2">{error || 'Loading…'}</p>
      ) : (
        <>
          <Group label="Goals and body">
            <RowLink to="/you/targets" label="Daily targets" detail={targetsDetail(settings, proteinFits)} />
            <RowLink to="/you/plans" label="Calorie plans" detail="Plan a bigger day, or make one up" />
            <RowLink to="/you/body" label="Body and goal weight" detail={bodyDetail(settings)} />
            <div className="flex min-h-[52px] items-center justify-between gap-3 py-2">
              <span id="units-label" className="font-semibold">
                Units
              </span>
              <div role="radiogroup" aria-labelledby="units-label" className="flex gap-1.5">
                {(['kg', 'lb'] as const).map((unit) => (
                  <Chip
                    key={unit}
                    role="radio"
                    pressed={settings.weight_unit === unit}
                    onClick={() => settings.weight_unit !== unit && saveNow({ weight_unit: unit })}
                  >
                    {unit}
                  </Chip>
                ))}
              </div>
            </div>
          </Group>

          <Group label="Trackers">
            <RowLink to="/you/reminder" label="Weigh-in reminder" detail={reminderDetail(settings)} />
            <RowLink
              to="/you/water"
              label="Water"
              detail={waterDetail(settings, waterDay)}
            />
            <RowLink
              to="/you/steps"
              label="Steps"
              detail={settings.steps_goal === null ? 'No goal · import your history' : `${n(settings.steps_goal)} a day`}
            />
            <RowLink to="/you/supplements" label="Supplements" detail={supplementsDetail(supplements)} />
            {canChooseTrackers(settings) && (
              <RowButton
                label={CHANGE_TRACKERS}
                detail={trackersDetail(settings)}
                chevron
                onClick={() => setChoosingTrackers(true)}
              />
            )}
          </Group>

          <Group label="Food">
            <RowLink to="/you/library" label="Food library" detail={libraryDetail(foods, pairs)} />
            <RowLink to="/you/saved-meals" label="Saved meals" detail={savedMealsDetail(meals)} />
          </Group>

          <Group label="Appearance">
            <RowLink
              to="/you/appearance"
              label="Appearance"
              detail={appearanceDetail(appearance)}
            />
          </Group>

          <Group label="Your data">
            <YourData />
          </Group>

          <Group label="Account">
            <RowLink to="/you/password" label={user?.has_password === false ? 'Set a password' : 'Change password'} />
            <RowButton label="Log out" onClick={() => setLoggingOut(true)} />
            <RowLink to="/you/delete" label="Delete account" detail="Deletes everything for good" />
          </Group>

          <Group label="Help">
            {canInstall && (
              <RowButton
                label="Add to home screen"
                detail="Open it in one tap, like any other app"
                chevron
                onClick={() => setInstalling(true)}
              />
            )}
            <RowLink to="/how-it-works" label="How Trackaholic works" detail="And things you might have missed" />
            <RowLink to="/whats-new" label="What's new" detail="Release notes" />
            <RowLink to="/you/contact" label="Contact" detail="Questions or feedback by email" />
            <RowLink to="/privacy" label="Privacy" detail="What's stored, and where it goes" />
          </Group>

          <TrackersSheet open={choosingTrackers} onOpenChange={setChoosingTrackers} />
          <InstallSheet open={installing} onClose={() => setInstalling(false)} />
          <AlertDialog
            open={loggingOut}
            title="Log out?"
            confirm="Log out"
            onCancel={() => setLoggingOut(false)}
            onConfirm={logout}
          >
            Your data stays on your account.
          </AlertDialog>
        </>
      )}
    </Screen>
  )
}
