import type { ReactNode } from 'react'
import { AlertDialog as Radix } from 'radix-ui'
import { Button } from '@/ui/button'

/** A question that needs an answer before anything else happens: leaving
 *  with unsaved changes, a value that can't be used, logging out, deleting.
 *
 *  Radix's AlertDialog supplies the focus trap and scroll lock, puts focus on
 *  the safe button (Cancel), and does not close on a tap outside, so the risky
 *  choice is only ever made on purpose. Escape answers Cancel.
 *
 *  Each button has its own handler and nothing listens to Radix's
 *  onOpenChange: Action closes the dialog through it too, and a router
 *  blocker must never be reset straight after it was told to proceed.
 *
 *  `confirm` omitted makes it a notice with a single button. */
export function AlertDialog({
  open,
  title,
  children,
  cancel = 'Cancel',
  confirm,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  children: ReactNode
  cancel?: string
  confirm?: string
  onCancel: () => void
  onConfirm?: () => void
}) {
  return (
    <Radix.Root open={open}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Radix.Content onEscapeKeyDown={onCancel} className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-32px)] max-w-[360px] -translate-1/2 gap-3 rounded-[8px] border border-rule bg-ground p-[18px] text-ink">
          <Radix.Title className="text-[18px] font-bold">{title}</Radix.Title>
          <Radix.Description asChild>
            <div className="text-body text-ink-2">{children}</div>
          </Radix.Description>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Radix.Cancel asChild>
              <Button onClick={onCancel}>{cancel}</Button>
            </Radix.Cancel>
            {confirm && (
              <Radix.Action asChild>
                <Button variant="ghost" onClick={onConfirm}>
                  {confirm}
                </Button>
              </Radix.Action>
            )}
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  )
}
