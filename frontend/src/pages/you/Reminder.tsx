import SettingsScreen from '../../components/you/SettingsScreen'
import { useSettingsScreen } from '../../components/you/screenContext'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Chip } from '@/ui/chip'
import Explainer from '@/ui/explainer'
import { FIELD } from '@/ui/field'

const DAYS = [
  { value: 1, label: 'A day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3 days' },
  { value: 7, label: 'A week' },
]

/** Weigh-in reminder, pushed from You: whether, when, and how often.
 *
 *  Two controls for two columns. The time carries the opt-in (empty is off),
 *  so there is no separate switch to disagree with it. The frequency is never
 *  empty, which stops it becoming a second way to spell "off", and it stays
 *  on screen while the reminder is off, so the two can be set in either
 *  order. */
export default function ReminderScreen() {
  return (
    <SettingsScreen title="Weigh-in reminder">
      <Reminder />
    </SettingsScreen>
  )
}

function Reminder() {
  const { settings, update } = useSettingsScreen()
  const days = settings.weigh_in_reminder_days
  // A frequency stored before these four chips existed still shows, as its
  // own chip, rather than looking unset.
  const options = DAYS.some((option) => option.value === days) ? DAYS : [...DAYS, { value: days, label: `${days} days` }]

  return (
    <Block>
      <p className="text-small text-ink-2">Shows as “Due today” on the Weigh-in card on Today.</p>
      <label className="grid gap-1.5">
        <span className="text-small text-ink-2">Remind me at (leave empty for off)</span>
        <input
          type="time"
          value={settings.weigh_in_reminder_time ?? ''}
          onChange={(event) => update({ weigh_in_reminder_time: event.target.value || null })}
          className={cn(FIELD, 'w-[140px]')}
        />
      </label>
      <div className="grid gap-1.5">
        <span id="reminder-days" className="text-small text-ink-2">
          After how long without a weigh-in
        </span>
        <div role="radiogroup" aria-labelledby="reminder-days" className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <Chip
              key={option.value}
              role="radio"
              pressed={days === option.value}
              onClick={() => update({ weigh_in_reminder_days: option.value })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>
      <Explainer label="Why not a phone notification?">
        Trackaholic runs in the browser, and a web app can't wake your phone reliably (on phones without Google services,
        not at all). So the reminder lives on Today, where you look anyway, and only while the app is open.
      </Explainer>
    </Block>
  )
}
