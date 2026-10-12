import ScreenBar from '../../components/shell/ScreenBar'
import { CONTACT_EMAIL } from '../../lib/contact'
import Block from '@/ui/block'
import { Button } from '@/ui/button'
import { useToast } from '@/ui/toast'

/** Contact, from You -> Help: one address, to write to or to copy. Before
 *  this the address was only inside the release-notes popup. */
export default function Contact() {
  const toast = useToast()
  const [local, domain] = CONTACT_EMAIL.split('@')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL)
      toast.show({ text: 'Address copied' })
    } catch {
      toast.show({ text: 'Couldn’t copy it. Press and hold the address instead.' })
    }
  }
  return (
    <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)]">
      <ScreenBar title="Contact" back="/you" backLabel="Back to You" />
      <Block>
        <p>Questions, bugs or ideas: email me.</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-semibold [overflow-wrap:anywhere] text-action underline underline-offset-3 select-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          {/* A break opportunity before the @, so a narrow phone wraps the
              address there rather than inside "gmail". */}
          {local}
          <wbr />@{domain}
        </a>
        <div>
          <Button variant="secondary" onClick={copy}>
            Copy the address
          </Button>
        </div>
      </Block>
    </div>
  )
}
