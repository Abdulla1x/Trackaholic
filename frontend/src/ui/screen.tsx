import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The page column every screen sits in: centred, 760px at most
 *  (DESIGN.md: Layout). One place, so the measure can't drift per page. */
export const SCREEN_WIDTH = 'mx-auto max-w-[760px]'

/** A screen's outer column. A grid with one `minmax(0,1fr)` track, so a long
 *  unbroken word or a wide chart can't push the column wider than the screen
 *  (the min-content overflow a plain grid track allows). */
export default function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SCREEN_WIDTH, 'grid grid-cols-[minmax(0,1fr)]', className)}>{children}</div>
}
