// Teaching the AI box to be used well (UA-25, decided 2026-10-10: a nudge at the
// moment of a photo-only estimate, plus one dismissible tip card).
//
// Why it is worth a screen element at all, measured on the model evaluation:
// on 14 weighed meals, every model tried read a photo alone low on every one,
// by a median of 53-64% of the true calories, most likely because oil, butter
// and sauces barely show. With a note, estimates of other meals were ~4-6%
// from their saved values, but those began as AI estimates: agreement, not accuracy;
// no weighed meal has been run with a note yet. Asking is still the cheapest
// accuracy there is.

/** What a photo hides most often, as the chips the question offers. */
export const HIDDEN_EXTRAS = ['Oil', 'Butter', 'Sauce', 'Sugar or honey', 'Nut butter'] as const

/** Ask about hidden extras only when photos are the whole story: with any
 *  note at all, the user has already said what they want to say, and a
 *  question then would be a nag. */
export function shouldAskAboutHidden(photos: number, note: string): boolean {
  return photos > 0 && note.trim() === ''
}

/** The note with the picked extras added as one plain line the model reads,
 *  "Also in it: oil and sauce.", kept in the box so the user sees exactly
 *  what was sent and can add amounts next time. */
export function noteWithExtras(note: string, picks: readonly string[]): string {
  if (picks.length === 0) return note
  const names = picks.map((pick) => pick.toLowerCase())
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  const line = `Also in it: ${list}.`
  return note.trim() ? `${note.trim()}\n${line}` : line
}
