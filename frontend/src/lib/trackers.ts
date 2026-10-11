import type { Settings } from '../types.ts'

// Which trackers Today shows. The weigh-in is always on: it is the first
// weigh-in at setup and it feeds the automatic target and the weight trend.
// The other three are chosen, at setup or with "Add or remove trackers".

export type TrackerKey = 'water' | 'steps' | 'supplements'

export interface TrackerInfo {
  key: TrackerKey
  name: string
  description: string
}

/** In the order Today stacks them, under the weigh-in. */
export const TRACKERS: readonly TrackerInfo[] = [
  { key: 'water', name: 'Water', description: 'Glasses and bottles towards a daily goal' },
  { key: 'steps', name: 'Steps', description: 'Type them in, or import a history from a file' },
  { key: 'supplements', name: 'Supplements', description: 'Tick off what you take, when you take it' },
]

export const WEIGH_IN_DESCRIPTION = 'Always on. It keeps your target and trend up to date.'

/** The one name for the button and every hint that points at it. */
export const CHANGE_TRACKERS = 'Add or remove trackers'

/** What Today shows, before anyone chose: Water and Steps always, and
 *  Supplements once there is something to tick (the cards' behaviour before
 *  the choice existed). */
export function legacyTrackers(hasSupplements: boolean): TrackerKey[] {
  return hasSupplements ? ['water', 'steps', 'supplements'] : ['water', 'steps']
}

/** The trackers Today shows for these settings.
 *
 *  - A list: exactly those, in Today's order.
 *  - null (an account from before the choice) or absent (the live API, which
 *    predates it): the old cards, unchanged. */
export function shownTrackers(
  settings: Pick<Settings, 'trackers'>,
  hasSupplements: boolean,
): TrackerKey[] {
  const chosen = settings.trackers
  if (chosen == null) return legacyTrackers(hasSupplements)
  return TRACKERS.map((tracker) => tracker.key).filter((key) => chosen.includes(key))
}

/** True only when the server says the choice was never made, so the account
 *  is asked once. Absent means an API that cannot store an answer: no question. */
export function asksForTrackers(settings: Pick<Settings, 'trackers'>): boolean {
  return settings.trackers === null
}

/** Whether "Add or remove trackers" can store a change on this API. */
export function canChooseTrackers(settings: Pick<Settings, 'trackers'>): boolean {
  return settings.trackers !== undefined
}

/** The list with one tracker turned on or off, in Today's order. */
export function withTracker(list: readonly TrackerKey[], key: TrackerKey, on: boolean): TrackerKey[] {
  return TRACKERS.map((tracker) => tracker.key).filter((k) => (k === key ? on : list.includes(k)))
}
