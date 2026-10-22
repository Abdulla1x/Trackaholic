import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import {
  afterNotNow,
  deviceOf,
  installRoute,
  readInstallMemory,
  shouldAsk,
  type InstallMemory,
} from '../../lib/install'
import { isStandalone, useInstallState } from '../../lib/installEvent'
import { accountKey, readLocal, writeLocal } from '../../lib/storage'
import { targetIsSet } from '../../lib/today'
import { useSettings } from '../../settings/SettingsContext'
import { useToast } from '@/ui/toast'
import InstallSheet from './InstallSheet'

/** How long Today waits before asking: Chromium's install event usually
 *  arrives within a second or two of the page, and asking before it would
 *  show the menu steps on a phone that has an Install button. */
const SETTLE_MS = 3_000

/** Once a meal is found it stays found for the session, so coming back to
 *  Today doesn't ask the server again. */
let mealSeen = false

/** Today's "Add to home screen" popup: once Getting started is done (a target
 *  and a first meal), on a phone's browser, until it is installed or "Not now"
 *  has been said twice (lib/install.ts shouldAsk). The You row offers it any
 *  time, so every reason not to ask here is safe.
 *
 *  `ready` is false while another popup is waiting or open (release notes,
 *  The new Trackaholic) or the Log panel is up: two at once is one too many. */
export default function InstallPrompt({ ready }: { ready: boolean }) {
  const { settings } = useSettings()
  const { user } = useAuth()
  const { canPrompt } = useInstallState()
  const toast = useToast()
  const key = accountKey('trackaholic_install', user?.id ?? 0)
  const [memory, setMemory] = useState<InstallMemory>(() => readInstallMemory(readLocal(key)))
  const [standalone] = useState(isStandalone)
  const [settled, setSettled] = useState(false)
  const [hasMeal, setHasMeal] = useState(mealSeen)
  // Opened at most once per visit to Today; what the answer changes is kept
  // in `memory` and on the server.
  const [open, setOpen] = useState(false)
  const [asked, setAsked] = useState(false)

  const userAgent = navigator.userAgent
  const maxTouchPoints = navigator.maxTouchPoints
  const eligible =
    settings !== null &&
    shouldAsk({
      standalone,
      installedAt: settings.installed_at,
      device: deviceOf(userAgent, maxTouchPoints),
      route: installRoute({ userAgent, maxTouchPoints, canPrompt }),
      ready: targetIsSet(settings),
      memory,
      now: Date.now(),
    })

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [])

  // The first-meal check, made only for an account that could be asked.
  useEffect(() => {
    if (!eligible || hasMeal) return
    let live = true
    api
      .getRecentMeals(1)
      .then((recent) => {
        if (live && recent.length > 0) {
          mealSeen = true
          setHasMeal(true)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [eligible, hasMeal])

  useEffect(() => {
    if (!asked && ready && settled && eligible && hasMeal) {
      setAsked(true)
      setOpen(true)
    }
  }, [asked, ready, settled, eligible, hasMeal])

  const remember = (next: InstallMemory) => {
    setMemory(next)
    writeLocal(key, JSON.stringify(next))
  }

  const lastChance = (memory.notNow ?? 0) >= 1
  return (
    <InstallSheet
      open={open}
      footer={
        lastChance
          ? 'It’s always in You → Add to home screen.'
          : 'Not now asks once more next week. It’s always in You → Add to home screen.'
      }
      onClose={(answer) => {
        setOpen(false)
        if (answer === 'installed') {
          remember({ ...memory, done: true })
          return
        }
        remember(afterNotNow(memory, Date.now()))
        toast.show({
          text: lastChance ? 'We won’t ask again. It’s in You any time' : 'We’ll ask once more next week',
        })
      }}
    />
  )
}
