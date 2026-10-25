import { useId, useState } from 'react'
import { caveatLines, mainOutCopy } from '../../lib/lighterAi'
import type { MainAIOut } from '../../types'
import { Button } from '@/ui/button'

interface Props {
  out: MainAIOut
  note: string
  photos: number
  busy: boolean
  /** `restOfToday`: the tickbox was ticked, so the yes lasts until the reset. */
  onUse: (restOfToday: boolean) => void
  onNotNow: () => void
}

/** The offer of the lighter AI while the main AI is out: why, how far to trust
 *  it, and a yes that can last the rest of today. Chosen from a prototype
 *  (option B, 2026-10-25), with the short wording.
 *
 *  Set off by the ink rule the panel uses for every notice, never red (the
 *  No Red Rule): the main AI being out is news, not an error the user made. */
export default function LighterAiOffer({ out, note, photos, busy, onUse, onNotNow }: Props) {
  const headId = useId()
  const [restOfToday, setRestOfToday] = useState(false)
  const { head, line } = mainOutCopy(out)
  return (
    <div
      role="group"
      aria-labelledby={headId}
      className="grid grid-cols-[minmax(0,1fr)] gap-2.5 border-l-2 border-ink bg-field p-3.5"
    >
      <h4 id={headId} className="font-bold">
        {head}
      </h4>
      <p className="text-small text-ink-2">{line}</p>
      <p className="text-small">
        <b>A lighter AI can estimate it now.</b>
      </p>
      {caveatLines(note, photos).map((text, index) => (
        <p key={text} className={index === 0 ? 'text-small' : 'text-small text-ink-2'}>
          {text}
        </p>
      ))}
      <div className="grid gap-1">
        <p className="text-[14.5px] font-bold">To help it</p>
        <ul className="grid list-disc gap-1 pl-4.5 text-small">
          <li>
            <b>Grams for each item.</b> “150 g chicken” beats any photo.
          </li>
          <li>
            <b>Say the extras.</b> Oil, butter, sauce, sugar.
          </li>
          <li>
            <b>Attach saved foods.</b> Their numbers count as facts.
          </li>
        </ul>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-small">
        <input
          type="checkbox"
          checked={restOfToday}
          onChange={(e) => setRestOfToday(e.target.checked)}
          className="size-5 shrink-0 accent-[var(--action)]"
        />
        Use it for the rest of today without asking
      </label>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onUse(restOfToday)} disabled={busy} className="flex-1">
          Use the lighter AI
        </Button>
        <Button variant="ghost" onClick={onNotNow} disabled={busy}>
          Not now
        </Button>
      </div>
      <p className="text-small text-ink-2">The estimate is labelled Lighter AI.</p>
    </div>
  )
}
