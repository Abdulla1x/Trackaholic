import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../../api/client'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { localIsoDate } from '../../lib/dates'
import { shownTrackers, TRACKERS, WEIGH_IN_DESCRIPTION, withTracker, type TrackerKey } from '../../lib/trackers'
import { useSettings } from '../../settings/SettingsContext'
import { Button } from '@/ui/button'
import { DoneIcon, StepsIcon, SupplementsIcon, WaterIcon, WeighInIcon } from '@/ui/icons'
import Sheet from '@/ui/sheet'

const TRACKER_ICONS: Record<TrackerKey, ReactNode> = {
  water: <WaterIcon size={22} aria-hidden />,
  steps: <StepsIcon size={22} aria-hidden />,
  supplements: <SupplementsIcon size={22} aria-hidden />,
}

function Row({ icon, name, description, action }: { icon: ReactNode; name: string; description: string; action: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 py-2">
      <span className="shrink-0 text-ink-2">{icon}</span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold">{name}</span>
        <span className="text-small text-ink-2">{description}</span>
      </span>
      {action}
    </li>
  )
}

/** "Add or remove trackers" (first-use prototype, 2026-10-11): every tracker
 *  in one list, the weigh-in first and always on, each of the others with Add
 *  or Remove. A change is saved as it is made, so there is no Save button to
 *  forget; removing one hides the card and keeps its history.
 *
 *  Undo is pressing Add again, in the same place: a toast would sit under the
 *  sheet's scrim, where nothing can be pressed. */
export default function TrackersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { settings, updateSettings } = useSettings()
  const [hasSupplements, setHasSupplements] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useLiveMessage(note)

  // Before a choice is stored, Supplements is on Today only while something
  // is scheduled, so the list asks the same question the card does.
  const legacy = settings?.trackers == null
  useEffect(() => {
    if (!open || !legacy) return
    let live = true
    api
      .getSupplementDay(localIsoDate())
      .then((day) => live && setHasSupplements(day.slots.length > 0))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [open, legacy])

  useEffect(() => {
    if (open) setNote(null)
  }, [open])

  if (!settings) return null
  const current = shownTrackers(settings, hasSupplements)

  const change = async (key: TrackerKey, on: boolean, name: string) => {
    setBusy(true)
    try {
      await updateSettings({ ...settings, trackers: withTracker(current, key, on) })
      setNote(on ? `${name} added to Today.` : `${name} removed from Today. Its history is kept.`)
    } catch {
      setNote("That didn't save. Check your connection, then try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Trackers on Today">
      <ul className="divide-y divide-rule">
        <Row
          icon={<WeighInIcon size={22} aria-hidden />}
          name="Weigh-in"
          description={WEIGH_IN_DESCRIPTION}
          action={
            <span className="flex items-center gap-1 text-small text-ink-2">
              <DoneIcon size={16} aria-hidden />
              On
            </span>
          }
        />
        {TRACKERS.map(({ key, name, description }) => {
          const on = current.includes(key)
          return (
            <Row
              key={key}
              icon={TRACKER_ICONS[key]}
              name={name}
              description={description}
              action={
                <Button
                  variant={on ? 'ghost' : 'secondary'}
                  disabled={busy}
                  onClick={() => change(key, !on, name)}
                  aria-label={`${on ? 'Remove' : 'Add'} ${name}`}
                >
                  {on ? 'Remove' : 'Add'}
                </Button>
              }
            />
          )
        })}
      </ul>
      {note && (
        <p aria-hidden="true" className="pt-2 text-small text-ink-2">
          {note}
        </p>
      )}
    </Sheet>
  )
}
