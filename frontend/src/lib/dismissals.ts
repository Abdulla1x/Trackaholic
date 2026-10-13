// Which notices this device has already seen. Per-device rather than per-account
// on purpose: it's a UI preference, not user data, and it needs no table and no
// request. Reads and writes go through lib/storage, which swallows the throw
// Safari's private mode raises — a failed dismissal should re-show a note, never
// break the page.

import { readLocal, writeLocal } from './storage.ts'

const SEEN_KEY = 'macros_seen_announcements'
const BANNER_KEY = 'macros_dismissed_banner'

export function seenAnnouncementIds(): string[] {
  const raw = readLocal(SEEN_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Has this device ever recorded a dismissal at all?
 *
 * Distinct from `seenAnnouncementIds().length === 0`, which cannot tell a brand
 * new device from one that has dismissed nothing: absence of the key means both.
 * That distinction is the whole reason the first-run modal could not be capped
 * safely -- capping the display while the fetch still returns every note turns
 * onboarding into dismiss-three-reload-repeat.
 *
 * NOTE `readLocal` returns null both when the key is absent AND when localStorage
 * throws, which it does in Safari private mode. That browser therefore reads as
 * "first run" on every load: it sees the welcome each time and never the full
 * backlog. That is the safe direction to fail in, and it is deliberate. */
export function hasEverSeenAnnouncements(): boolean {
  return readLocal(SEEN_KEY) !== null
}

/** Whether the release-notes popup has something to show on this device:
 *  any note not yet seen. A device's first run shows none (they are marked
 *  seen silently). Read synchronously, so a popup that must not open on top
 *  of the notes can wait for them first. */
export function announcementsWaiting(items: readonly { id: string }[]): boolean {
  if (items.length === 0) return false
  if (!hasEverSeenAnnouncements()) return false
  const seen = seenAnnouncementIds()
  return items.some((item) => !seen.includes(item.id))
}

export function markAnnouncementsSeen(ids: string[]) {
  const merged = new Set([...seenAnnouncementIds(), ...ids])
  writeLocal(SEEN_KEY, JSON.stringify([...merged]))
}

// Keyed by the banner's own text: editing the notice in the hosting dashboard
// makes it a new notice, which should reappear even for someone who dismissed
// the last one.
export function isBannerDismissed(banner: string): boolean {
  return readLocal(BANNER_KEY) === banner
}

export function dismissBanner(banner: string) {
  writeLocal(BANNER_KEY, banner)
}

// The AI box's tip card (UA-25): shown until dismissed, then never again on
// this device. A failed read shows it again, which is the harmless direction.
const AI_TIPS_KEY = 'trackaholic_ai_tips_dismissed'

export function areAiTipsDismissed(): boolean {
  return readLocal(AI_TIPS_KEY) !== null
}

export function dismissAiTips() {
  writeLocal(AI_TIPS_KEY, '1')
}

// Today's weekly review card: hidden on this device after its close button or
// after the review is opened, until the next week. The key holds the end date
// of the week that was hidden, so a new week has a different end and the card
// comes back by itself, with nothing to clear.
const REVIEW_KEY = 'trackaholic_review_hidden'

export function reviewHidden(weekEnd: string): boolean {
  return readLocal(REVIEW_KEY) === weekEnd
}

export function hideReview(weekEnd: string) {
  writeLocal(REVIEW_KEY, weekEnd)
}

// The one-line tips (ui/hint): each is hidden on this device for good once it
// is closed or its link is used. A failed read shows the tip again, which is
// the harmless direction.
export type HintKey = 'steps' | 'saved_foods'

const hintKey = (hint: HintKey) => `trackaholic_hint_${hint}`

export function isHintDismissed(hint: HintKey): boolean {
  return readLocal(hintKey(hint)) !== null
}

export function dismissHint(hint: HintKey) {
  writeLocal(hintKey(hint), '1')
}

// The saved-meal tip is about one meal, so closing it for "Porridge" must not
// close it for "Chicken rice". Names are kept trimmed and lower-cased, matching
// how the server treats a meal's name as one name across case.
const SAVED_MEAL_HINT_KEY = 'trackaholic_hint_saved_meal'

export function dismissedSavedMeals(): string[] {
  const raw = readLocal(SAVED_MEAL_HINT_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : []
  } catch {
    return []
  }
}

export function dismissSavedMeal(name: string) {
  const merged = new Set([...dismissedSavedMeals(), name.trim().toLowerCase()])
  writeLocal(SAVED_MEAL_HINT_KEY, JSON.stringify([...merged]))
}
