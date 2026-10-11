import { cn } from '@/lib/utils'

/** A placeholder block (DESIGN.md: Skeletons): track-coloured, with a slow
 *  shimmer passing over it, and no spinner. Callers give it its size, so the
 *  shapes stand where the content will land and the page does not jump.
 *  Decorative: the page says "loading" once, not per block. Under reduced
 *  motion the shimmer stops and the block is simply there (index.css). */
export default function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block overflow-hidden rounded-[4px] bg-track',
        'after:absolute after:inset-0 after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-ground/55 after:to-transparent',
        className,
      )}
    />
  )
}
