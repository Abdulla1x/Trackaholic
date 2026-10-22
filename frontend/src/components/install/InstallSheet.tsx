import { useState, type ReactNode } from 'react'
import { inAppName, installRoute, iosBrowserName, type InstallRoute } from '../../lib/install'
import { promptInstall, useInstallState } from '../../lib/installEvent'
import { useSettings } from '../../settings/SettingsContext'
import { Button } from '@/ui/button'
import {
  AddToHomeIcon,
  BrowserMenuIcon,
  BrowserMoreIcon,
  BrowserShareIcon,
  InstallIcon,
} from '@/ui/icons'
import Sheet from '@/ui/sheet'
import { useToast } from '@/ui/toast'

const LEAD = 'Open Trackaholic in one tap, full screen, like any other app.'
const IOS_SIGN_IN =
  'On iPhone the home screen app keeps its own sign-in, so you’ll sign in once more the first time you open it.'

/** One icon inside a step's sentence, drawn in the action colour so it reads
 *  as "this one". Its name is in the sentence, so the icon is decorative. */
// An icon that ends a name stays on its line: wrapped alone it reads as a
// stray mark (the iPhone's step 2 at 390px).
function Glyph({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-flex align-[-3px] text-action">{children}</span>
}

/** The small drawings under each step (prototype option B), aria-hidden: the
 *  sentence above says everything they show. The thing to tap is outlined in
 *  the action colour; everything else is a quiet stand-in. */
function Picture({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="rounded-control border border-rule bg-field p-2 text-small">
      {children}
    </div>
  )
}

const HIGHLIGHT = 'border-2 border-action bg-action/10 font-bold text-action'

function Bar({ items }: { items: ('dot' | 'address' | ReactNode)[] }) {
  return (
    <Picture>
      <div className="flex items-center gap-2.5">
        {items.map((item, index) =>
          item === 'dot' ? (
            <span key={index} className="size-4 shrink-0 rounded-tag border-[1.5px] border-rule" />
          ) : item === 'address' ? (
            <span key={index} className="grid h-[26px] flex-1 place-items-center rounded-full bg-ground text-[11.5px] text-ink-2">
              trackaholic.app
            </span>
          ) : (
            <span key={index} className={`grid size-[34px] shrink-0 place-items-center rounded-control ${HIGHLIGHT}`}>
              {item}
            </span>
          ),
        )}
      </div>
    </Picture>
  )
}

function Menu({ rows, pick, icon }: { rows: string[]; pick: number; icon?: ReactNode }) {
  return (
    <Picture>
      <div className="grid gap-0.5">
        {rows.map((row, index) => (
          <span
            key={row}
            className={`flex min-h-[30px] items-center justify-between rounded-control px-2.5 ${index === pick ? HIGHLIGHT : 'border-2 border-transparent'}`}
          >
            {row}
            {index === pick && icon}
          </span>
        ))}
      </div>
    </Picture>
  )
}

function IosConfirm({ webApp }: { webApp: boolean }) {
  return (
    <Picture>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-ink-2">Cancel</span>
          <span className="font-semibold">Add to Home Screen</span>
          <span className={`rounded-control px-2.5 py-0.5 ${HIGHLIGHT}`}>Add</span>
        </div>
        {webApp && (
          <div className="flex items-center justify-between border-t border-rule pt-1.5">
            <span>Open as Web App</span>
            <span className="relative h-[18px] w-[30px] rounded-full bg-action">
              <span className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-ground" />
            </span>
          </div>
        )}
      </div>
    </Picture>
  )
}

function AndroidConfirm() {
  return (
    <Picture>
      <div className="grid gap-2">
        <span className="font-semibold">Add to home screen</span>
        <span className="text-ink-2">Trackaholic</span>
        <div className="flex items-center justify-end gap-3.5">
          <span className="text-ink-2">Cancel</span>
          <span className={`rounded-control px-2.5 py-0.5 ${HIGHLIGHT}`}>Add</span>
        </div>
      </div>
    </Picture>
  )
}

interface Step {
  text: ReactNode
  picture: ReactNode
}

function steps(route: InstallRoute, userAgent: string): Step[] {
  const icon = 18
  switch (route) {
    case 'ios-safari':
      return [
        {
          text: <>Tap <b>Share</b><Glyph><BrowserShareIcon size={icon} aria-hidden /></Glyph> in Safari's bar. Don't see it? Tap ••• first.</>,
          picture: <Bar items={['dot', 'dot', <BrowserShareIcon key="share" size={icon} />, 'dot', 'dot']} />,
        },
        {
          text: <>Scroll down and tap <span className="whitespace-nowrap"><b>Add to Home Screen</b><Glyph><AddToHomeIcon size={icon} aria-hidden /></Glyph></span></>,
          picture: <Menu rows={['Copy', 'Add to Reading List', 'Add Bookmark', 'Add to Home Screen']} pick={3} icon={<AddToHomeIcon size={16} />} />,
        },
        { text: <>Leave <b>Open as Web App</b> on, then tap Add.</>, picture: <IosConfirm webApp /> },
      ]
    case 'ios-other':
      return [
        {
          text: <>Tap <b>Share</b><Glyph><BrowserShareIcon size={icon} aria-hidden /></Glyph> at the right of the address bar.</>,
          picture: <Bar items={['address', <BrowserShareIcon key="share" size={icon} />]} />,
        },
        {
          text: <>Scroll down and tap <span className="whitespace-nowrap"><b>Add to Home Screen</b><Glyph><AddToHomeIcon size={icon} aria-hidden /></Glyph></span></>,
          picture: <Menu rows={['Copy', 'Add to Reading List', 'Add to Home Screen', 'Find on Page']} pick={2} icon={<AddToHomeIcon size={16} />} />,
        },
        { text: <>Tap <b>Add</b>.</>, picture: <IosConfirm webApp={false} /> },
      ]
    case 'android-menu':
      return [
        {
          text: <>Tap the menu<Glyph><BrowserMenuIcon size={icon} weight="bold" aria-hidden /></Glyph> at the top right.</>,
          picture: <Bar items={['address', 'dot', <BrowserMenuIcon key="menu" size={icon} weight="bold" />]} />,
        },
        {
          text: <>Tap <b>Add to home screen</b> (some browsers call it Install app).</>,
          picture: <Menu rows={['New tab', 'History', 'Downloads', 'Add to home screen']} pick={3} />,
        },
        { text: <>Tap <b>Add</b>.</>, picture: <AndroidConfirm /> },
      ]
    case 'in-app': {
      const app = inAppName(userAgent)
      return [
        {
          text: <>Tap<Glyph><BrowserMoreIcon size={icon} weight="bold" aria-hidden /></Glyph> at the top of {app ? `${app}’s page` : 'the page'}.</>,
          picture: <Bar items={['dot', 'address', <BrowserMoreIcon key="more" size={icon} weight="bold" />]} />,
        },
        {
          text: <>Tap <b>Open in browser</b> (or Open in Safari or Chrome), then add it from there.</>,
          picture: <Menu rows={['Share via…', 'Copy link', 'Open in browser']} pick={2} />,
        },
      ]
    }
    default:
      return []
  }
}

function lead(route: InstallRoute, userAgent: string): string {
  switch (route) {
    case 'button':
      return `${LEAD} Nothing to download from a store.`
    case 'ios-safari':
      return `${LEAD} Safari does it in three taps:`
    case 'ios-other':
      return `${LEAD} ${iosBrowserName(userAgent)} does it in three taps:`
    case 'android-menu':
      return `${LEAD} Your browser does it from its menu:`
    case 'in-app': {
      const app = inAppName(userAgent)
      return `${app ? `${app}’s` : 'This app’s'} built-in browser can’t add apps to your home screen. Open this page in your own browser first:`
    }
    default:
      return LEAD
  }
}

/** "Add to home screen" (prototype 2026-10-22, option B): the popup Today
 *  opens once after the first meal, and the You row opens any time.
 *
 *  Where the browser can install by itself (Chromium's install event) it has
 *  an Install button that opens the phone's own dialog; everywhere else it
 *  shows the taps, with a small drawing of each. Which one is decided on
 *  every render, so a dialog dismissed here (the event is used up) turns the
 *  button into the menu steps rather than a button that does nothing.
 *
 *  `onClose('not-now')` is Not now, the close button, Escape or the scrim;
 *  `onClose('installed')` follows an install or "I already have it", both
 *  of which the server is told about so no browser tab asks again. */
export default function InstallSheet({
  open,
  onClose,
  footer,
}: {
  open: boolean
  onClose: (answer: 'not-now' | 'installed') => void
  footer?: string
}) {
  const { canPrompt } = useInstallState()
  const { markInstalled } = useSettings()
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const userAgent = navigator.userAgent
  const route = installRoute({ userAgent, maxTouchPoints: navigator.maxTouchPoints, canPrompt })
  const ios = route === 'ios-safari' || route === 'ios-other'

  const installed = (text: string) => {
    // The installed app reports itself too (Layout), so a failure here only
    // means one more ask in a browser tab, never a lost install.
    markInstalled().catch(() => {})
    toast.show({ text })
    onClose('installed')
  }

  const install = async () => {
    if ((await promptInstall()) === 'accepted') installed('Trackaholic is on your home screen')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
    } catch {
      toast.show({ text: `Couldn’t copy. The address is ${window.location.host}` })
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose('not-now')
        setCopied(false)
      }}
      title={route === 'in-app' ? 'Open in your browser' : 'Add to home screen'}
      desk="center"
    >
      <div className="grid gap-4 py-2">
        <p>{lead(route, userAgent)}</p>

        {route === 'button' && (
          <div className="flex items-center gap-3 rounded-control bg-field p-3">
            <img src="/pwa-192.png" alt="" width={48} height={48} className="size-12 rounded-[11px]" />
            <span className="grid gap-0.5">
              <span className="font-bold">Trackaholic</span>
              <span className="text-small text-ink-2">{window.location.host}</span>
            </span>
          </div>
        )}

        {route !== 'button' && (
          <ol className="grid gap-3.5">
            {steps(route, userAgent).map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-[26px] shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-[13px] font-bold"
                >
                  {index + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-2 pt-0.5">
                  <p>{step.text}</p>
                  {step.picture}
                </div>
              </li>
            ))}
          </ol>
        )}

        {ios && <p className="rounded-control bg-field px-3 py-2.5 text-small text-ink-2">{IOS_SIGN_IN}</p>}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onClose('not-now')}>
            Not now
          </Button>
          {route === 'button' && (
            <Button className="flex-1" onClick={install}>
              <InstallIcon size={18} aria-hidden />
              Install
            </Button>
          )}
          {route === 'in-app' && (
            <Button className="flex-1" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          )}
        </div>
        {route !== 'in-app' && (
          <button
            type="button"
            onClick={() => installed('Got it. We won’t ask again')}
            className="justify-self-center px-3 py-2.5 font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            I already have it
          </button>
        )}
        {footer && <p className="text-center text-small text-ink-2">{footer}</p>}
      </div>
    </Sheet>
  )
}
