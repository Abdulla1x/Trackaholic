import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** An on/off setting as a whole row (DESIGN.md: Switches): the label and an
 *  optional detail on the left, a square switch on the right, and the entire
 *  row is the target. Square, not a pill, per the Shapes rule: nothing in the
 *  app is pill-shaped but the sheet's grab handle.
 *
 *  A button with role="switch" and aria-checked, so a screen reader hears
 *  "Carbs, switch, on". It saves the moment it is tapped (useInstantSave):
 *  there is no half-made value to hold back, so no Save bar. */
export function SwitchRow({
  label,
  detail,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: ReactNode
  detail?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex min-h-[52px] w-full items-center gap-3 py-2 text-left text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:opacity-45',
        className,
      )}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold">{label}</span>
        {detail && <span className="text-small text-ink-2">{detail}</span>}
      </span>
      {/* 44 x 26 with a 17px thumb, 3px from every edge in both positions. */}
      <span
        aria-hidden="true"
        className={cn(
          'relative h-[26px] w-11 shrink-0 rounded-control border-[1.5px] transition-colors duration-150 ease-out-expo',
          checked ? 'border-ink bg-ink' : 'border-rule bg-field',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] left-[3px] size-[17px] rounded-[3px] transition-transform duration-150 ease-out-expo motion-reduce:transition-none',
            checked ? 'translate-x-[18px] bg-ground' : 'bg-ink-2',
          )}
        />
      </span>
    </button>
  )
}
