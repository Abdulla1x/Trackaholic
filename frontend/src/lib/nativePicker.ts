/** Open a date input's calendar from a click anywhere on it.
 *
 * The date bar and the Log panel's "Other day" chip lay a native date input
 * invisibly over their text, so the phone's own calendar opens on a tap. A
 * phone does that on any tap; a desktop browser only opens the calendar from
 * the input's own icon, which is invisible here, so a click on the date did
 * nothing anyone could see (found on 2026-10-21, on a desktop, by someone who
 * concluded there was no way to pick a day). showPicker() opens it from
 * anywhere. Where the browser has none, its own behaviour stands. */
export function openNativePicker(event: { currentTarget: HTMLInputElement; preventDefault: () => void }): void {
  const input = event.currentTarget
  if (typeof input.showPicker !== 'function') return
  // The default action would open the picker a second time on a phone.
  event.preventDefault()
  try {
    input.showPicker()
  } catch {
    // Refused (no user activation, or a cross-origin frame): nothing to do.
  }
}
