import { cn } from '@/lib/utils'

/** The line a block shows when its data failed to load: what failed, then an
 *  underlined Retry that loads it again.
 *
 *  `role` is left to the caller. A line that replaces a block's content on its
 *  own passes `role="alert"` so it is announced; one whose error a live region
 *  already speaks (`useLiveMessage`) leaves it off, or it is read out twice. */
export default function Retry({
  text,
  onRetry,
  role,
  className,
}: {
  text: string
  onRetry: () => void
  role?: 'alert'
  className?: string
}) {
  return (
    <p role={role} className={cn('border-l-2 border-ink pl-3 text-small', className)}>
      {text}{' '}
      <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-3">
        Retry
      </button>
    </p>
  )
}
