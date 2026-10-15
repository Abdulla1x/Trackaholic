import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import ShareCodePanel from '../../components/ShareCodePanel'
import ShowAllToggle, { COLLAPSED_ROWS } from '../../components/ShowAllToggle'
import ItemSheet from '../../components/you/ItemSheet'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { useSettings } from '../../settings/SettingsContext'
import type { MealTemplate } from '../../types'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { FIELD } from '@/ui/field'
import Retry from '@/ui/retry'
import { RowButton } from '@/ui/row'
import { Stat, StatGrid } from '@/ui/stat'
import { useToast } from '@/ui/toast'
import { n } from '@/lib/format'

function detail(meal: MealTemplate): string {
  const parts = [`${n(meal.calories)} kcal`, `${n(meal.protein)} g protein`]
  if (meal.items.length > 0) parts.push(`${meal.items.length} ${meal.items.length === 1 ? 'ingredient' : 'ingredients'}`)
  return parts.join(' · ')
}

/** Saved meals, pushed from You: see them, share one, remove one. Logging
 *  one happens in the Log panel; this is the list to manage.
 *
 *  Each row opens a sheet with the meal's numbers, its ingredients, a share
 *  code and Delete. There is nothing to edit, so the sheet has no Save: a
 *  saved meal is changed by logging it, editing, and saving it again under
 *  the same name. */
export default function SavedMealsScreen() {
  return (
    <SettingsScreen title="Saved meals">
      <SavedMeals />
    </SettingsScreen>
  )
}

function SavedMeals() {
  const toast = useToast()
  const { settings } = useSettings()
  const [items, setItems] = useState<MealTemplate[] | null>(null)
  const [loadError, setLoadError] = useState('')
  useLiveMessage(loadError)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .getMealTemplates()
      .then((next) => {
        setItems(next)
        setLoadError('')
      })
      // An empty list and a failed fetch render identically, and one of them
      // means "nothing saved yet" while the other means "try again".
      .catch(() => setLoadError("Couldn't load your saved meals. Check your connection, then try again."))

  useEffect(() => {
    load()
  }, [])

  // The whole list is already in memory, so filtering costs no round trip per
  // keystroke, the same as the food library.
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle === '' ? (items ?? []) : (items ?? []).filter((meal) => meal.name.toLowerCase().includes(needle))
  }, [items, filter])
  const visible = expanded ? shown : shown.slice(0, COLLAPSED_ROWS)
  const current = open === null ? undefined : items?.find((meal) => meal.id === open)

  const show = (meal: MealTemplate) => {
    setError('')
    setCode(null)
    setTitle(meal.name)
    setOpen(meal.id)
  }

  // Minted on demand rather than alongside every row: a code is derived from
  // the saved meal, so there is nothing to cache or keep in sync.
  const share = async (meal: MealTemplate) => {
    setBusy(true)
    setError('')
    try {
      setCode((await api.shareMealTemplate(meal.id)).code)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make a code. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (meal: MealTemplate) => {
    setBusy(true)
    setError('')
    try {
      await api.deleteMealTemplate(meal.id)
      await load()
      toast.show({ text: `Deleted ${meal.name}` })
      setOpen(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete. Check your connection, then try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Block>
      <p className="text-small text-ink-2">Log them from the Log panel. Share one as a code, or delete it here.</p>
      {items && items.length > COLLAPSED_ROWS && (
        <input
          id="saved-meals-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={`Find among ${items.length} saved meals`}
          aria-label="Find a saved meal"
          className={cn(FIELD)}
        />
      )}
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
        <p className="text-ink-2">Nothing saved yet. When you log a meal, “Keep as a saved meal” puts it here.</p>
      ) : shown.length === 0 ? (
        <p className="text-ink-2">Nothing matches “{filter.trim()}”.</p>
      ) : (
        <div className="grid divide-y divide-rule">
          {visible.map((meal) => (
            <RowButton key={meal.id} chevron onClick={() => show(meal)} label={meal.name} detail={detail(meal)} />
          ))}
        </div>
      )}
      <ShowAllToggle
        total={shown.length}
        cap={COLLAPSED_ROWS}
        expanded={expanded}
        onToggle={() => setExpanded((now) => !now)}
        noun="saved meal"
      />

      <ItemSheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        title={title}
        error={error}
        busy={busy}
        actions={
          current && (
            <Button variant="secondary" onClick={() => void share(current)} disabled={busy}>
              {code ? 'New code' : 'Share as a code'}
            </Button>
          )
        }
        remove={
          current && {
            title: `Delete ${current.name}?`,
            body: 'Meals you logged from it stay logged, with their numbers.',
            onConfirm: () => void remove(current),
          }
        }
      >
        {current && (
          <>
            <StatGrid>
              <Stat label="Calories" unit="kcal">
                {n(current.calories)}
              </Stat>
              <Stat label="Protein" unit="g">
                {n(current.protein)}
              </Stat>
              {settings?.track_carbs && current.carbs !== null && (
                <Stat label="Carbs" unit="g">
                  {n(current.carbs)}
                </Stat>
              )}
              {settings?.track_fat && current.fat !== null && (
                <Stat label="Fat" unit="g">
                  {n(current.fat)}
                </Stat>
              )}
            </StatGrid>
            {current.items.length > 0 && (
              <div className="grid gap-1.5">
                <span className="text-small text-ink-2">Ingredients</span>
                <ul className="grid divide-y divide-rule">
                  {current.items.map((item, index) => (
                    // Index as the key: two ingredients may share a name. An item's
                    // numbers are per its serving, so the row scales them to
                    // the weight used.
                    <li key={index} className="flex justify-between gap-3 py-2 text-small">
                      <span className="min-w-0">{item.name}</span>
                      <span className="shrink-0 text-ink-2">
                        {n(item.weight_grams)} g · {n((item.calories * item.weight_grams) / item.serving_size)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {code && <ShareCodePanel label={current.name} code={code} onClose={() => setCode(null)} />}
          </>
        )}
      </ItemSheet>
    </Block>
  )
}
