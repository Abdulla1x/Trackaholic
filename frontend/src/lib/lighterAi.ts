// The lighter AI's offer on the Log panel: which caveat it carries, what it
// says about the main AI, and a yes that lasts the rest of the day. Pure apart
// from the storage helpers at the end, so the wording and the rules are tested
// without a browser; components/log/LighterAiOffer.tsx draws them.
//
// When the main AI (the Flash chain) is out, the server offers
// gemini-3.5-flash-lite instead. It counts toward the user's own daily
// estimates but not the app's shared 40 (backend/app/routers/ai.py).

import type { MainAIOut } from '../types.ts'
import { CLOCK, addDays, localIsoDate } from './dates.ts'
import { accountKey, readLocal, removeLocal, writeLocal } from './storage.ts'

// The amount check from AI round 2 (macros-ab tools/round2_score.py `gate`),
// ported as it is: a note passes when every item names an amount. Strict on
// purpose ("200 g cooked, no skin" fails on "no skin"); here it only picks the
// stronger caveat, it never withholds the offer.
const NUM_WORDS = new Set(
  'a an one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand half quarter dozen'.split(
    ' ',
  ),
)
const UNITS = new Set(['g', 'kg', 'ml', 'l', 'cup', 'cups', 'tbsp', 'tsp', 'slice', 'slices', 'piece', 'pieces', 'egg', 'eggs'])
const isNum = (token: string) => NUM_WORDS.has(token) || /^\d+(?:[.,/]\d+)?$/.test(token)

/** The note split into items, the way the gate reads it. */
export function noteItems(note: string): string[] {
  return note
    .split(/,|\n|\+|\s+and\s+|\s+with\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Does this item name an amount: a number before a unit, or a leading count? */
export function quantified(item: string): boolean {
  const tokens = item.toLowerCase().match(/\d+(?:[.,/]\d+)?|[a-z]+/g) ?? []
  for (let i = 0; i < tokens.length; i++) {
    if (isNum(tokens[i] ?? '') && tokens.slice(i + 1, i + 3).some((unit) => UNITS.has(unit))) return true
  }
  return tokens.length > 1 && isNum(tokens[0] ?? '') && !UNITS.has(tokens[1] ?? '')
}

/** True when every item in the note has an amount (and there is one). */
export function gatePasses(note: string): boolean {
  const items = noteItems(note)
  return items.length > 0 && items.every(quantified)
}

/** The caveat's lines. With an amount on every item the lighter AI did about
 *  as well as the main AI in round 2; from a photo or a name alone neither did. */
export function caveatLines(note: string, photos: number): string[] {
  if (gatePasses(note)) {
    return ["It's a smaller model. With weights in the note it's about as close as the main AI. Check the portions before you save."]
  }
  const alone = photos > 0 && !note.trim() ? 'a photo' : 'a name'
  return [
    `It's a smaller model. With weights it's about as close as the main AI; from ${alone} alone it can be off by a quarter or more, and so can the main AI.`,
    'Photos and names leave the portion to a guess. On my own breakfasts, a photo or a name alone came out about half too low on every model.',
  ]
}

/** "11:00 AM tomorrow": a time on the reader's own clock, and its day.
 *  `locale` exists for the tests; the app doesn't pass it. */
export function backLabel(backAt: string, now: Date = new Date(), locale?: string): string {
  const back = new Date(backAt)
  const time = back.toLocaleTimeString(locale, CLOCK)
  const day = localIsoDate(back)
  const today = localIsoDate(now)
  if (day <= today) return `${time} today`
  if (day === addDays(today, 1)) return `${time} tomorrow`
  return `${time} on ${back.toLocaleDateString(locale, { weekday: 'long' })}`
}

/** What the card and the declined line say about the main AI. */
export function mainOutCopy(out: Pick<MainAIOut, 'reason' | 'back_at'>, now: Date = new Date(), locale?: string) {
  if (out.reason === 'busy') {
    return {
      head: 'The main AI is overloaded right now',
      line: 'Google is turning requests away. You can try again in a few minutes.',
    }
  }
  const back = `It's back at ${backLabel(out.back_at, now, locale)}.`
  return {
    head: 'The main AI is out for today',
    line:
      out.reason === 'app_limit'
        ? `The app's shared daily AI allowance is used up. ${back}`
        : `Google's free daily limit for it is used up across the app. ${back}`,
  }
}

/** A yes to the lighter AI for the rest of today: until the main AI's reset. */
export interface DayYes {
  until: string
  reason: MainAIOut['reason']
}

/** The line on the panel while the yes lasts. When Google is only busy the main
 *  AI may be back sooner, so that line names the time and nothing else. */
export function dayYesLine(yes: DayYes, now: Date = new Date(), locale?: string): string {
  const until = backLabel(yes.until, now, locale)
  return yes.reason === 'busy'
    ? `Using the lighter AI until ${until}.`
    : `Using the lighter AI until the main AI is back at ${until}.`
}

/** Remembered on this device, per account (like lib/recentTemplates.ts): a second
 *  account on the same phone has not said yes. */
const dayYesKey = (userId: number) => accountKey('lighterUntil', userId)

/** The yes, if it still lasts; an expired one is forgotten. */
export function readDayYes(userId: number, now: Date = new Date()): DayYes | null {
  const raw = readLocal(dayYesKey(userId))
  if (!raw) return null
  try {
    const yes = JSON.parse(raw) as Partial<DayYes>
    if (typeof yes.until === 'string' && typeof yes.reason === 'string' && new Date(yes.until) > now) {
      return { until: yes.until, reason: yes.reason }
    }
  } catch {
    /* Unreadable: forgotten below, like an expired one. */
  }
  removeLocal(dayYesKey(userId))
  return null
}

export function writeDayYes(userId: number, out: Pick<MainAIOut, 'reason' | 'back_at'>): DayYes {
  const yes = { until: out.back_at, reason: out.reason }
  writeLocal(dayYesKey(userId), JSON.stringify(yes))
  return yes
}

export function clearDayYes(userId: number) {
  removeLocal(dayYesKey(userId))
}
