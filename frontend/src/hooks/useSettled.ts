import { useEffect, useRef, useState } from 'react'
import { SETTLE_MS, settleDelay } from '../lib/settle'

/** `value`, held back while it keeps changing (lib/settle.ts for the rule).
 *
 * The first change after a quiet spell comes through at once; a burst comes
 * through once, at its end. */
export function useSettled<T>(value: T, ms: number = SETTLE_MS): T {
  const [settled, setSettled] = useState(value)
  const lastChange = useRef(Number.NEGATIVE_INFINITY)

  useEffect(() => {
    const now = performance.now()
    const delay = settleDelay(now - lastChange.current, ms)
    lastChange.current = now
    if (delay === 0) {
      setSettled(value)
      return
    }
    const timer = window.setTimeout(() => setSettled(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, ms])

  return settled
}
