import { NavLink, Outlet, useLocation } from 'react-router-dom'
import AlertDialog from '../components/AlertDialog'
import Modal from '../components/ui/Modal'
import { useSettingsDraft } from '../settings/useSettingsDraft'
import type { SettingsPanel } from './settings/panelContext'
import { SETTINGS_TABS, settingsTabFor } from './settings/tabs'
import Button from '../components/ui/Button'
import { useLiveMessage } from '../hooks/useLiveMessage'

/** The Settings shell: one draft, one Save, five addresses.
 *
 * This page used to be a single scroll of twelve sections with the Save button
 * stranded in the middle of it -- three immediate-write sections and the whole
 * Account block rendered *below* the button that saves the ones above. The
 * concrete failure that fell out of that shape: edit your body profile, scroll
 * past Save to add a supplement, navigate away, and the profile edit is gone
 * with nothing having said so.
 *
 * Routes rather than an accordion or useState tabs, for a reason from the code
 * rather than from taste: the dashboard deep-links into the calorie planner, and
 * an accordion would open that link collapsed while tab state would break
 * back/forward. Every section now has an address.
 *
 * The draft lives here, above the router outlet, so switching tabs cannot lose
 * an unsaved edit -- only leaving /settings can.
 */
export default function Settings() {
  // The draft, the leave guard and the out-of-range refusal live in
  // useSettingsDraft. Moving between Settings tabs is NOT blocked -- the draft
  // lives in this shell, above the tab outlet, so it survives that -- only
  // leaving /settings is.
  const { loadError, draft, dirty, status, error, rejected, setRejected, targetsKey, blocker, update, guard, save } =
    useSettingsDraft((from, to) => from.startsWith('/settings') && !to.startsWith('/settings'))
  // Not one of this component's own messages -- it comes from the shared
  // settings fetch and REPLACES the whole page below. Announced anyway,
  // because the page transitions from "Loading…" to it without any other
  // signal, and someone waiting is told nothing at all otherwise.
  useLiveMessage(loadError)
  useLiveMessage(error)
  // The Save bar's ✓ has no text a screen reader can reach, and 'saved' on
  // its own does not say what was saved. The error branch sets `error`, which
  // the line above announces, so this covers only the success transition.
  useLiveMessage(status === 'saved' ? 'Settings saved' : '')
  const tab = settingsTabFor(useLocation().pathname)

  if (!draft) {
    return <p className="text-slate-400">{loadError || 'Loading…'}</p>
  }
  const settings = draft

  const context: SettingsPanel = {
    settings,
    update,
    guard,
    onRejected: setRejected,
    targetsKey,
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          {/* "Settings" is the eyebrow, not the heading. Each panel owns the
              <h1>, so heading navigation lands on five distinct names instead
              of the same word five times. */}
          <p className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
            Settings
          </p>
          <h1 className="text-2xl font-bold">{tab.title}</h1>
        </div>
        {/* Off the tab bar on purpose -- see the inBar note in tabs.ts. A link
            keeps it one tap away without putting account deletion next to the
            tab you were reaching for. */}
        <div className="flex flex-col items-end gap-1">
          <NavLink
            to="/settings/account"
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-emerald-300' : 'text-ink-faint hover:text-slate-300'}`
            }
          >
            Account &amp; data →
          </NavLink>
          {/* The optional guide; You is rebuilt in phase 3 with a Help section. */}
          <NavLink to="/how-it-works" className="text-sm text-ink-faint hover:text-slate-300">
            How it works →
          </NavLink>
        </div>
      </header>

      <nav
        aria-label="Settings sections"
        className="grid grid-cols-4 gap-1 rounded-card border border-line bg-surface p-1"
      >
        {SETTINGS_TABS.filter((item) => item.inBar).map((item) => (
          <NavLink
            key={item.path}
            to={`/settings/${item.path}`}
            className={({ isActive }) =>
              `rounded-control px-2 py-2 text-center text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-ink-muted hover:bg-raised hover:text-ink'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={context} />

      {/* Pinned to the bottom of the viewport rather than sitting at the end of
          the page, which is the whole fix: the old button was ten sections down
          with more sections below it, so the way to lose an edit was simply to
          scroll past it.

          It appears for any unsaved change to the settings row, on whichever of
          the three deferred tabs you are standing -- NOT only for the tab that
          made the change. Per-tab visibility would hide a pending Body edit the
          moment you clicked Trackers, which is the same silent loss moved from
          scrolling to tab-switching. Ticking a supplement or correcting a food
          still summons nothing, because neither touches this row.

          bottom sits on top of the phone's tab bar (--shell-bottom, which the
          shell keeps equal to the bar's height plus its safe-area inset); on
          desktop there is no bottom bar and it floats 1rem up. */}
      {tab.deferred && (dirty || status !== 'idle') && (
        <div className="sticky bottom-(--shell-bottom) z-20 desk:bottom-4">
          <div className="flex items-center justify-between gap-3 rounded-card border border-line-strong bg-raised px-4 py-3 shadow-lg shadow-slate-950/50">
            <p className="min-w-0 text-sm">
              {status === 'saved' ? (
                <span className="text-emerald-400">Saved ✓</span>
              ) : status === 'error' ? (
                <span className="text-rose-400">{error}</span>
              ) : (
                <span className="text-ink-muted">You have unsaved changes</span>
              )}
            </p>
            {status !== 'saved' && (
              <Button
                onClick={save}
                disabled={status === 'saving'}
                className="shrink-0 px-5 py-2"
              >
                {status === 'saving' ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        // Stay is first, so the dialog's own focus rule lands on it (Enter
        // keeps the draft) and Escape keeps it too; leaving has to be chosen on
        // purpose. No autoFocus: with it the dialog would record Stay as its
        // opener, and focus could not return to the link that was tapped.
        <Modal role="alertdialog" label="Leave without saving?" onClose={() => blocker.reset()}>
          <h2 className="mb-2 text-lg font-semibold">Leave without saving?</h2>
          <p className="text-sm text-slate-300">
            Your changes to these settings haven't been saved yet.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => blocker.reset()} className="px-5 py-2">
              Stay
            </Button>
            <button
              onClick={() => blocker.proceed()}
              className="rounded-control border border-line-strong px-5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
            >
              Leave without saving
            </button>
          </div>
        </Modal>
      )}

      {rejected && (
        <AlertDialog
          title="That value can't be used"
          message={rejected}
          onClose={() => setRejected(null)}
        />
      )}
    </div>
  )
}
