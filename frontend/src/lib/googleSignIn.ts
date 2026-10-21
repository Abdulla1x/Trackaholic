/** Google Identity Services (GIS): the script behind the "Continue with
 *  Google" button.
 *
 *  Loaded only by the pages that show the button, never in the app shell, so
 *  nobody who never sees it downloads it. The client ID is the real one by
 *  default because it isn't secret (the server checks tokens against the same
 *  value); VITE_GOOGLE_CLIENT_ID overrides it at build time. */
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '671287093003-pt9gb0nk5uhls0i246022m7ph33kg10m.apps.googleusercontent.com'

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

/** Give up after this long. The button is an extra way in, never the only
 *  one: a blocked or slow script must leave the email form usable rather
 *  than a page waiting on Google. */
const LOAD_TIMEOUT_MS = 8000

/** The slice of the GIS API the app uses. */
export interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string }) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

let loading: Promise<GoogleIdApi | null> | null = null

/** GIS, or null if it couldn't be loaded. Loads the script once per page. */
export function loadGoogleId(): Promise<GoogleIdApi | null> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const done = (api: GoogleIdApi | null) => {
      window.clearTimeout(timer)
      // A failure is not cached: the next page that wants the button tries
      // again, which is what a flaky connection needs.
      if (!api) loading = null
      resolve(api)
    }
    const timer = window.setTimeout(() => done(null), LOAD_TIMEOUT_MS)
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => done(window.google?.accounts?.id ?? null)
    script.onerror = () => {
      script.remove()
      done(null)
    }
    document.head.appendChild(script)
  })
  return loading
}
