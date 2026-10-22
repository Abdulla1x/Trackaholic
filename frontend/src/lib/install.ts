// "Add to home screen": which way this phone can do it, and when to ask.
// Pure, so the rules can be tested without a browser; lib/installEvent.ts
// holds the parts that touch one.
//
// Only Chromium browsers (Chrome, Samsung Internet, Edge, Opera) let a page
// open the phone's own install dialog, and only when they fire
// `beforeinstallprompt`. Everywhere else the popup can only show the taps:
// Safari and every other iPhone browser through Share, the rest of Android
// through the browser's menu. Chrome without Google services, as on a Huawei,
// may never fire the event, so it falls back to the menu steps.

/** How the popup helps on this browser.
 *  - `button`: the phone's own install dialog, from an Install button.
 *  - `ios-safari`, `ios-other`: Share, then Add to Home Screen. Safari keeps
 *    Share in its bar; Chrome, Edge and Firefox keep it in the address bar.
 *  - `android-menu`: the browser menu, then Add to home screen.
 *  - `in-app`: LinkedIn, Instagram and the like open links in their own
 *    browser, which can't install anything; open the page in a real one.
 *  - `none`: a computer without an install dialog. Nothing to offer. */
export type InstallRoute = 'button' | 'ios-safari' | 'ios-other' | 'android-menu' | 'in-app' | 'none'

export type Device = 'ios' | 'android' | 'computer'

/** iPadOS asks for the desktop site by default and says "Macintosh"; a Mac
 *  has no touch screen, so touch points tell the two apart. Huawei phones say
 *  Android, and HarmonyOS's own browser says so in its name. */
export function deviceOf(userAgent: string, maxTouchPoints: number): Device {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android|HarmonyOS|OpenHarmony/.test(userAgent)) return 'android'
  return 'computer'
}

/** The apps whose built-in browsers mark themselves, plus Android's generic
 *  WebView token (`; wv)`), which every in-app browser on Android carries. */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|Pinterest|Twitter|\bLine\/|; wv\)/

export function inAppBrowser(userAgent: string): boolean {
  return IN_APP.test(userAgent)
}

export function installRoute({
  userAgent,
  maxTouchPoints,
  canPrompt,
}: {
  userAgent: string
  maxTouchPoints: number
  /** A `beforeinstallprompt` event is held and not used up yet. */
  canPrompt: boolean
}): InstallRoute {
  if (inAppBrowser(userAgent)) return 'in-app'
  if (canPrompt) return 'button'
  const device = deviceOf(userAgent, maxTouchPoints)
  if (device === 'ios') return /CriOS|EdgiOS|FxiOS|OPiOS/.test(userAgent) ? 'ios-other' : 'ios-safari'
  if (device === 'android') return 'android-menu'
  return 'none'
}

/** The iPhone browser the steps name, for `ios-other`. */
export function iosBrowserName(userAgent: string): string {
  if (/EdgiOS/.test(userAgent)) return 'Edge'
  if (/FxiOS/.test(userAgent)) return 'Firefox'
  if (/OPiOS/.test(userAgent)) return 'Opera'
  return 'Chrome'
}

/** The app whose built-in browser this is, for `in-app`; null when it
 *  doesn't say. */
export function inAppName(userAgent: string): string | null {
  if (/LinkedInApp/.test(userAgent)) return 'LinkedIn'
  if (/Instagram/.test(userAgent)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'Facebook'
  if (/TikTok|musical_ly|BytedanceWebview/.test(userAgent)) return 'TikTok'
  return null
}

/** What this device remembers per account (lib/storage accountKey). */
export interface InstallMemory {
  /** How many times "Not now" (or the close button) was used. */
  notNow?: number
  /** When it last was, as epoch milliseconds. */
  lastAt?: number
  /** "I already have it" here; the server knows too, unless that call failed. */
  done?: boolean
}

/** "Not now" asks once more after a week, then never. */
export const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000
export const MAX_NOT_NOW = 2

/** Whether Today's popup may open by itself. The You row is always there
 *  instead, so every "no" here is safe. */
export function shouldAsk({
  standalone,
  installedAt,
  device,
  route,
  ready,
  memory,
  now,
}: {
  /** Opened from the home screen right now. */
  standalone: boolean
  /** The account's `installed_at`; undefined while the API predates it, which
   *  keeps the popup off rather than asking accounts it can't remember. */
  installedAt: string | null | undefined
  device: Device
  route: InstallRoute
  /** A target is set and a meal has been logged: Getting started is done. */
  ready: boolean
  memory: InstallMemory
  now: number
}): boolean {
  if (standalone || installedAt !== null) return false
  if (device === 'computer' || route === 'none') return false
  if (!ready || memory.done) return false
  const count = memory.notNow ?? 0
  if (count === 0) return true
  if (count >= MAX_NOT_NOW) return false
  return now - (memory.lastAt ?? 0) >= ASK_AGAIN_AFTER_MS
}

/** The memory after one more "Not now". */
export function afterNotNow(memory: InstallMemory, now: number): InstallMemory {
  return { ...memory, notNow: (memory.notNow ?? 0) + 1, lastAt: now }
}

export function readInstallMemory(raw: string | null): InstallMemory {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as InstallMemory) : {}
  } catch {
    return {}
  }
}
