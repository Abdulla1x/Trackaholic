import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'
import { GOOGLE_CLIENT_ID, loadGoogleId, type GoogleIdApi } from '../../lib/googleSignIn'
import GoogleG from './GoogleG'

/** "Continue with Google", drawn in the app's own field style.
 *
 *  Two layers in one spot. The face is the app's: the field ground, the rule
 *  border, the app's type and corners, the Label style's square ink box, so
 *  the button belongs to the form around it in every palette and theme.
 *  Over it, invisible, sits Google's own button (an iframe Google draws).
 *  Every tap and every keyboard focus lands on Google's, so Google still runs
 *  the whole sign-in and hands back the same ID token as before; only the
 *  drawing changed. Google's guidelines allow a button of your own as long as
 *  it keeps the full-colour G and the words, which the face does.
 *
 *  Google's frame takes the pointer and the focus, so the face can't react
 *  to its own :hover, :active or :focus-visible. Hover is read from the
 *  wrapper (group-hover); the focus ring and the pressed tone are worked out
 *  from focus moving into the frame (below).
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
  /** The "or" rule above the button, for when it follows the email form. */
  divider?: boolean
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const [api, setApi] = useState<GoogleIdApi | null>(null)
  const [failed, setFailed] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [focused, setFocused] = useState(false)
  // The latest handler, read when Google calls back: GIS keeps the callback
  // from initialize(), and re-initializing on every render is not supported.
  const handler = useRef(onCredential)
  useEffect(() => {
    handler.current = onCredential
  })

  useEffect(() => {
    let live = true
    loadGoogleId().then((loaded) => {
      if (!live) return
      if (!loaded) {
        setFailed(true)
        return
      }
      loaded.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => handler.current(response.credential),
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      })
      setApi(loaded)
    })
    return () => {
      live = false
    }
  }, [])

  // Google's button is drawn at a fixed width, and it has to cover the whole
  // face or part of the face would do nothing when tapped. So it is drawn
  // again whenever the face changes width (a phone turned sideways, a
  // resized window).
  useEffect(() => {
    const parent = slot.current
    if (!api || !parent) return
    let drawnWidth = 0
    const draw = () => {
      const width = Math.floor(parent.clientWidth)
      if (width === drawnWidth) return
      drawnWidth = width
      parent.replaceChildren()
      api.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        // 44px tall, the face's height.
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        // Google otherwise picks the language from the visitor's location and
        // browser, and drew this in Arabic on a machine in the UAE, on a page
        // that is otherwise English. Invisible now, but it also names the
        // button for screen readers, so it still matters.
        locale: 'en',
        // Google's limits are 200-400 px; the auth column is 380 at most.
        width: Math.min(400, Math.max(200, width)),
      })
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [api])

  // Focus inside Google's frame is invisible to CSS on this page: neither the
  // frame nor the wrapper matches :focus or :focus-within while Google's
  // button has it. All the page learns is that its own window lost focus, and
  // a tap and a Tab both cause that. The last key the page saw tells them
  // apart: after a Tab, draw the focus ring; otherwise it was a tap or a
  // click, so flash the pressed tone, as every other button does.
  useEffect(() => {
    if (!api) return
    let lastTab = -Infinity
    let timer = 0
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') lastTab = performance.now()
    }
    const onBlur = () => {
      // Read after the browser has moved focus into the frame.
      window.setTimeout(() => {
        if (!wrapper.current?.contains(document.activeElement)) return
        if (performance.now() - lastTab < 500) {
          setFocused(true)
          return
        }
        setPressed(true)
        window.clearTimeout(timer)
        timer = window.setTimeout(() => setPressed(false), 150)
      })
    }
    // Focus back on the page itself: Tab out of the frame, or a tap elsewhere.
    const onFocus = () => setFocused(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.clearTimeout(timer)
    }
  }, [api])

  if (failed) return null
  const ready = api !== null
  return (
    <div className="grid gap-3.5">
      {divider && (
        <div className="flex items-center gap-3 text-small text-ink-2" aria-hidden="true">
          <span className="h-px flex-1 bg-rule" />
          or
          <span className="h-px flex-1 bg-rule" />
        </div>
      )}
      <div ref={wrapper} className="group relative grid">
        <div
          aria-hidden="true"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            // The field ground: it reads as one of the boxes of the form above it.
            'h-11 w-full gap-2.5 bg-field',
            'group-hover:bg-[color-mix(in_oklab,var(--ink)_5%,var(--field))]',
            focused && 'outline-2 outline-offset-2 outline-action',
            pressed &&
              // Important, or the hover tone (a more specific selector) hides it
              // under a mouse.
              'scale-[0.98] bg-[color-mix(in_oklab,var(--ink)_12%,var(--field))]! duration-[40ms] motion-reduce:scale-100',
            // Held back until Google's button is in place over it, so it never
            // looks pressable while a tap would do nothing.
            !ready && 'opacity-45',
          )}
        >
          <GoogleG />
          Continue with Google
        </div>
        {/* Google's button, invisible, over the face. */}
        <div ref={slot} className="absolute inset-0 grid place-items-center overflow-hidden opacity-0" />
      </div>
    </div>
  )
}
