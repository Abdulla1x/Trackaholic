import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import TrackersSheet from '../components/today/TrackersSheet'
import { useLiveMessage } from '../hooks/useLiveMessage'
import { activityName } from '../lib/activity'
import { targetIsSet } from '../lib/today'
import { canChooseTrackers, CHANGE_TRACKERS, TRACKERS } from '../lib/trackers'
import { formatHeight, formatWeight, unitLabel } from '../lib/units'
import { useSettings } from '../settings/SettingsContext'
import { useInstantSave } from '../settings/useInstantSave'
import type { Settings } from '../types'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import { RowButton, RowLink } from '@/ui/row'

const n = (value: number) => Math.round(value).toLocaleString()

/** A group of rows under one label, hairlines between them. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Block label={label}>
      <div className="grid divide-y divide-rule">{children}</div>
    </Block>
  )
}

function targetsDetail(settings: Settings): string {
  if (!targetIsSet(settings)) return 'Not set yet'
  const how = settings.targets_auto ? 'automatic' : 'your own numbers'
  return `${n(settings.calorie_goal)} kcal · ${n(settings.protein_goal)} g protein · ${how}`
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
  const { user } = useAuth()
  const saveNow = useInstantSave()
  const [choosingTrackers, setChoosingTrackers] = useState(false)
  useLiveMessage(error)

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <header className="border-b border-rule pb-1.5 text-center desk:text-left">
        <h1 className="pt-2.5 text-title">You</h1>
        {user && <p className="truncate pb-1 text-small text-ink-2">{user.email}</p>}
      </header>

      {!settings ? (
        <p className="py-3.5 text-ink-2">{error || 'Loading…'}</p>
      ) : (
        <>
          <Group label="Goals and body">
            <RowLink to="/you/targets" label="Daily targets" detail={targetsDetail(settings)} />
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
              detail={settings.water_goal_ml === null ? 'Goal from your weight' : `${n(settings.water_goal_ml)} ml a day`}
            />
            <RowLink
              to="/you/steps"
              label="Steps"
              detail={settings.steps_goal === null ? 'No goal · import your history' : `${n(settings.steps_goal)} a day`}
            />
            <RowLink to="/you/supplements" label="Supplements" detail="What you take, and when" />
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
            <RowLink to="/you/library" label="Food library" detail="Your foods, and where the numbers come from" />
            <RowLink to="/you/saved-meals" label="Saved meals" detail="Meals you log again and again" />
          </Group>

          <Group label="Account">
            <RowLink to="/you/account" label="Account and data" detail="Password, export, import, delete" />
          </Group>

          <Group label="Help">
            <RowLink to="/how-it-works" label="How Trackaholic works" detail="And things you might have missed" />
            <RowLink to="/whats-new" label="What’s new" detail="Release notes" />
            <RowLink to="/you/contact" label="Contact" detail="Questions or feedback by email" />
          </Group>

          <TrackersSheet open={choosingTrackers} onOpenChange={setChoosingTrackers} />
        </>
      )}
    </div>
  )
}
