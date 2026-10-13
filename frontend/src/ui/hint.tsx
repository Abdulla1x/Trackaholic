import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CloseIcon } from '@/ui/icons'
import { cn } from '@/lib/utils'

// The same quiet underline as the Explainer trigger: a tip is an offer, not a
// call to action, so its link must not compete with the buttons around it.
const ACTION =
  'inline-flex min-h-8 items-center text-small text-ink-2 underline underline-offset-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

/** A one-line tip about something the screen can already do: a grey sentence,
 *  one link and a close button (look A, chosen 2026-10-12). Whether it shows,
 *  and remembering that it was closed or used, belongs to the caller, because
 *  each tip has its own rule for when it is worth saying. */
export default function Hint({
  children,
  action,
  onClose,
  className,
}: {
  children: ReactNode
  /** A route (`to`) renders a link; otherwise a button. `onClick` runs either way. */
  action: { label: string; to?: string; onClick?: () => void }
  onClose: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-1', className)}>
      <p className="flex flex-1 flex-wrap items-center gap-x-2 text-small text-ink-2">
        <span className="py-1.5">{children}</span>
        {action.to ? (
          <Link to={action.to} onClick={action.onClick} className={ACTION}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={ACTION}>
            {action.label}
          </button>
        )}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide this tip"
        className="-my-1.5 grid size-11 shrink-0 place-items-center text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-action"
      >
        <CloseIcon size={16} aria-hidden />
      </button>
    </div>
  )
}
