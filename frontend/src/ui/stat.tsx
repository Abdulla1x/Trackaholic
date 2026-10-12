import type { ReactNode } from 'react'

/** A number in a fixed field, its label above (DESIGN.md: "put every number in
 *  a field with a label above it"). Laid side by side in a StatGrid, with a
 *  hairline between neighbours. */
export function Stat({ label, children, unit }: { label: string; children: ReactNode; unit?: ReactNode }) {
  return (
    // In the Label style a stat is a label row: the name at the left in bold,
    // the number at the right.
    <div className="grid min-w-0 content-start gap-1.5 py-2.5 label:flex label:items-baseline label:justify-between label:gap-3 label:py-1">
      <span className="text-field-label text-ink-2 label:text-[15px] label:font-bold label:normal-case label:tracking-normal label:text-ink">
        {label}
      </span>
      <span className="text-field-number leading-none label:text-[20px] label:font-extrabold">
        {children}
        {unit && <small className="ml-1 text-[14px] font-semibold text-ink-2 [font-stretch:100%]">{unit}</small>}
      </span>
    </div>
  )
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 [&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:border-rule [&>*:nth-child(even)]:pl-4 [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-rule label:grid-cols-1 label:[&>*:nth-child(even)]:border-l-0 label:[&>*:nth-child(even)]:pl-0 label:[&>*+*]:border-t">
      {children}
    </div>
  )
}
