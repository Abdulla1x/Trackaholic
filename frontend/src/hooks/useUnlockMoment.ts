import { useEffect, useState } from 'react'
import { readLocal, writeLocal } from '../lib/storage'

/** True once, on the visit where something this device last saw locked is
 *  now unlocked (DESIGN.md Motion: Unlock). Each lockable thing's last seen
 *  state is kept per device; a thing first seen already unlocked, like any
 *  established account's trend, never plays it, so the moment is only ever
 *  shown to someone who watched it fill.
 *
 *  `unlocked` is undefined until the data has arrived. Written in an effect,
 *  and only ever set to true, so StrictMode's second run (which reads back
 *  what the first wrote) cannot take the moment away again. */
export function useUnlockMoment(name: string, unlocked: boolean | undefined): boolean {
  const [moment, setMoment] = useState(false)
  useEffect(() => {
    if (unlocked === undefined) return
    const key = `trackaholic_unlock_${name}`
    const before = readLocal(key)
    writeLocal(key, unlocked ? 'open' : 'locked')
    if (unlocked && before === 'locked') setMoment(true)
  }, [name, unlocked])
  return moment
}
