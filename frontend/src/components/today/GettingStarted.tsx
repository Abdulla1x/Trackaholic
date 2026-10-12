import { Link } from 'react-router-dom'
import type { GettingStartedView } from '../../lib/firstUse'
import { Button } from '@/ui/button'
import { DoneIcon } from '@/ui/icons'
import { cn } from '@/lib/utils'
import { LABEL_BOX, LABEL_TITLE, LABEL_VALUE } from '@/ui/block'

const LINK =
  'font-semibold text-action underline underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

interface Step {
  title: string
  detail: string
  action: string
  done: boolean
  onAction: () => void
}

/** Getting started (first-use prototype, 2026-10-11): two steps on Today,
 *  set a target and log a first meal, instead of a tour. "Not now" shrinks it
 *  to one row; once both are done it turns into the "what's next" moment,
 *  which goes when Done is pressed. Which of those shows is
 *  lib/firstUse.ts's call. */
export default function GettingStarted({
  view,
  targetSet,
  hasMeal,
  onSetTarget,
  onLog,
  onLater,
  onShow,
  onDone,
}: {
  view: Exclude<GettingStartedView, 'hidden'>
  targetSet: boolean
  hasMeal: boolean
  onSetTarget: () => void
  onLog: () => void
  onLater: () => void
  onShow: () => void
  onDone: () => void
}) {
  const steps: Step[] = [
    {
      title: 'Set your daily target',
      detail: 'A few questions. Your weight counts as your first weigh-in.',
      action: 'Start',
      done: targetSet,
      onAction: onSetTarget,
    },
    {
      title: 'Log your first meal',
      detail: 'Describe it, say it or snap it.',
      action: 'Log',
      done: hasMeal,
      onAction: onLog,
    },
  ]
  const doneCount = steps.filter((step) => step.done).length
  const current = steps.find((step) => !step.done)

  if (view === 'row') {
    return (
      <section aria-label="Getting started" className={`flex min-h-14 items-center gap-3 border-b border-rule py-2 ${LABEL_BOX}`}>
        <h2 className={`flex-1 text-field-label text-ink-2 ${LABEL_TITLE}`}>Getting started</h2>
        <span className={`text-field-label text-ink-2 tabular-nums ${LABEL_VALUE}`}>
          {doneCount} of {steps.length}
        </span>
        <Button variant="ghost" className="h-9 px-3" onClick={onShow}>
          Show
        </Button>
      </section>
    )
  }

  if (view === 'next') {
    return (
      <section aria-label="Getting started" className={`grid gap-2.5 border-b border-rule py-3.5 animate-rise ${LABEL_BOX}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={`text-field-label text-ink-2 ${LABEL_TITLE}`}>Getting started</h2>
          <span className={`text-field-label text-ink-2 ${LABEL_VALUE}`}>Done</span>
        </div>
        <p className="text-[17px] font-bold">That’s the basics.</p>
        <p className="text-small text-ink-2">
          Progress fills in as you log. Seven weigh-ins draw your trend line; a full week of logging brings your first
          weekly review.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/progress">See Progress</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/how-it-works">How Trackaholic works</Link>
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Done
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section aria-label="Getting started" className={`grid gap-2.5 border-b border-rule py-3.5 ${LABEL_BOX}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-field-label text-ink-2 ${LABEL_TITLE}`}>Getting started</h2>
        <span className={`text-field-label text-ink-2 tabular-nums ${LABEL_VALUE}`}>
          {doneCount} of {steps.length}
        </span>
      </div>
      <ol className="grid gap-2.5">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-[4px] border-[1.5px] border-ink text-[13px] font-extrabold',
                step.done && 'bg-ink text-ground',
              )}
            >
              {step.done ? <DoneIcon size={16} /> : index + 1}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={cn(step.done && 'text-ink-2')}>
                {step.title}
                {step.done && <span className="sr-only"> (done)</span>}
              </span>
              {step === current && <span className="text-small text-ink-2">{step.detail}</span>}
            </span>
            {!step.done && (
              <Button variant={step === current ? 'primary' : 'ghost'} onClick={step.onAction}>
                {step.action}
              </Button>
            )}
          </li>
        ))}
      </ol>
      <p className="text-small text-ink-2">
        New to tracking?{' '}
        <Link to="/how-it-works" className={LINK}>
          How Trackaholic works
        </Link>
        {' · '}
        <button type="button" onClick={onLater} className={LINK}>
          Not now
        </button>
      </p>
    </section>
  )
}
