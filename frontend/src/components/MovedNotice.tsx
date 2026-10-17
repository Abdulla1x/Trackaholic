import { Button } from '@/ui/button'
import { NEW_ORIGIN, isOldAddress } from '../lib/moved'

/** On the old address only: Trackaholic lives at trackaholic.app now.
 *
 * The status notice's look (a ruled note in ink, StatusBanner), with the way
 * to the new address as a button, since going there is the one thing to do.
 * Not dismissable: everyone on the old address needs to move, and an installed
 * copy would otherwise go on working until the old address is switched off.
 *
 * Shown in the signed-in shell and on the sign-in pages alike, because people
 * arrive at either. A plain link, not a router one: the new address is another
 * site, where this browser holds no sign-in. */
export default function MovedNotice() {
  if (!isOldAddress(window.location.hostname)) return null
  return (
    <section
      aria-labelledby="moved-title"
      className="mb-4 grid gap-3 border-l-2 border-ink bg-field py-3 pr-3 pl-3.5 text-small"
    >
      <div className="grid gap-1">
        <h2 id="moved-title" className="font-semibold text-ink">
          Trackaholic has moved to trackaholic.app
        </h2>
        <p className="text-ink-2">
          Everything you've logged is there. Open the new address and sign in with the same email
          and password; if you've forgotten it, reset it there. The look you picked is kept per
          address, so choose it again in You. If you added this app to your home screen, add the
          new one too, then remove this one.
        </p>
      </div>
      <Button asChild variant="primary" className="justify-self-start">
        <a href={NEW_ORIGIN}>Open trackaholic.app</a>
      </Button>
    </section>
  )
}
