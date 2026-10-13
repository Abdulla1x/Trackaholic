import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { proteinSplit, type FatState } from '../../lib/proteinSplit'
import { targetIsSet } from '../../lib/today'
import { formatWeight, unitLabel } from '../../lib/units'
import { useSettings } from '../../settings/SettingsContext'
import { useInstantSave } from '../../settings/useInstantSave'
import type { BodyTargets, ProteinFocusKey, Settings } from '../../types'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { Chip } from '@/ui/chip'
import { ExpandIcon } from '@/ui/icons'
import { SettingNumber } from '@/ui/number-field'
import { Stat, StatGrid } from '@/ui/stat'
import { SwitchRow } from '@/ui/switch'

type Goal = 'calorie_goal' | 'protein_goal' | 'carbs_goal' | 'fat_goal'

const GOALS: { key: Goal; label: string; unit: string }[] = [
  { key: 'calorie_goal', label: 'Calories', unit: 'kcal' },
  { key: 'protein_goal', label: 'Protein', unit: 'g' },
  { key: 'carbs_goal', label: 'Carbs', unit: 'g' },
  { key: 'fat_goal', label: 'Fat', unit: 'g' },
]

// What the server's `missing` names, in words. Keyed on what the API returns,
// so a field added there without a label here still shows *something*.
const MISSING: Record<string, string> = {
  weight: 'a weigh-in',
  height_cm: 'your height',
  birth_date: 'your date of birth',
  sex: 'your sex',
  activity_level: 'how active you are',
  goal_rate_kg_per_week: 'how fast to go',
}

const FOCUS: { key: 'muscle' | 'scale'; label: string }[] = [
  { key: 'muscle', label: 'Keep or build muscle' },
  { key: 'scale', label: 'Just the scale' },
]

const FAT_DETAIL: Record<FatState, string> = {
  quarter: 'A quarter of the day',
  less: 'Less, to make room for protein',
  minimum: 'At its minimum',
}

const n = (value: number) => Math.round(value).toLocaleString()

const shows = (settings: Settings, key: Goal) =>
  key === 'carbs_goal' ? settings.track_carbs : key === 'fat_goal' ? settings.track_fat : true

/** "What matters most to you?", with your own number as a third answer: the
 *  protein it gives and the split around it. Null without what each answer
 *  would give, which the live API on the preview doesn't send; the screen is
 *  then as it was.
 *
 *  Unchanged since the save, it shows the stored goals, which Today uses. The
 *  live split takes over once the choice moves, because the server's
 *  worked-out numbers can drift between weigh-ins. */
function proteinChoice(draft: Settings, saved: Settings, targets: BodyTargets | null) {
  const byFocus = targets?.protein_by_focus
  const referenceKg = targets?.protein_reference_kg
  if (!byFocus || referenceKg == null) return null
  const own = draft.protein_own ?? false
  const workedOut = byFocus[(draft.protein_focus ?? 'unanswered') as ProteinFocusKey].g
  const split = proteinSplit(draft.calorie_goal, referenceKg, workedOut, own ? draft.protein_goal : workedOut)
  const changed =
    own !== (saved.protein_own ?? false) ||
    draft.protein_focus !== saved.protein_focus ||
    (own && draft.protein_goal !== saved.protein_goal)
  return {
    own,
    workedOut,
    // Carbs that don't fit are stored as the 1 g floor every written goal
    // has; they are 0, and the warning says so.
    shown: changed
      ? split
      : { ...split, protein: draft.protein_goal, carbs: split.fits ? draft.carbs_goal : 0, fat: draft.fat_goal },
    // Saved, and a weigh-in since has lowered calories under it.
    noLongerFits: !changed && own && targets?.protein_fits === false,
  }
}

/** Daily targets, pushed from You (UA-11).
 *
 *  While the target is worked out for you, it shows the numbers as numbers,
 *  not as greyed-out boxes that look editable and refuse the tap. "My own
 *  numbers" turns them into fields. How the number is worked out is one tap
 *  away, on the page that already explains it step by step, rather than
 *  repeated here. */
export default function TargetsScreen() {
  return (
    <SettingsScreen title="Daily targets">
      <Targets />
    </SettingsScreen>
  )
}

function Targets() {
  const { settings: draft, update, guard, targetsKey } = useSettingsScreen()
  const { settings: saved } = useSettings()
  const saveNow = useInstantSave()
  const [targets, setTargets] = useState<BodyTargets | null>(null)

  // Only automatic targets can be missing an input. Refetched after every save
  // (targetsKey), so filling in the profile clears the note and the protein
  // choices follow what was saved.
  useEffect(() => {
    if (!saved?.targets_auto) return
    let cancelled = false
    api
      .getBodyTargets()
      .then((body: BodyTargets) => !cancelled && setTargets(body))
      .catch(() => !cancelled && setTargets(null))
    return () => {
      cancelled = true
    }
  }, [saved?.targets_auto, targetsKey])
  const missing = targets?.missing ?? []

  const trackSwitches = (
    <Block label="Also track">
      <div className="grid divide-y divide-rule">
        {(
          [
            ['track_carbs', 'Carbs'],
            ['track_fat', 'Fat'],
          ] as const
        ).map(([key, label]) => (
          <SwitchRow
            key={key}
            label={label}
            detail="Shown on Today and in Progress"
            checked={draft[key]}
            onCheckedChange={(on) => saveNow({ [key]: on })}
          />
        ))}
      </div>
    </Block>
  )

  if (!targetIsSet(draft)) {
    return (
      <>
        <Block>
          <p className="font-semibold">No target yet.</p>
          <p className="text-small text-ink-2">
            A few questions about you and your goal, and it works out your calories and protein.
          </p>
          <div>
            <Button asChild>
              <Link to="/setup">Set my target</Link>
            </Button>
          </div>
        </Block>
        {trackSwitches}
      </>
    )
  }

  const goals = GOALS.filter((goal) => shows(draft, goal.key))
  // Switched to automatic but not saved yet: the numbers on the row are still
  // the typed ones, so they are not shown as if they were worked out.
  const switchingToAuto = draft.targets_auto && !saved?.targets_auto

  const byFocus = targets?.protein_by_focus
  const referenceKg = targets?.protein_reference_kg
  const protein =
    draft.targets_auto && !switchingToAuto && missing.length === 0 && saved ? proteinChoice(draft, saved, targets) : null

  const statDetail = (key: Goal) => {
    if (!protein) return undefined
    if (key === 'calorie_goal') return 'Worked out'
    if (key === 'protein_goal')
      return protein.own ? <span className="font-semibold text-plan">Yours</span> : 'Worked out'
    if (key === 'carbs_goal') return "What's left"
    return FAT_DETAIL[protein.shown.fatState]
  }
  const statValue = (key: Goal) =>
    !protein || key === 'calorie_goal'
      ? draft[key]
      : protein.shown[key === 'protein_goal' ? 'protein' : key === 'carbs_goal' ? 'carbs' : 'fat']
  const weight = referenceKg == null ? '' : `${formatWeight(referenceKg, draft.weight_unit)} ${unitLabel(draft.weight_unit)}`

  return (
    <>
      <Block>
        <div role="radiogroup" aria-label="How your target is set" className="flex flex-wrap gap-1.5">
          <Chip role="radio" pressed={draft.targets_auto} onClick={() => update({ targets_auto: true })}>
            Work it out for me
          </Chip>
          <Chip role="radio" pressed={!draft.targets_auto} onClick={() => update({ targets_auto: false })}>
            My own numbers
          </Chip>
        </div>
      </Block>

      {draft.targets_auto ? (
        <Block>
          {switchingToAuto ? (
            <p className="text-small text-ink-2">Save, and your numbers are replaced by worked-out ones.</p>
          ) : (
            <>
              <StatGrid>
                {goals.map((goal) => (
                  <Stat key={goal.key} label={goal.label} unit={goal.unit} detail={statDetail(goal.key)}>
                    {n(statValue(goal.key))}
                  </Stat>
                ))}
              </StatGrid>
              {protein?.noLongerFits && (
                <div role="status" className="grid gap-1 border-l-2 border-plan pl-3">
                  <p className="font-semibold">Your protein no longer fits.</p>
                  <p className="text-small">
                    Your calories are now {n(draft.calorie_goal)} kcal, which leaves room for up to{' '}
                    {n(protein.shown.maxProtein)} g. Until you lower it, carbs are at 0 g and fat is at its minimum.
                  </p>
                </div>
              )}
              {missing.length > 0 ? (
                <p className="text-small text-ink-2">
                  Needs {missing.map((field) => MISSING[field] ?? field).join(', ')} to work these out.{' '}
                  <Link to="/you/body" className="font-semibold text-ink underline underline-offset-3">
                    Body and goal weight
                  </Link>
                </p>
              ) : (
                <p className="text-small text-ink-2">Worked out from your body and goal, and it follows your weight.</p>
              )}
              <Link
                to="/how-it-works/target"
                className="inline-flex min-h-8 items-center gap-1 justify-self-start text-small text-ink-2 underline underline-offset-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                How is this worked out?
                <ExpandIcon size={14} aria-hidden="true" className="-rotate-90" />
              </Link>
            </>
          )}
        </Block>
      ) : (
        <Block>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {goals.map((goal) => (
              <SettingNumber
                key={goal.key}
                id={`goal-${goal.key}`}
                label={goal.label}
                unit={goal.unit}
                inputMode="numeric"
                required
                value={draft[goal.key]}
                onValue={(value) => value !== null && update({ [goal.key]: value })}
                onBlur={guard(goal.key)}
              />
            ))}
          </div>
          {(draft.track_carbs || draft.track_fat) && (
            <p className="text-small text-ink-2">Carbs and fat have to fit inside the calories.</p>
          )}
        </Block>
      )}

      {protein && byFocus && (
        <Block label="Protein">
          <p id="protein-focus-label" className="text-small text-ink-2">
            What matters most to you?
          </p>
          <div role="radiogroup" aria-labelledby="protein-focus-label" className="flex flex-wrap gap-1.5">
            {FOCUS.map((focus) => (
              <Chip
                key={focus.key}
                role="radio"
                pressed={!protein.own && draft.protein_focus === focus.key}
                onClick={() => update({ protein_focus: focus.key, protein_own: false })}
              >
                {focus.label}
              </Chip>
            ))}
            <Chip
              role="radio"
              pressed={protein.own}
              // Starts from the protein on screen, so nothing jumps until
              // a new number is typed.
              onClick={() => !protein.own && update({ protein_own: true, protein_goal: protein.shown.protein })}
            >
              My own number
            </Chip>
          </div>
          {protein.own ? (
            <>
              <div className="max-w-[12rem]">
                <SettingNumber
                  id="goal-protein-own"
                  label="Protein"
                  unit="g a day"
                  inputMode="numeric"
                  required
                  value={draft.protein_goal}
                  onValue={(value) => value !== null && update({ protein_goal: value })}
                  onBlur={guard('protein_goal')}
                />
              </div>
              <p className="text-small text-ink-2">
                Suggested for your goal: {n(byFocus.muscle.low_g)}–{n(byFocus.muscle.high_g)} g (muscle) or{' '}
                {n(byFocus.scale.low_g)}–{n(byFocus.scale.high_g)} g (just the scale).
              </p>
            </>
          ) : (
            <p className="text-small text-ink-2">
              {n(protein.workedOut)} g a day, from {weight}.
            </p>
          )}
        </Block>
      )}

      {trackSwitches}
    </>
  )
}
