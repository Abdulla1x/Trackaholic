import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { localIsoDate } from '../../lib/dates'
import { asksForTrackers, CHANGE_TRACKERS, legacyTrackers, TRACKERS, withTracker, type TrackerKey } from '../../lib/trackers'
import { useSettings } from '../../settings/SettingsContext'
import { Button } from '@/ui/button'
import Sheet from '@/ui/sheet'

/** "The new Trackaholic": asked once of an account from before trackers were
 *  chosen (`trackers` null), the first time it opens Today on the redesign.
 *
 *  It keeps the cards that account already sees, ticked, and asks which to
 *  keep. Save and "Keep as is" both store a list, so the question never comes
 *  back on any device; closing it without answering asks again next time.
 *  Chosen from the first-use prototype as a popup rather than a card on
 *  Today (2026-10-11).
 *
 *  `ready` is false while release notes are waiting, so the two never open on
 *  top of each other. */
export default function NewTrackaholicPrompt({ ready }: { ready: boolean }) {
  const { settings, updateSettings } = useSettings()
  const asked = settings != null && asksForTrackers(settings)
  // What Today shows now (kept by "Keep as is"), and the ticks as changed.
  const [kept, setKept] = useState<TrackerKey[] | null>(null)
  const [picked, setPicked] = useState<TrackerKey[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // Start from what Today shows now: Supplements only if something is
  // scheduled, the same test its card uses.
  useEffect(() => {
    if (!asked || !ready || kept) return
    let live = true
    const start = (hasSupplements: boolean) => {
      if (!live) return
      setKept(legacyTrackers(hasSupplements))
      setPicked(legacyTrackers(hasSupplements))
    }
    api
      .getSupplementDay(localIsoDate())
      .then((day) => start(day.slots.length > 0))
      .catch(() => start(false))
    return () => {
      live = false
    }
  }, [asked, ready, kept])

  // Mounted from the first question on, so an answer closes it with the
  // sheet's exit rather than making it vanish.
  if (!settings || !kept) return null

  const save = async (list: TrackerKey[]) => {
    setBusy(true)
    setFailed(false)
    try {
      await updateSettings({ ...settings, trackers: list })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={ready && asked && !dismissed}
      onOpenChange={(open) => !open && setDismissed(true)}
      title="The new Trackaholic"
      desk="center"
    >
      <div className="grid gap-3 py-2">
        <p className="text-small text-ink-2">Three tabs now: Today, Progress and You, with Log in the middle.</p>
        <p>
          Today can show only the trackers you use. Untick any you don’t want. You can change it later with{' '}
          {CHANGE_TRACKERS}, at the bottom of Today.
        </p>
        <ul className="divide-y divide-rule">
          {TRACKERS.map(({ key, name, description }) => (
            <li key={key}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={picked.includes(key)}
                  onChange={(event) => setPicked(withTracker(picked, key, event.target.checked))}
                  className="size-5 shrink-0 accent-ink"
                />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-semibold">{name}</span>
                  <span className="text-small text-ink-2">{description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {failed && (
          <p role="alert" className="border-l-2 border-ink pl-3 text-small">
            That didn’t save. Check your connection, then try again.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => save(picked)}>
            Save
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => save(kept)}>
            Keep as is
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
