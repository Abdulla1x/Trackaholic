import { useEffect, useRef, useState } from 'react'
import { localIsoDate } from '../lib/dates'
import { readLocal, writeLocal } from '../lib/storage'

const KEY = 'trackaholic_on_target_moment'

/** When to mark reaching the target (DESIGN.md Motion: On target).
 *
 *  It plays when a change seen on screen brings TODAY into the on-target band:
 *  a meal just logged, typically. Never on first sight of a day (opening the
 *  app on an evening already on target, or browsing back to one), never for a
 *  past day, never on leaving the band, and once a day per device, so an
 *  Undo or a fix-up that crosses the edge again plays nothing.
 *
 *  Returns the delay before the words should roll in: after the gauge's sweep
 *  of the newly lit segments (45ms apart, DESIGN.md) has mostly run. Null when
 *  there is nothing to play.
 *
 *  The last seen state is a ref, written by the effect, so StrictMode's second
 *  run sees the first one's day and onTarget and plays nothing. */
export function useOnTargetMoment(day: string, onTarget: boolean, lit: number): number | null {
  const seen = useRef<{ day: string; onTarget: boolean; lit: number } | null>(null)
  const [delay, setDelay] = useState<number | null>(null)
  useEffect(() => {
    const before = seen.current
    seen.current = { day, onTarget, lit }
    if (!before || before.day !== day) {
      setDelay(null)
      return
    }
    if (!onTarget || before.onTarget || day !== localIsoDate()) return
    if (readLocal(KEY) === day) return
    writeLocal(KEY, day)
    setDelay(Math.max(0, lit - before.lit) * 45 + 500)
  }, [day, onTarget, lit])
  return delay
}
