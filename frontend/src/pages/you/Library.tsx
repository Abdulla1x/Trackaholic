import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import ShowAllToggle, { COLLAPSED_ROWS } from '../../components/ShowAllToggle'
import FoodDuplicates from '../../components/you/FoodDuplicates'
import ItemSheet from '../../components/you/ItemSheet'
import SettingsScreen from '../../components/you/SettingsScreen'
import { useLiveMessage } from '../../hooks/useLiveMessage'
import { isPer100g, per100gSummary } from '../../lib/foodDensity'
import { DATA_CREDITS, SOURCE_NAME } from '../../lib/foodSources'
import { MAX_FOOD_NAME, validateFood } from '../../lib/limits'
import { num } from '../../lib/parse'
import type { Food, FoodCreate } from '../../types'
import { cn } from '@/lib/utils'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import Explainer from '@/ui/explainer'
import { FIELD } from '@/ui/field'
import { NumberField } from '@/ui/number-field'
import { RowButton } from '@/ui/row'
import { useToast } from '@/ui/toast'

interface Draft {
  name: string
  servingSize: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

/** 100 g as the default serving, because that is what Open Food Facts reports
 *  against and what most packaging prints. A blank would only be retyped. */
const EMPTY: Draft = { name: '', servingSize: '100', calories: '', protein: '', carbs: '', fat: '' }

const draftFrom = (food: Food): Draft => ({
  name: food.name,
  servingSize: String(food.serving_size),
  calories: String(food.calories),
  protein: String(food.protein),
  carbs: food.carbs == null ? '' : String(food.carbs),
  fat: food.fat == null ? '' : String(food.fat),
})

const NUMBERS = [
  ['servingSize', 'Serving', 'g'],
  ['calories', 'Calories', 'kcal'],
  ['protein', 'Protein', 'g'],
  ['carbs', 'Carbs', 'g'],
  ['fat', 'Fat', 'g'],
] as const

/** How the list can be ordered.
 *
 * Two, because those are the two the data can honestly support. "Most used
 * first" is the one people ask for and it is not here: a meal is a flat row
 * with no link to a food, so nothing records that a saved food was ever used.
 * Offering it would mean ranking on something else and calling it usage. */
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'recent', label: 'Recently added' },
] as const

type SortKey = (typeof SORT_OPTIONS)[number]['value']

/** ⚠️ By VALUE, never `SORT_OPTIONS[0].value`: a range picker once defaulted
 *  to 90 days only because 90 sat second in its list, so adding an option at
 *  the front silently repointed the default. */
const DEFAULT_SORT: SortKey = 'name'

const compare: Record<SortKey, (a: Food, b: Food) => number> = {
  // localeCompare rather than the server's ORDER BY: that is a database
  // collation, so "Apple" and "apple" order differently on SQLite and Postgres.
  name: (a, b) => a.name.localeCompare(b.name),
  // Newest first, tie-broken by id. Foods saved together (the log form writes
  // its ticked ingredients in one Promise.all) can share a timestamp exactly,
  // and an unstable sort would let them swap places between renders.
  recent: (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
}

const fmt = (value: number) => Math.round(value * 10) / 10

function detail(food: Food): string {
  const serving = `${Math.round(food.calories)} kcal · ${fmt(food.protein)} g protein per ${fmt(food.serving_size)} g`
  // Only when the row is not already per 100 g: there it would repeat the
  // same numbers. It earns its place where the serving size is what makes two
  // rows hard to compare.
  const per100 = isPer100g(food) ? '' : ` (${per100gSummary(food)})`
  return `${serving}${per100} · ${SOURCE_NAME[food.source]}`
}

/** Food library, pushed from You: the foods the app has remembered on your
 *  behalf, in one place to correct. Each row opens a sheet that writes
 *  straight to the server, so no Save bar ever appears here. */
export default function LibraryScreen() {
  return (
    <SettingsScreen title="Food library">
      <Library />
    </SettingsScreen>
  )
}

function Library() {
  const toast = useToast()
  const [items, setItems] = useState<Food[] | null>(null)
  const [loadError, setLoadError] = useState('')
  useLiveMessage(loadError)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT)
  const [expanded, setExpanded] = useState(false)
  // The open sheet: a food's id, 'new', or none.
  const [open, setOpen] = useState<number | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .getFoods()
      .then((next) => {
        setItems(next)
        setLoadError('')
      })
      // An empty library and a failed fetch render identically, and one of
      // them means "nothing saved yet" while the other means "try again".
      .catch(() => setLoadError('Couldn’t load your food library.'))

  useEffect(() => {
    load()
  }, [])

  // Filtered here rather than through /api/foods/search: that endpoint caps at
  // 10 and ranks for a dropdown, which is right for autocomplete and wrong for
  // an editor, where the point is to see everything you have.
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const matching = needle === '' ? (items ?? []) : (items ?? []).filter((food) => food.name.toLowerCase().includes(needle))
    // Copied before sorting: sorting state in place would change the array
    // React holds without telling React.
    return [...matching].sort(compare[sort])
  }, [items, filter, sort])

  // Capped after filtering: a filter that already narrows to three has
  // answered the question the expander asks.
  const visible = expanded ? shown : shown.slice(0, COLLAPSED_ROWS)
  const current = typeof open === 'number' ? items?.find((food) => food.id === open) : undefined

  const show = (target: Food | 'new') => {
    setError('')
    setDraft(target === 'new' ? EMPTY : draftFrom(target))
    setTitle(target === 'new' ? 'New food' : target.name)
    setOpen(target === 'new' ? 'new' : target.id)
  }

  // Any edit clears the last refusal: it answered the attempt before it.
  const edit = (patch: Partial<Draft>) => {
    setError('')
    setDraft((now) => ({ ...now, ...patch }))
  }

  /** Runs one write; the sheet shows the refusal if it fails. */
  const write = async (action: () => Promise<unknown>, done: string, close: boolean) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
      toast.show({ text: done })
      if (close) setOpen(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t save. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    const servingSize = num(draft.servingSize)
    const calories = num(draft.calories)
    const protein = num(draft.protein)
    const carbs = num(draft.carbs)
    const fat = num(draft.fat)
    const problem = validateFood(draft.name, servingSize, calories, protein, carbs, fat)
    if (problem) {
      setError(problem)
      return
    }
    const body: FoodCreate = {
      name: draft.name.trim(),
      // Non-null by the validator above, which refuses null for all three.
      serving_size: servingSize as number,
      calories: calories as number,
      protein: protein as number,
      carbs,
      fat,
      // Sent because FoodCreate carries the field, but on an edit the server
      // decides: correcting a number makes the row yours, a rename leaves the
      // source alone.
      source: current?.source ?? 'user',
    }
    if (open === 'new') {
      // The list re-sorts on load, so a food added while collapsed can land
      // past the cap and read as "nothing happened". Expanding is true
      // whatever the new name sorts to.
      void write(() => api.saveFood(body), 'Added', true).then((ok) => ok && setExpanded(true))
    } else if (current) {
      void write(() => api.updateFood(current.id, body), 'Saved', true)
    }
  }

  return (
    <>
      <Block>
        <p className="text-small text-ink-2">
          Editing a food changes what fills in next time. Meals you already logged keep their numbers.
        </p>
        {items && <FoodDuplicates foods={items} onChanged={load} />}
        {items && items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <input
              id="library-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={`Find among ${items.length} ${items.length === 1 ? 'food' : 'foods'}`}
              aria-label="Find a food"
              className={cn(FIELD, 'min-w-0 flex-1 basis-[200px]')}
            />
            <select
              id="library-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="Sort by"
              className={cn(FIELD, 'w-auto')}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {!items ? (
          <p className="text-ink-2">{loadError || 'Loading…'}</p>
        ) : items.length === 0 ? (
          <p className="text-ink-2">
            Nothing saved yet. Add one here, or tick “save to library” on an ingredient when you log a meal.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-ink-2">Nothing matches “{filter.trim()}”.</p>
        ) : (
          <div className="grid divide-y divide-rule">
            {visible.map((food) => (
              <RowButton key={food.id} chevron onClick={() => show(food)} label={food.name} detail={detail(food)} />
            ))}
          </div>
        )}
        <ShowAllToggle
          total={shown.length}
          cap={COLLAPSED_ROWS}
          expanded={expanded}
          onToggle={() => setExpanded((now) => !now)}
          noun="food"
        />
        {items && (
          <div>
            <Button onClick={() => show('new')}>Add a food</Button>
          </div>
        )}
        {/* The credit is the condition most of these licences are given on, so
            it stays one tap away on the screen that lists the foods. Ciqual's
            terms also require that nothing suggests ANSES endorses the app.
            backend/app/data/reference/NOTICE.md carries the same text. */}
        <Explainer label="Where food data comes from">
          <div className="grid gap-3">
            <p>
              Generic foods in the search come from these open national food tables, per 100 g, with carbs shown without
              fibre. Packaged products come from Open Food Facts. None of these organisations endorses Trackaholic.
            </p>
            <ul className="grid gap-3">
              {DATA_CREDITS.map((credit) => (
                <li key={credit.source} className="grid gap-0.5">
                  <a href={credit.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-3">
                    {SOURCE_NAME[credit.source]}
                  </a>
                  <span>{credit.citation}</span>
                  <a href={credit.licenceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-3">
                    {credit.licence}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Explainer>
      </Block>

      <ItemSheet
        open={open !== null}
        onOpenChange={(next) => !next && setOpen(null)}
        title={title}
        error={error}
        onSave={save}
        saveLabel={open === 'new' ? 'Add' : 'Save'}
        busy={busy}
        actions={
          current &&
          !isPer100g(current) && (
            // A POST to its own endpoint, not a PUT of recomputed numbers. PUT
            // decides `source` from what changed and would mark a rescaled Open
            // Food Facts row as yours, on the screen whose job is saying which
            // numbers came from where.
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void write(() => api.normalizeFood(current.id), 'Saved per 100 g', true)}
            >
              Per 100 g
            </Button>
          )
        }
        actionsNote={
          current &&
          !isPer100g(current) &&
          `Per 100 g saves it as ${per100gSummary(current)}. Same food, same figures.`
        }
        remove={
          current && {
            title: `Delete ${current.name}?`,
            body: 'It stops being offered when you log. Meals you logged with it keep their numbers.',
            onConfirm: () => void write(() => api.deleteFood(current.id), `Deleted ${current.name}`, true),
          }
        }
      >
        <label className="grid min-w-0 gap-1.5">
          <span className="text-small text-ink-2">Name</span>
          <input
            id="food-name"
            value={draft.name}
            maxLength={MAX_FOOD_NAME}
            onChange={(event) => edit({ name: event.target.value })}
            className={FIELD}
          />
        </label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 desk:grid-cols-3">
          {NUMBERS.map(([key, label, unit]) => (
            <NumberField
              key={key}
              id={`food-${key}`}
              label={label}
              unit={unit}
              value={draft[key]}
              onChange={(value) => edit({ [key]: value })}
            />
          ))}
        </div>
        <p className="text-small text-ink-2">
          {/* All four macros always show, even for someone not tracking carbs
              or fat: a food's carbs are a property of the food, already stored,
              and visible the day tracking is switched on. */}
          Per serving. Leave carbs or fat empty if you don’t know them; empty isn’t zero.
          {current && current.source !== 'user' && ` These numbers are from ${SOURCE_NAME[current.source]}; change one and it becomes yours.`}
        </p>
      </ItemSheet>
    </>
  )
}
