import { useCallback, useRef } from 'react'

/** For loaders whose answers can arrive out of order.
 *
 * Call the returned `claim()` when a request starts; it hands back `isCurrent`,
 * which stays true only until the next `claim()`. Apply a response only while
 * it is current. Without this, stepping from one day to the next puts two
 * requests in flight, and if the older one lands last the page shows the wrong
 * day's numbers under the right day's name, until a reload. */
export function useLatestOnly(): () => () => boolean {
  const latest = useRef(0)
  return useCallback(() => {
    const mine = ++latest.current
    return () => mine === latest.current
  }, [])
}
