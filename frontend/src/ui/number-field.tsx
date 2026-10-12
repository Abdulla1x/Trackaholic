import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { FIELD } from '@/ui/field'

/** A short field with its label above and its unit beside it, in the
 *  condensed number face (DESIGN.md: Inputs). For Setup's answers and the
 *  settings screens' typed numbers. */
export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode = 'decimal',
  className,
}: {
  id: string
  label: string
  unit?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
  className?: string
}) {
  return (
    <label htmlFor={id} className={cn('grid min-w-0 content-start gap-1.5', className)}>
      <span className="text-small text-ink-2">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <input
          id={id}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className={cn(FIELD, 'w-[120px] min-w-0 shrink text-field-number')}
        />
        {unit && <span className="text-ink-2">{unit}</span>}
      </span>
    </label>
  )
}

/** A NumberField for a number held in a settings draft.
 *
 *  The text is kept here while it is typed, and only a parseable number goes
 *  up. Rendering the draft's number straight back would turn a cleared box
 *  into "0" under the cursor, and "1." into "1". When the number changes from
 *  outside (Undo, a save that moved it), the text follows. Empty sends
 *  `null`, which each screen maps to its own meaning (off, no goal, derive),
 *  unless the number is `required`. */
export function SettingNumber({
  value,
  onValue,
  required = false,
  onBlur,
  ...props
}: Omit<Parameters<typeof NumberField>[0], 'value' | 'onChange'> & {
  value: number | null
  onValue: (value: number | null) => void
  /** A number that cannot be empty (a daily goal): clearing the box leaves
   *  the draft alone, and leaving the field puts the number back. */
  required?: boolean
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => {
    setText((now) => (parse(now) === value ? now : value === null ? '' : String(value)))
  }, [value])
  return (
    <NumberField
      {...props}
      value={text}
      onChange={(next) => {
        setText(next)
        const parsed = parse(next)
        if (parsed !== undefined && !(required && parsed === null)) onValue(parsed)
      }}
      onBlur={() => {
        if (required && parse(text) == null) setText(value === null ? '' : String(value))
        onBlur?.()
      }}
    />
  )
}

/** '' -> null; a number -> that number; anything else (half-typed "1.") ->
 *  undefined, which leaves the draft alone until it parses. */
function parse(text: string): number | null | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}
