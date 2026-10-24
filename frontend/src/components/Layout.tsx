import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAnnouncements } from '../hooks/useAnnouncements'
import { useSettings } from '../settings/SettingsContext'
import AnnouncementsModal from './AnnouncementsModal'
import DemoBanner from './demo/DemoBanner'
import NewTrackaholicPrompt from './today/NewTrackaholicPrompt'
import InstallPrompt from './install/InstallPrompt'
import { announcementsWaiting } from '../lib/dismissals'
import { isStandalone, useInstallState } from '../lib/installEvent'
import { targetIsSet } from '../lib/today'
import { asksForTrackers } from '../lib/trackers'
import { logScreen } from './log/logPanelUrl'
import MovedNotice from './MovedNotice'
import StatusBanner from './StatusBanner'
import WakingNotice from './WakingNotice'
import { RailNav, TabBar } from './shell/AppNav'
import LogPanelSlot from './log/LogPanelSlot'
import { routeKey, screenMotion, sectionFor, type ScreenMotion } from './shell/sections'
import Wordmark from './shell/Wordmark'

// A warm server answers settings in well under a second, so this never fires in
// normal use. Past it, the instance is almost certainly spinning up — and a
// blank page with no explanation is what makes a returning user assume the app
// broke rather than that it is waking. Same idea as RETRY_NOTICE_AFTER_MS in
// MealAnalyzer: say nothing until the wait stops looking normal.
const COLD_START_NOTICE_AFTER_MS = 3_000

const ENTRANCE: Record<ScreenMotion, string> = {
  fade: 'animate-route-in',
  push: 'animate-screen-push',
  back: 'animate-screen-back',
}

/** A new page starts at its top. The window is what scrolls here, and the
 *  router leaves it alone, so without this a page opened from low down on
 *  another (How Trackaholic works, from the foot of You) opened part-way down,
 *  and a tab kept the last tab's scroll.
 *
 *  Keyed on the path alone: the Log panel and Setup's questions live in the
 *  address's search, and opening either must not move the page under them.
 *  Back and forward (POP) are left alone too, as they always were. Not React
 *  Router's ScrollRestoration: keyed by entry it resets on every Log panel
 *  step, and keyed by path it puts a tab back where it was last left, which is
 *  the mid-page landing this exists to stop. A layout effect, so the reset
 *  lands before the new page's first paint and its entrance plays in view. */
function useNewPageStartsAtTop(pathname: string) {
  const navigation = useNavigationType()
  useLayoutEffect(() => {
    if (navigation !== 'POP') window.scrollTo(0, 0)
    // The path is the trigger; the navigation type is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
}

export default function Layout() {
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  useNewPageStartsAtTop(pathname)
  const section = sectionFor(pathname)
  // How the page arrives, worked out when the path changes and then held: a
  // re-render for any other reason must not swap the class and cut the
  // animation short. Adjusting state during render is React's sanctioned way
  // to follow a changing value without an effect's extra frame.
  const [entrance, setEntrance] = useState({ path: pathname, motion: screenMotion(null, pathname) })
  if (entrance.path !== pathname) setEntrance({ path: pathname, motion: screenMotion(entrance.path, pathname) })
  // /admin is the one route in this app that is genuinely desktop-only — a
  // twelve-column table of per-account counts, read by one person on a big
  // screen. Every other page is designed phone-first and 5xl is right for it,
  // but at that width the admin table was crammed into ~640px in the middle of
  // a 2000px display and had to scroll sideways to be read at all. This is the
  // one place the extra width is clearly correct rather than a preference, and
  // it is what makes the tracker columns affordable as words instead of bare
  // emoji.
  const wide = pathname === '/admin'
  // One fetch feeds both the banner and the modal.
  const announcements = useAnnouncements()
  // Whether the release notes are on screen; see AnnouncementsModal.
  const [notesShown, setNotesShown] = useState(false)
  // The shared settings fetch doubles as the cold-start probe: it is the first
  // authenticated request of the session, so if it is slow, everything is.
  const { loading: settingsLoading, settings, markInstalled } = useSettings()
  // An account with the app on a home screen tells the server once, from
  // whichever page the installed app opens on (or the moment Chromium says it
  // was just installed), so no browser tab asks it again: an iPhone's Safari
  // can't see the home screen, so this is the only way it could know.
  // `installed_at` undefined is an API that predates it: nothing to tell.
  const { installed } = useInstallState()
  const installedAt = settings?.installed_at
  // Not for a demo: it is gone in a day, and the account a visitor makes
  // afterwards would never learn the app was installed.
  const demo = user?.is_demo === true
  useEffect(() => {
    if (installedAt !== null || demo) return
    if (installed || isStandalone()) markInstalled().catch(() => {})
  }, [installedAt, installed, markInstalled, demo])
  const [coldStart, setColdStart] = useState(false)
  // When the wait actually began, which is not when the notice appears. The
  // notice is held back COLD_START_NOTICE_AFTER_MS, so a progress bar started
  // at its mount would run three seconds behind the fetch it describes — and
  // three seconds is most of the difference between the two measured boot
  // clusters. Passed to WakingNotice below.
  const waitStartedAt = useRef(Date.now())

  useEffect(() => {
    if (!settingsLoading) {
      setColdStart(false)
      return
    }
    waitStartedAt.current = Date.now()
    const timer = setTimeout(() => setColdStart(true), COLD_START_NOTICE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [settingsLoading])

  return (
    <div className="min-h-screen bg-ground desk:flex">
      {/* First thing in the tab order. Without it a keyboard user tabs through
          the nav on every single page before reaching content. Uses :focus
          rather than :focus-visible on purpose -- the link is only ever
          reachable by keyboard, and :focus is the pattern with the widest
          support for this one case. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-action focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-action-ink"
      >
        Skip to content
      </a>

      {/* Desktop: the side rail (DESIGN.md, Layout). Sticky, so the nav stays
          reachable from the bottom of a long page. Phones get TabBar below
          instead; there is no top header at any width any more -- each page
          owns its title, and Log out lives in You (UA-8). */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-[18px] border-r border-rule px-4 py-[22px] desk:flex label:border-r-[5px] label:bg-label">
        {/* self-start so the gauge spans the name, as DESIGN.md's mark draws it,
            instead of stretching to the rail's width. */}
        <Wordmark className="mb-1.5 self-start" />
        <RailNav active={section} />
        {/* Who is signed in, where the old header said it. Truncated, with the
            full address on hover; the You page states it in full. */}
        <p className="mt-auto truncate text-small text-ink-2" title={demo ? undefined : user?.email}>
          {demo ? 'Demo account' : user?.email}
        </p>
      </aside>

      {/* The bottom padding clears the fixed tab bar and its safe-area inset
          (--shell-bottom, index.css), so the last thing on a page is never
          trapped underneath it; the top one clears a notch. */}
      {/* overflow-x-clip: a pushed screen starts 28px to the right, which
          must not show a sideways scrollbar for its 260ms. clip, not hidden,
          so main does not become a scroll container and sticky children
          (a settings screen's Save bar) keep working. */}
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 flex-1 overflow-x-clip px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(var(--shell-bottom)+1.5rem)] desk:px-8 desk:py-8"
      >
        <div className={`mx-auto ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
          <DemoBanner />
          <StatusBanner banner={announcements?.banner ?? null} />
          <MovedNotice />
          {coldStart && (
            <WakingNotice
              startedAt={waitStartedAt.current}
              className="mb-4 rounded-control bg-field px-3 py-2 text-center text-small text-ink-2"
            />
          )}
          {/* The page's entrance (DESIGN.md Motion): a pushed screen slides in
              from the right, coming back slides in from the left, and a tab
              change crossfades. Keyed by routeKey (the whole path), so every
              screen's entrance plays; each settings screen holds its own
              draft and asks before it is left. Plain CSS rather than Motion, so the
              first screen never waits on Motion's features to download. */}
          <div key={routeKey(pathname)} className={ENTRANCE[entrance.motion]}>
            <Outlet />
          </div>
        </div>
      </main>

      <TabBar active={section} />
      {/* Over every page, opened by the Log button through the address. */}
      <LogPanelSlot />
      {/* Held until the account has a target, and until settings say whether
          it has one: release notes are not for someone getting started, nor
          for a visitor trying the demo. */}
      <AnnouncementsModal
        items={announcements?.items ?? []}
        hold={!settings || !targetIsSet(settings) || demo}
        onShownChange={setNotesShown}
      />
      {/* Asked on Today only, and only once the release notes (if any) are
          out of the way: two popups at once is one too many. Waits for the
          notes to load, so it can never open a frame before they do. */}
      {pathname === '/' && (
        <NewTrackaholicPrompt
          ready={announcements !== null && !notesShown && !announcementsWaiting(announcements.items)}
        />
      )}
      {/* Last in the queue: after the release notes and The new Trackaholic,
          and never over the Log panel. Never for a demo, which is gone in a
          day. */}
      {pathname === '/' && !demo && (
        <InstallPrompt
          ready={
            announcements !== null &&
            !notesShown &&
            !announcementsWaiting(announcements.items) &&
            settings !== null &&
            !asksForTrackers(settings) &&
            logScreen(search) === null
          }
        />
      )}
    </div>
  )
}
