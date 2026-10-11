import { useRef, type ReactNode } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Dialog } from 'radix-ui'
import { CloseIcon } from '@/ui/icons'
import { DURATION, EASE_IN, SPRING } from '@/lib/motion'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

const ICON_BUTTON =
  'grid size-11 shrink-0 place-items-center rounded-control text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action'

/** A short panel over the page, for a choice that belongs to the page
 *  underneath (DESIGN.md: Elevation, Motion). The Log panel's look and motion,
 *  sized to its content:
 *
 *  - phones: a bottom sheet, as tall as it needs up to 92% of the screen;
 *  - desktop, `desk="side"`: a 480px panel from the right, like Log;
 *  - desktop, `desk="center"`: a 440px dialog in the middle, for a question
 *    asked once rather than a tool opened on purpose.
 *
 *  Radix's Dialog supplies the focus trap, Escape and scroll lock. Focus goes
 *  back to whatever opened it: Radix only does that for its own Trigger, and
 *  these open from state, so it is remembered here (as the Log panel does). `closable={false}` takes away the
 *  close button, Escape and the scrim tap, for a question that needs an
 *  answer (its buttons close it). */
export default function Sheet({
  open,
  onOpenChange,
  title,
  desk = 'side',
  closable = true,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  desk?: 'side' | 'center'
  closable?: boolean
  children: ReactNode
}) {
  const wide = useMediaQuery('(min-width: 900px)')
  const center = wide && desk === 'center'
  const side = wide && desk === 'side'
  const hidden = side ? { x: '100%' } : center ? { opacity: 0, scale: 0.97 } : { y: '100%' }
  const exitEase = { duration: DURATION.base, ease: EASE_IN }

  // Read during render, before the focus trap's effect moves focus inside.
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  if (open && !wasOpen.current && document.activeElement instanceof HTMLElement) {
    opener.current = document.activeElement
  }
  wasOpen.current = open

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div
                className="fixed inset-0 z-50 bg-black/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.2 } }}
                exit={{ opacity: 0, transition: { duration: DURATION.base } }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
              }}
              onEscapeKeyDown={closable ? undefined : (event) => event.preventDefault()}
              onPointerDownOutside={closable ? undefined : (event) => event.preventDefault()}
            >
              <m.div
                className={cn(
                  'fixed z-50 flex flex-col bg-ground text-ink focus:outline-none',
                  side
                    ? 'inset-y-0 right-0 h-full w-[480px] border-l border-rule'
                    : center
                      ? // Centred by margins, not translate: Motion owns `transform` here.
                      'inset-0 m-auto h-fit max-h-[90dvh] w-[440px] rounded-[10px] border border-rule'
                      : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-sheet border-t border-rule',
                )}
                initial={hidden}
                animate={{ x: 0, y: 0, opacity: 1, scale: 1, transition: SPRING.panel }}
                exit={{ ...hidden, transition: exitEase }}
              >
                {!wide && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-rule" />}
                <header className="flex min-h-[54px] shrink-0 items-center gap-1.5 border-b border-rule px-2">
                  <span className="size-11 shrink-0" />
                  <Dialog.Title className="flex-1 truncate text-center text-title">{title}</Dialog.Title>
                  {closable ? (
                    <Dialog.Close aria-label="Close" className={ICON_BUTTON}>
                      <CloseIcon size={22} aria-hidden />
                    </Dialog.Close>
                  ) : (
                    <span className="size-11 shrink-0" />
                  )}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+20px)] desk:px-7">
                  {children}
                </div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
