// What Getting started shows (Today, first use). Pure, so it can be tested.
//
// The card is for someone getting started, not a checklist every account
// carries: it appears while no target is chosen, and stays after that only on
// a device that showed it unfinished, until the first meal is logged and the
// "what's next" moment is dismissed. An account that already has a target
// and meals never sees it.

/** Remembered per account on this device (lib/storage accountKey). */
export interface GettingStartedMemory {
  /** It was shown unfinished here, so it may stay after the target is set. */
  open?: boolean
  /** "Not now": shrunk to one row. */
  later?: boolean
  /** "Done" on the what's-next moment: gone for good on this device. */
  done?: boolean
}

export type GettingStartedView = 'hidden' | 'steps' | 'row' | 'next'

/** `hasMeal` is null until it is known. */
export function gettingStartedView(
  targetSet: boolean,
  hasMeal: boolean | null,
  memory: GettingStartedMemory,
): GettingStartedView {
  if (memory.done) return 'hidden'
  const unfinished = memory.later ? 'row' : 'steps'
  if (!targetSet) return unfinished
  if (!memory.open) return 'hidden'
  if (hasMeal === false || hasMeal === null) return unfinished
  return 'next'
}

export function readMemory(raw: string | null): GettingStartedMemory {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as GettingStartedMemory) : {}
  } catch {
    return {}
  }
}
