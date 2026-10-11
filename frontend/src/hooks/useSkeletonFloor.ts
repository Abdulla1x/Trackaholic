import { useEffect, useState } from 'react'

/** How long a skeleton stays at least (DESIGN.md: 650 ms on a data screen's
 *  first load). A fast answer would otherwise flash the placeholder for a
 *  frame, which reads as a flicker rather than as loading. */
export const SKELETON_MIN_MS = 650

/** False until SKELETON_MIN_MS has passed since the component mounted. */
export function useSkeletonFloor(): boolean {
  const [passed, setPassed] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setPassed(true), SKELETON_MIN_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return passed
}
