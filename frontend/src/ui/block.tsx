import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** In the Label style every block is a small nutrition label: a white box
 *  with a 2px ink border on the grey ground, its heading in heavy type over a
 *  5px rule (0b's look-b). Exported so the sections that are not Blocks
 *  (Today's trackers, Progress, the review, Setup) box themselves the same
 *  way. Each is a no-op in the Fields style. */
export const LABEL_BOX = 'label:mt-3 label:border-2 label:border-ink label:bg-label label:px-3 label:pt-2 label:pb-3'
export const LABEL_HEAD = 'label:border-b-[5px] label:border-ink label:pb-1'
export const LABEL_TITLE =
  'label:text-[20px] label:leading-tight label:font-black label:normal-case label:tracking-[-0.02em] label:text-ink'
/** The value at the right of a heading: bold, not shouting. */
export const LABEL_VALUE = 'label:text-[14px] label:font-extrabold label:normal-case label:tracking-normal label:text-ink'

/** A quiet section (DESIGN.md: Blocks and rows): no border, no background,
 *  a hairline along the bottom, and an optional label with a value at the
 *  right, both in the small wide capitals. Boxes are for things you press.
 *  In the Label style it is boxed (LABEL_BOX above). */
export default function Block({
  label,
  value,
  children,
  className,
}: {
  label?: string
  value?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-rule py-3.5', LABEL_BOX, className)}>
      {label && (
        <div className={cn('flex items-baseline justify-between gap-3', LABEL_HEAD)}>
          <h2 className={cn('text-field-label text-ink-2', LABEL_TITLE)}>{label}</h2>
          {value !== undefined && <span className={cn('text-field-label text-ink-2 tabular-nums', LABEL_VALUE)}>{value}</span>}
        </div>
      )}
      {children}
    </section>
  )
}
