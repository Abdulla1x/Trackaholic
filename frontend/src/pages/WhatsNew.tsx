import { useEffect, useState } from 'react'
import { NoteList } from '../components/AnnouncementBody'
import ScreenBar from '../components/shell/ScreenBar'
import { useAnnouncements } from '../hooks/useAnnouncements'
import Block from '@/ui/block'
import Screen from '@/ui/screen'

// useAnnouncements returns null both while the fetch is in flight and when it
// failed -- it fails silently by design, because everywhere else the notes are
// decoration. On this page they are the entire content, so a permanent
// "Loading…" would be a claim that is false half the time. Same shape as
// Layout's COLD_START_NOTICE_AFTER_MS: say nothing until the wait stops looking
// normal, then say something true.
const GAVE_UP_AFTER_MS = 8_000

export default function WhatsNew() {
  const announcements = useAnnouncements()
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    if (announcements !== null) {
      setGaveUp(false)
      return
    }
    const timer = setTimeout(() => setGaveUp(true), GAVE_UP_AFTER_MS)
    return () => clearTimeout(timer)
  }, [announcements])

  const items = announcements?.items ?? []

  return (
    <Screen>
      <ScreenBar title="What's new" back="/you" backLabel="Back to You" />
      <Block>
        <p className="text-small text-ink-2">
          Every release note, newest first. The pop-up only ever shows the newest few, so this
          is where the rest live.
        </p>
      </Block>
      <Block>
        {announcements === null ? (
          <p className="text-small text-ink-2">
            {gaveUp ? 'Could not load the release notes just now. Try again later.' : 'Loading…'}
          </p>
        ) : items.length === 0 ? (
          <p className="text-small text-ink-2">No release notes yet.</p>
        ) : (
          <NoteList heading="h2" items={items} />
        )}
      </Block>
    </Screen>
  )
}
