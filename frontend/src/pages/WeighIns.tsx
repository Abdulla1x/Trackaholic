import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api/client'
import ScreenBar from '../components/shell/ScreenBar'
import { shortDate } from '../lib/dates'
import { displayToKg, formatWeight, unitLabel } from '../lib/units'
import { useSettings } from '../settings/SettingsContext'
import { useLiveMessage } from '../hooks/useLiveMessage'
import type { WeightEntry } from '../types'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { ExpandIcon } from '@/ui/icons'
import { cn } from '@/lib/utils'

/** How many rows show at first, and how many each "Show more" adds: about a
 *  month of daily weigh-ins at a time. */
const STEP = 30

/** Every weigh-in, newest first, each one editable (PRODUCT.md: "any day's
 *  from the weigh-in history in Progress"). A row is one big target that
 *  opens in place, which replaces the old page's tiny ✎ and ✕ glyphs (UA-13).
 *
 *  Logging a new weigh-in is Today's job (its card logs any day through the
 *  date bar), so this screen only corrects what is there. The server keeps one
 *  weigh-in per day, so an edit is a save on the same date. */
export default function WeighIns() {
  const { settings, reload: reloadSettings } = useSettings()
  const unit = settings?.weight_unit ?? 'kg'
  const label = unitLabel(unit)
  // Newest first; null until the first answer, so "none yet" and "not loaded"
  // never look alike.
  const [entries, setEntries] = useState<WeightEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [shown, setShown] = useState(STEP)
  const [open, setOpen] = useState<number | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  useLiveMessage(said)

  const load = useCallback(() => {
    api.getWeights().then(
      (next) => {
        setEntries([...next].reverse())
        setFailed(false)
      },
      () => setFailed(true),
    )
  }, [])
  useEffect(load, [load])

  // A weigh-in feeds the trend, and with "work out my goals" on, the daily
  // targets too, so both are refetched after every change.
  const changed = (message: string) => {
    setOpen(null)
    setSaid(message)
    load()
    reloadSettings()
  }

  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="All weigh-ins" back="/progress" backLabel="Back to Progress" />

      {failed && (
        <p role="alert" className="mt-3 border-l-2 border-ink pl-3 text-small">
          Couldn't load your weigh-ins. Check your connection, then try again.{' '}
          <button type="button" onClick={load} className="font-semibold underline underline-offset-3">
            Retry
          </button>
        </p>
      )}

      {entries === null && !failed && (
        <p role="status" className="py-6 text-center text-small text-ink-2">
          Loading your weigh-ins…
        </p>
      )}

      {entries !== null && entries.length === 0 && (
        <p className="py-6 text-center text-small text-ink-2">No weigh-ins yet. Weigh in from Today and they appear here.</p>
      )}

      {entries !== null && entries.length > 0 && (
        <>
          <p className="py-3 text-small text-ink-2">
            {entries.length.toLocaleString()} weigh-in{entries.length === 1 ? '' : 's'}, newest first. Tap one to change
            or delete it.
          </p>
          <ul className="divide-y divide-rule border-y border-rule">
            {entries.slice(0, shown).map((entry) => (
              <WeighInRow
                key={entry.id}
                entry={entry}
                unit={unit}
                label={label}
                open={open === entry.id}
                onToggle={() => setOpen((now) => (now === entry.id ? null : entry.id))}
                onChanged={changed}
              />
            ))}
          </ul>
          {entries.length > shown && (
            <Button variant="ghost" className="mt-3 justify-self-start" onClick={() => setShown((now) => now + STEP)}>
              Show more ({Math.min(STEP, entries.length - shown)} of {entries.length - shown} left)
            </Button>
          )}
        </>
      )}

    </div>
  )
}

function WeighInRow({
  entry,
  unit,
  label,
  open,
  onToggle,
  onChanged,
}: {
  entry: WeightEntry
  unit: 'kg' | 'lb'
  label: string
  open: boolean
  onToggle: () => void
  onChanged: (message: string) => void
}) {
  const [value, setValue] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useLiveMessage(error)
  const input = useRef<HTMLInputElement>(null)
  const row = useRef<HTMLButtonElement>(null)
  const day = shortDate(entry.date)
  const weight = `${formatWeight(entry.weight_kg, unit)} ${label}`

  // Each opening starts from the saved value, with nothing said yet, and puts
  // the cursor in the field: opening a row is asking to change it.
  useEffect(() => {
    if (!open) return
    setValue(formatWeight(entry.weight_kg, unit))
    setConfirming(false)
    setError(null)
    input.current?.focus()
  }, [open, entry.weight_kg, unit])

  const close = () => {
    onToggle()
    row.current?.focus()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const typed = Number(value.replace(',', '.'))
    if (!value.trim() || !Number.isFinite(typed) || typed <= 0) {
      setError(`Enter a weight in ${label}.`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.saveWeight({ date: entry.date, weight_kg: displayToKg(typed, unit) })
      onChanged(`${day} saved.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Check your connection, then try again.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteWeight(entry.id)
      onChanged(`The weigh-in from ${day} is deleted.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete. Check your connection, then try again.")
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  const panel = `weigh-in-${entry.id}`
  return (
    <li>
      <button
        ref={row}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="flex min-h-[52px] w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        <span className="flex-1">{day}</span>
        <span className="text-row-number tabular-nums">{weight}</span>
        <ExpandIcon size={18} aria-hidden="true" className={cn('shrink-0 text-ink-2', open && 'rotate-180')} />
      </button>
      <div id={panel} hidden={!open} className="grid gap-2 pb-3">
        {open && (
          <>
            <form onSubmit={save} className="flex flex-wrap items-center gap-2">
              <input
                ref={input}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-label={`Weight on ${day}, in ${label === 'kg' ? 'kilograms' : 'pounds'}`}
                aria-invalid={error !== null || undefined}
                className={cn(FIELD, 'w-28 text-[19px] font-bold [font-stretch:85%] tabular-nums')}
              />
              <span className="text-ink-2">{label}</span>
              <Button type="submit" disabled={busy}>
                {busy && !confirming ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
            </form>
            {confirming ? (
              <div className="grid gap-2">
                <p className="text-small">Delete the weigh-in from {day}? It can't be undone.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" disabled={busy} onClick={remove}>
                    {busy ? 'Deleting…' : 'Delete'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-8 justify-self-start text-small text-ink-2 underline underline-offset-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Delete this weigh-in
              </button>
            )}
            {error && (
              <p role="alert" className="border-l-2 border-ink pl-3 text-small">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  )
}
