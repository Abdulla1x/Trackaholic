import { Button } from '@/ui/button'

/** The bar that holds unsaved changes on a settings screen (DESIGN.md: Save
 *  bar). Pinned to the bottom of the screen, just above the phone's tab bar,
 *  so the way to lose an edit is never simply scrolling past a button.
 *
 *  Only typed numbers, and the choices on the same form, wait for it.
 *  Switches and chips that stand alone save the moment they are tapped, so the
 *  bar showing up is itself the sign that something is still waiting. */
export function SaveBar({
  saving,
  error,
  onSave,
  onUndo,
}: {
  saving: boolean
  error?: string
  onSave: () => void
  onUndo: () => void
}) {
  return (
    <div className="sticky bottom-(--shell-bottom) z-20 -mx-4 mt-auto flex items-center gap-3 border-t border-rule bg-field px-4 py-2.5 desk:bottom-0 desk:mx-0 desk:px-7 label:border-t-[5px] label:bg-label">
      <p className="min-w-0 flex-1 text-small font-semibold">{error || 'Unsaved changes'}</p>
      <Button variant="ghost" onClick={onUndo} disabled={saving}>
        Undo
      </Button>
      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
