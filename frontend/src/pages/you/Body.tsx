import GoalWeightField from '../../components/settings/GoalWeightField'
import HeightField from '../../components/settings/HeightField'
import { ACTIVITY_HINT, ACTIVITY_OPTIONS, ACTIVITY_QUESTION, activityLine } from '../../lib/activity'
import { num } from '../../lib/parse'
import type { ActivityLevel, Sex } from '../../types'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import Card from '../../components/ui/Card'
import TextInput from '../../components/ui/TextInput'
import OptionChip from '../../components/ui/OptionChip'
import Field from '../../components/ui/Field'

const sexOptions: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

/** Body and goal weight, pushed from You: who the calculations are about.
 *  Units sits on the You page itself and saves on tap; HeightField follows it
 *  (centimetres, or feet and inches). */
export default function BodyScreen() {
  return (
    <SettingsScreen title="Body and goal weight">
      <BodyForm />
    </SettingsScreen>
  )
}

function BodyForm() {
  const { settings, update, guard } = useSettingsScreen()

  return (
    <div className="space-y-6 py-3.5">
      <Card as="section">
        <h2 className="mb-1 font-semibold">Body profile</h2>
        <p className="mb-4 text-sm text-slate-400">
          Optional, and the app works fine without it. Fill it in and we can work
          out your BMI, roughly what you burn in a day, and daily targets that
          follow your weight instead of staying where you first set them.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <HeightField settings={settings} update={update} onBlur={guard('height_cm')} />

          <Field label="Date of birth" caption="Stored as the date, so your age stays right without you editing it.">
            <TextInput
              type="date"
              value={settings.birth_date ?? ''}
              onChange={(event) => update({ birth_date: event.target.value || null })}
              className="w-full"
            />
          </Field>

          <Field className="sm:col-span-2" label={ACTIVITY_QUESTION} caption={ACTIVITY_HINT}>
            <TextInput as="select"
              value={settings.activity_level ?? ''}
              onChange={(event) =>
                update({
                  activity_level: (event.target.value || null) as ActivityLevel | null,
                })
              }
              className="w-full"
            >
              <option value="">Not set</option>
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {activityLine(option)}
                </option>
              ))}
            </TextInput>
          </Field>

          <div className="text-sm sm:col-span-2">
            <span className="mb-2 block text-slate-400">Sex</span>
            <div className="flex flex-wrap gap-3">
              {sexOptions.map(({ value, label }) => (
                <OptionChip key={value}>
                  <input
                    type="radio"
                    name="sex"
                    checked={settings.sex === value}
                    onChange={() => update({ sex: value })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  {label}
                </OptionChip>
              ))}
              {settings.sex !== null && (
                <button
                  type="button"
                  onClick={() => update({ sex: null })}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              The formula we use to estimate what you burn (Mifflin-St Jeor) only
              takes male or female. That is a limit of the formula, not of you —
              the field is optional, and everything else here still works without
              it.
            </p>
          </div>

          {/* Directly above the rate, and that adjacency is the point. Someone
              once typed their goal *weight* into the rate box and got a bare
              422; PR #15 added the guard, but the field they were reaching for
              did not exist until now. The guard's message can finally point
              somewhere instead of only saying what the box is not. */}
          <div className="sm:col-span-2">
            <GoalWeightField
              settings={settings}
              update={update}
              onBlur={guard('goal_weight_kg')}
            />
          </div>

          <Field className="sm:col-span-2" label="Goal rate (kg per week)"
            caption={
              <>
              How fast, not how heavy — the weight you're aiming for is the
              field above. Negative to lose, positive to gain, 0 to maintain.
              Leave it blank and we won't guess — "not set" and "maintain"
              aren't the same answer. Anything past 1 kg/week gets capped, and
              we'll say so.
              </>
            }
          >
            <TextInput
              type="number"
              step={0.05}
              value={settings.goal_rate_kg_per_week ?? ''}
              onChange={(event) =>
                update({ goal_rate_kg_per_week: num(event.target.value) })
              }
              onBlur={guard('goal_rate_kg_per_week')}
              className="w-full"
            />
          </Field>
        </div>
      </Card>

    </div>
  )
}
