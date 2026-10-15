import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import ItemSheet from '../../components/you/ItemSheet'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import {
  MAX_SUPPLEMENT_DOSE,
  MAX_SUPPLEMENT_NAME,
  MAX_SUPPLEMENT_TIMES,
  MAX_SUPPLEMENTS,
  validateSupplement,
} from '../../lib/limits'
import type { Supplement } from '../../types'
import { timeLabel } from '../../lib/dates'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import { CloseIcon } from '@/ui/icons'
import Retry from '@/ui/retry'
import { RowButton } from '@/ui/row'
import { useToast } from '@/ui/toast'

interface Draft {
  name: string
  dose: string
  times: string[]
}

const EMPTY: Draft = { name: '', dose: '', times: ['08:00'] }

/** Supplements, pushed from You: what you take and when. Each time becomes a
 *  box to tick on Today.
 *
 *  A supplement is a row in its own table with its own endpoints, not a
 *  column on the settings row, so nothing here goes through the Save bar:
 *  each row opens a sheet whose Save writes straight away. Holding them in
 *  the screen's draft would mean a half-typed supplement silently lost by
 *  leaving. */
export default function SupplementsScreen() {
  return (
    <SettingsScreen title="Supplements">
      <Supplements />
    </SettingsScreen>
  )
}

function Supplements() {
  const toast = useToast()
  const [items, setItems] = useState<Supplement[] | null>(null)
  const [loadError, setLoadError] = useState('')
  useLiveMessage(loadError)
  // The open sheet: a supplement's id, 'new', or none.
  const [open, setOpen] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  // Kept apart from `current`, so the title doesn't change under the sheet as
  // it closes after a delete.
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .getSupplements()
      .then((next) => {
        setItems(next)
        setLoadError('')
      })
      // An empty list and a failed fetch look identical once rendered, and one
      // of them means "add your first" while the other means "try again".
      .catch(() => setLoadError("Couldn't load your supplements. Check your connection, then try again."))

  useEffect(() => {
    load()
  }, [])

  const current = typeof open === 'number' ? items?.find((item) => item.id === open) : undefined

  const show = (target: Supplement | 'new') => {
    setError('')
    setDraft(target === 'new' ? EMPTY : { name: target.name, dose: target.dose ?? '', times: [...target.times] })
    setTitle(target === 'new' ? 'New supplement' : target.name)
    setOpen(target === 'new' ? 'new' : target.id)
  }

  // `map` and `filter`, never an indexed assignment into a copy. Assigning
  // past the end of a shortened array leaves a hole, JSON.stringify writes it
  // as `null`, and the server refuses with a 422 about a field nobody can see
  // is wrong: the bug the water quick-adds once shipped.
  //
  // Any edit clears the last refusal: it answered the attempt before it.
  const edit = (next: (now: Draft) => Draft) => {
    setError('')
    setDraft(next)
  }
  const setTime = (index: number, value: string) =>
    edit((now) => ({ ...now, times: now.times.map((time, i) => (i === index ? value : time)) }))
  const removeTime = (index: number) => edit((now) => ({ ...now, times: now.times.filter((_, i) => i !== index) }))

  /** Runs one write; the sheet shows the refusal if it fails. */
  const write = async (action: () => Promise<unknown>, done: string, close: boolean) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
      toast.show({ text: done })
      if (close) setOpen(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    // An emptied time box is a row you are done with, not a time.
    const times = draft.times.filter((time) => time !== '')
    const problem = validateSupplement(draft.name, draft.dose, times)
    if (problem) {
      setError(problem)
      return
    }
    const body = {
      name: draft.name.trim(),
      dose: draft.dose.trim() || null,
      times,
      // Saving never changes the paused state; that is Pause's job, and a Save
      // that quietly resumed something would be a surprise.
      active: current?.active ?? true,
    }
    if (open === 'new') void write(() => api.createSupplement(body), 'Added', true)
    else if (current) void write(() => api.updateSupplement(current.id, body), 'Saved', true)
  }

  const togglePause = (item: Supplement) =>
    void write(
      () => api.updateSupplement(item.id, { name: item.name, dose: item.dose, times: item.times, active: !item.active }),
      item.active ? 'Paused' : 'Resumed',
      false,
    )

  const full = (items?.length ?? 0) >= MAX_SUPPLEMENTS

  return (
    <Block>
      <p className="text-small text-ink-2">
        Tick doses on Today. The times are boxes to tick there, not phone alerts. Changes here save straight away.
      </p>
      {!items ? (
        loadError ? (
          // No role: useLiveMessage(loadError) already speaks it.
          <Retry
            text={loadError}
            onRetry={() => {
              setLoadError('')
              load()
            }}
          />
        ) : (
          <p className="text-ink-2">Loading…</p>
        )
      ) : items.length === 0 ? (
        <p className="text-ink-2">Nothing yet. Add what you take, and when.</p>
      ) : (
        <div className="grid divide-y divide-rule">
          {items.map((item) => (
            <RowButton
              key={item.id}
              chevron
              onClick={() => show(item)}
              label={
                <span className={cn(!item.active && 'text-ink-2')}>
                  {item.name}
                  {!item.active && (
                    <span className="ml-2 rounded-tag border-[1.5px] border-ink-2 px-1.5 text-[11px] font-bold tracking-[0.04em] text-ink-2 uppercase">
                      Paused
                    </span>
                  )}
                </span>
              }
              detail={[item.dose, item.times.map((time) => timeLabel(time)).join(', ')].filter(Boolean).join(' · ')}
            />
          ))}
        </div>
      )}
      {items && (
        <div className="grid gap-1.5">
          <div>
            <Button onClick={() => show('new')} disabled={full}>
              Add a supplement
            </Button>
          </div>
          {full && <p className="text-small text-ink-2">That's the limit of {MAX_SUPPLEMENTS}.</p>}
        </div>
      )}

      <ItemSheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        title={title}
        error={error}
        onSave={save}
        saveLabel={open === 'new' ? 'Add' : 'Save'}
        busy={busy}
        actions={
          current && (
            <Button variant="secondary" onClick={() => togglePause(current)} disabled={busy}>
              {current.active ? 'Pause' : 'Resume'}
            </Button>
          )
        }
        actionsNote={
          current &&
          (current.active
            ? 'Pausing takes it off Today and keeps the doses you ticked.'
            : 'Paused: not on Today. The doses you ticked are kept.')
        }
        remove={
          current && {
            title: `Delete ${current.name}?`,
            body: 'Every dose you ticked for it goes too. Pause it instead to keep them.',
            onConfirm: () => void write(() => api.deleteSupplement(current.id), `Deleted ${current.name}`, true),
          }
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 desk:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-small text-ink-2">Name</span>
            <input
              id="supplement-name"
              value={draft.name}
              maxLength={MAX_SUPPLEMENT_NAME}
              onChange={(event) => edit((now) => ({ ...now, name: event.target.value }))}
              className={FIELD}
            />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className="text-small text-ink-2">Dose (optional)</span>
            <input
              id="supplement-dose"
              value={draft.dose}
              maxLength={MAX_SUPPLEMENT_DOSE}
              placeholder="e.g. 5 g"
              onChange={(event) => edit((now) => ({ ...now, dose: event.target.value }))}
              className={FIELD}
            />
          </label>
        </div>
        <div className="grid gap-1.5">
          <span id="supplement-times" className="text-small text-ink-2">
            Times (each one is a box to tick on Today)
          </span>
          <div role="group" aria-labelledby="supplement-times" className="flex flex-wrap items-center gap-2">
            {draft.times.map((time, index) => (
              // Index as the key, deliberately: the times are edited in place
              // and two boxes can hold the same value mid-typing, so the value
              // is not a stable identity.
              <span key={index} className="flex">
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(index, event.target.value)}
                  aria-label={`Time ${index + 1}`}
                  className={cn(FIELD, 'w-[140px] rounded-r-none')}
                />
                <button
                  type="button"
                  onClick={() => removeTime(index)}
                  aria-label={`Remove time ${index + 1}`}
                  className="grid w-11 place-items-center rounded-r-control border-[1.5px] border-l-0 border-rule bg-field text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  <CloseIcon size={16} aria-hidden />
                </button>
              </span>
            ))}
            {draft.times.length < MAX_SUPPLEMENT_TIMES && (
              <Button variant="ghost" onClick={() => edit((now) => ({ ...now, times: [...now.times, '12:00'] }))}>
                Add a time
              </Button>
            )}
          </div>
        </div>
      </ItemSheet>
    </Block>
  )
}
