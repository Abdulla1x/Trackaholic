import { useEffect, useState } from 'react'
import { n } from '@/lib/format'

/** A number counting up from zero to its value once (DESIGN.md Motion: First
 *  target, 900ms), on the default exponential ease-out, so most of the climb
 *  is early and it settles into the value. Under reduced motion the value is
 *  simply there. Formatted as RollingNumber formats, so the swap back to it
 *  afterwards changes nothing on screen. */
export default function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(still ? value : 0)
  useEffect(() => {
    if (still) {
      setShown(value)
      return
    }
    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress)
      setShown(value * eased)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, still])
  return <span className="tabular-nums">{n(shown)}</span>
}
