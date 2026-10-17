import { useState, type ReactNode } from 'react'
import { AlertDialog } from '@/ui/alert-dialog'
import { Button } from '@/ui/button'
import Sheet from '@/ui/sheet'

/** One item of a list on You (a supplement, a food, a saved meal), opened
 *  from its row: its fields, Save, the item's other actions, and Delete.
 *  Chosen from a prototype over a screen per item and over the row opening
 *  in place: the list stays where it was underneath, there is no third level
 *  to go back through, and adding one opens the same sheet, empty.
 *
 *  Nothing here is a draft of the settings row. Save writes straight to the
 *  item's own endpoint, and closing the sheet forgets what was typed, the
 *  way closing any form you didn't send does.
 *
 *  The delete question is rendered inside the sheet, not beside it. Radix
 *  counts a tap on a dialog outside the sheet's tree as a tap outside the
 *  sheet, which would close it under the question. */
export default function ItemSheet({
  open,
  onOpenChange,
  title,
  children,
  error,
  onSave,
  saveLabel = 'Save',
  busy = false,
  actions,
  actionsNote,
  remove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The fields (or, for something with none, what it is). */
  children: ReactNode
  /** The last refusal, in the sheet where it happened. */
  error?: string
  /** Omitted for an item with nothing to edit. */
  onSave?: () => void
  saveLabel?: string
  busy?: boolean
  /** Other actions that save straight away (Pause, Per 100 g, Share). */
  actions?: ReactNode
  /** One line under the actions, saying what they do. */
  actionsNote?: ReactNode
  /** Omitted while adding: there is nothing to delete yet. */
  remove?: { title: string; body: ReactNode; onConfirm: () => void }
}) {
  const [asking, setAsking] = useState(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <div className="grid gap-4 pb-2">
        {children}
        {error && <p className="border-l-2 border-ink pl-3 text-small">{error}</p>}
        {onSave && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSave} disabled={busy}>
              {busy ? 'Saving…' : saveLabel}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        )}
        {(actions || remove) && (
          <div className="grid gap-2.5 border-t border-rule pt-4">
            <div className="flex flex-wrap gap-2">
              {actions}
              {remove && (
                <Button variant="ghost" onClick={() => setAsking(true)} disabled={busy}>
                  Delete…
                </Button>
              )}
            </div>
            {actionsNote && <p className="text-small text-ink-2">{actionsNote}</p>}
          </div>
        )}
      </div>
      {remove && (
        <AlertDialog
          open={asking}
          title={remove.title}
          confirm="Delete"
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            remove.onConfirm()
          }}
        >
          {remove.body}
        </AlertDialog>
      )}
    </Sheet>
  )
}
