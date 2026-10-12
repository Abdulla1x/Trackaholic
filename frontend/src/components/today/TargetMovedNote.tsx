import { Link } from 'react-router-dom'
import type { TargetMove } from '../../lib/targetMoves'
import { Button } from '@/ui/button'

const n = (value: number) => Math.round(value).toLocaleString()

function sentence(move: TargetMove): string {
  const moved = `Your target moved from ${n(move.from)} to ${n(move.to)} kcal.`
  switch (move.kind) {
    case 'measured':
      return `Your burn is now measured from your weigh-ins and meals: ${n(move.measured)} kcal a day, not the ${n(move.estimated)} the formula estimated. ${moved}`
    case 'goal':
      return `You’ve reached your goal weight, so your target now keeps you there. ${moved}`
    case 'limit':
      return move.reason
        ? `${move.reason} ${moved}`
        : `The limit that was holding your target back no longer applies. ${moved}`
  }
}

/** One plain line under the calories when something named moved an
 *  automatic target (decided 2026-10-11, audit D6), until "Got it". */
export default function TargetMovedNote({ move, onDismiss }: { move: TargetMove; onDismiss: () => void }) {
  return (
    <section aria-label="Your target moved" className="grid gap-2.5 border-b border-rule py-3.5 animate-rise">
      <p className="text-small">
        <b>Your target moved.</b> {sentence(move)}
      </p>
      <div className="flex flex-wrap gap-2">
        {move.kind === 'goal' && (
          <Button asChild variant="secondary">
            <Link to="/you/body">Set a new goal</Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to="/how-it-works/target" state={{ from: '/' }}>
            How is this worked out?
          </Link>
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </section>
  )
}
