import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { per100gSummary } from '../../lib/foodDensity'
import { livePairs, readDismissed, writeDismissed } from '../../lib/foodDuplicates'
import { SOURCE_NAME } from '../../lib/foodSources'
import type { Food, FoodDuplicatePair } from '../../types'
import { AlertDialog } from '@/ui/alert-dialog'
import { Button } from '@/ui/button'
import Sheet from '@/ui/sheet'

/** "These two look like the same food": one line above the library, and a
 *  sheet to compare each pair.
 *
 * The library fills up with little thought per entry: every ticked ingredient
 * is saved (typed, or picked from a food table or Open Food Facts), every AI
 * estimate can be. Open Food Facts picks were also cached automatically until
 * 2026-10-06, so older libraries hold many of those. The unique index blocks
 * the exact case, so everything that survives is a *near* duplicate under a
 * name nobody chose to make match.
 *
 * ⚠ IT NEVER ACTS ON ITS OWN. The server's judgement (app/duplicates.py) is a
 * heuristic with thresholds, so this argues rather than asserts: the sheet
 * puts both rows in the same units, per 100 g, and lets you read the
 * evidence. Every delete is yours, behind the same question as anywhere else.
 */
export default function FoodDuplicates({
  foods,
  onChanged,
}: {
  /** The library as the screen already has it. Pairs are ids into this, so a
   *  row deleted here stops showing with no second request. */
  foods: Food[]
  /** Reload the library after a delete. */
  onChanged: () => void
}) {
  const [pairs, setPairs] = useState<FoodDuplicatePair[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed)
  const [reviewing, setReviewing] = useState(false)
  const [deleting, setDeleting] = useState<Food | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Refetched whenever the library changes identity, which the screen does on
  // every save and delete. An edit can make a pair stop being a duplicate, and
  // a note still showing it would be arguing from numbers that no longer agree.
  useEffect(() => {
    let stale = false
    api
      .getFoodDuplicates()
      .then((next) => !stale && setPairs(next))
      // Silent: this is an unasked-for extra on a screen that works without
      // it, and an error for a suggestion nobody requested is worse than none.
      .catch(() => !stale && setPairs([]))
    return () => {
      stale = true
    }
  }, [foods])

  const visible = useMemo(() => livePairs(pairs, foods, dismissed), [pairs, foods, dismissed])

  const dismiss = (key: string) => {
    setDismissed((current) => {
      const next = new Set(current).add(key)
      writeDismissed(next, pairs)
      return next
    })
  }

  const remove = async (food: Food) => {
    setBusy(true)
    setError('')
    try {
      await api.deleteFood(food.id)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't delete. Try again.")
    } finally {
      setBusy(false)
    }
  }

  // Closes itself once the last pair is answered.
  useEffect(() => {
    if (visible.length === 0) setReviewing(false)
  }, [visible.length])

  // No pairs, nothing at all. A library with no duplicates is the normal case,
  // and announcing it every visit would only be noise.
  const first = visible[0]
  if (!first) return null

  const many = visible.length > 1

  return (
    <section aria-label="Possible duplicate foods">
      {/* One line, however many pairs: a line per pair put eleven of them
          above the list for five foods with similar names. */}
      <p className="border-l-2 border-ink pl-3 text-small">
        {many ? (
          <span className="font-semibold">{visible.length} possible duplicates.</span>
        ) : (
          <>
            <span className="font-semibold">Possible duplicate:</span> “{first.a.name}” and “{first.b.name}”.
          </>
        )}{' '}
        <button
          type="button"
          onClick={() => {
            setError('')
            setReviewing(true)
          }}
          className="font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {many ? 'Review' : 'Compare'}
        </button>
      </p>

      <Sheet open={reviewing} onOpenChange={setReviewing} title={many ? 'Possible duplicates' : 'Possible duplicate'}>
        <div className="grid gap-4 pb-2">
          <p className="text-small text-ink-2">
            Each pair per 100 g, so they can be compared. Keep whichever is right, or keep both.
          </p>
          {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}
          {visible.map(({ key, a, b }) => (
            <section key={key} aria-label={`${a.name} and ${b.name}`} className="grid gap-2 border-t border-rule pt-3">
              <div className="grid divide-y divide-rule">
                {[a, b].map((food) => (
                  <div key={food.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="font-semibold">{food.name}</span>
                      <span className="text-small text-ink-2">
                        {per100gSummary(food)} · {SOURCE_NAME[food.source]}
                      </span>
                    </span>
                    <Button variant="ghost" onClick={() => setDeleting(food)} disabled={busy} aria-label={`Delete ${food.name}`}>
                      Delete…
                    </Button>
                  </div>
                ))}
              </div>
              <div>
                <Button variant="secondary" onClick={() => dismiss(key)}>
                  Keep both
                </Button>
              </div>
            </section>
          ))}
        </div>
        {/* Inside the sheet, so a tap on it isn't a tap outside the sheet. */}
        <AlertDialog
          open={deleting !== null}
          title={`Delete ${deleting?.name ?? ''}?`}
          confirm="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const food = deleting
            setDeleting(null)
            if (food) void remove(food)
          }}
        >
          It stops being offered when you log. Meals you logged with it keep their numbers.
        </AlertDialog>
      </Sheet>
    </section>
  )
}
