import type { Food, FoodDuplicatePair } from '../types'

/** Dismissed pairs, per device.
 *
 * localStorage rather than a column, because this is a note about the UI, not
 * about the data: "I know, I want both." A table for it would need a migration,
 * a CASCADE and an isolation test to record a preference that stops mattering
 * the moment either row is edited.
 *
 * Every access is wrapped — a private window, cleared site data or a browser
 * set to block storage all throw here, and none of them should cost the user
 * the panel itself.
 */
export const DISMISSED_KEY = 'macros.dismissedFoodDuplicates'

/** Order-independent, so a pair cannot be dismissed once and come back because
 *  the server happened to report its two ids the other way round. */
export const pairKey = (pair: FoodDuplicatePair) =>
  [pair.a_id, pair.b_id].sort((a, b) => a - b).join('-')

export function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** Written back pruned to the pairs the server still reports.
 *
 * Without this the list only ever grows: a dismissal for two foods that were
 * deleted years ago is dead weight that can never be reached again, and the
 * key would accumulate one entry per pair the user ever waved off. */
export function writeDismissed(keys: Set<string>, live: FoodDuplicatePair[]) {
  const liveKeys = new Set(live.map(pairKey))
  try {
    window.localStorage.setItem(
      DISMISSED_KEY,
      JSON.stringify([...keys].filter((key) => liveKeys.has(key))),
    )
  } catch {
    /* A device that cannot remember the dismissal still honours it this
       session; the panel simply returns next time. */
  }
}

/** The pairs worth showing: not dismissed on this device, and with BOTH rows
 *  still in the library. That second test is what makes deleting one of them
 *  enough to close the note, with no refetch and no special case. Shared by
 *  the library screen and the You row that counts them. */
export function livePairs(
  pairs: FoodDuplicatePair[],
  foods: Food[],
  dismissed: Set<string>,
): { key: string; a: Food; b: Food }[] {
  const byId = new Map(foods.map((food) => [food.id, food]))
  return pairs
    .filter((pair) => !dismissed.has(pairKey(pair)))
    .map((pair) => ({ key: pairKey(pair), a: byId.get(pair.a_id), b: byId.get(pair.b_id) }))
    .filter((pair): pair is { key: string; a: Food; b: Food } => pair.a !== undefined && pair.b !== undefined)
}
