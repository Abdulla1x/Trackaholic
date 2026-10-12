import type { ReactNode } from 'react'

/** A form field: its label, the control, and the sentence explaining it.
 *
 * The triple appears at 21 sites and was retyped every time -- `block text-sm`
 * on the wrapper, `mb-1 block text-slate-400` on the label, and where there is
 * an explanation, `mt-1 block text-xs text-ink-faint` under the control.
 *
 * The wrapper is the <label> and the control is its child, so association is
 * implicit and no htmlFor/id pair is needed. That is deliberate rather than
 * inherited: this app has 45 labels and two htmlFor, and switching to explicit
 * association would mean inventing an id at every site and changing the rendered
 * DOM everywhere for no accessibility gain -- a wrapping label is already the
 * stronger association, because it cannot go stale.
 *
 * One variant has exactly one caller and is still worth a prop, because the
 * alternative is a wrapper written out by hand that loses the triple:
 *
 *   `as="div"`  HeightField's feet-and-inches pair. Two inputs cannot share one
 *               label, so the wrapper has to be a div -- but it is the same
 *               triple, with the same label and the same caption.
 *
 * (A `size="xs"` variant went with its one caller, the old food library row.)
 *
 * No prop spread and no ref: not one of the 21 call sites passes anything else.
 * `key` is React's own and never reaches a component as a prop. */
export default function Field({
  as,
  label,
  caption,
  className = '',
  children,
}: {
  as?: 'label' | 'div'
  label: ReactNode
  /** Rendered under the control. Omit it and no element is emitted. */
  caption?: ReactNode
  className?: string
  children: ReactNode
}) {
  const Tag = as ?? 'label'
  return (
    <Tag className={['block text-sm', className].filter(Boolean).join(' ')}>
      <span className="mb-1 block text-ink-muted">{label}</span>
      {children}
      {caption !== undefined && (
        <span className="mt-1 block text-xs text-ink-faint">{caption}</span>
      )}
    </Tag>
  )
}
