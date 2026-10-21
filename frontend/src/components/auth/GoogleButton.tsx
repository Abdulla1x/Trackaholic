import { useEffect, useRef, useState } from 'react'
import { useAppearance } from '../../appearance/AppearanceContext'
import { GOOGLE_CLIENT_ID, loadGoogleId } from '../../lib/googleSignIn'

/** Google's own "Continue with Google" button.
 *
 *  Google draws it (in an iframe), not the app: its branding rules require
 *  their button, and theirs is the one people recognise. It follows the app's
 *  light or dark theme and the width of the form it sits in.
 *
 *  Renders nothing at all if Google's script won't load (blocked, offline,
 *  slow), together with its "or" rule, so the page is then exactly the email
 *  form it was before this existed. Google sign-in is an extra way in, never
 *  the only one. */
export default function GoogleButton({
  onCredential,
  divider = true,
}: {
  /** Called with the ID token once Google has signed the person in. */
  onCredential: (credential: string) => void
  /** The "or" rule under the button, for when an email form follows. */
  divider?: boolean
}) {
  const { theme } = useAppearance()
  const slot = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  // The latest handler, read when Google calls back: GIS keeps the callback
  // from initialize(), and re-initializing on every render is not supported.
  const handler = useRef(onCredential)
  useEffect(() => {
    handler.current = onCredential
  })

  useEffect(() => {
    let live = true
    loadGoogleId().then((api) => {
      if (!live) return
      const parent = slot.current
      if (!api || !parent) {
        setState('failed')
        return
      }
      api.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handler.current(response.credential),
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      parent.replaceChildren()
      api.renderButton(parent, {
        type: 'standard',
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        // Google otherwise picks the language from the visitor's location and
        // browser, and drew this in Arabic on a machine in the UAE, on a page
        // that is otherwise English. The app is English throughout.
        locale: 'en',
        // Google's limits are 200-400 px; the auth column is 380 at most.
        width: Math.min(400, Math.max(200, Math.floor(parent.clientWidth))),
      })
      setState('ready')
    })
    return () => {
      live = false
    }
  }, [theme])

  if (state === 'failed') return null
  return (
    <div className="grid gap-3.5">
      {/* Holds the button's height while the script loads, so the form
          below doesn't jump when it arrives. color-scheme: light because
          Google's frame is a light document: on a dark page the browser paints
          a frame whose scheme differs from its container's on an opaque white
          backdrop, which boxed the dark button in white. */}
      <div ref={slot} className="grid min-h-[44px] justify-items-center [color-scheme:light]" />
      {divider && (
        <div className="flex items-center gap-3 text-small text-ink-2" aria-hidden="true">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>
      )}
    </div>
  )
}
