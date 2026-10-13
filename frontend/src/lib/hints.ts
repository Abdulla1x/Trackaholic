// When each one-line tip (ui/hint) is worth showing. Kept apart from the
// components so the rules can be tested without a browser.

const key = (name: string) => name.trim().toLowerCase()

/** The saved-meal tip on the copy form: offered from the third log of the
 *  same name (two before this one), and never for a name that is already a
 *  saved meal or whose tip was closed on this device.
 *
 *  `count` is undefined when the API predates it; no count means no tip,
 *  never a guess. */
export function offerSavedMeal({
  count,
  name,
  savedNames,
  dismissedNames,
}: {
  count: number | undefined
  name: string
  savedNames: readonly string[]
  dismissedNames: readonly string[]
}): boolean {
  if (count === undefined || count < 2) return false
  const own = key(name)
  if (own === '') return false
  return !savedNames.some((saved) => key(saved) === own) && !dismissedNames.some((gone) => key(gone) === own)
}
