/** DESIGN.md (Components -> Inputs): the field ground, a 1.5px rule border,
 *  5px radius, 44px tall. Focus turns the border the action colour; keyboard
 *  focus adds the 2px action outline. */
/** A full-width text field on desktop stops at 360px: a password or a filter
 *  doesn't need the whole 760px column (UA-37). Phones keep the full width.
 *  Not part of FIELD, because the number fields are already 120px. */
export const FIELD_DESK_WIDTH = 'desk:max-w-[360px]'

export const FIELD =
  'min-h-11 w-full rounded-control border-[1.5px] border-rule bg-field px-3 text-body text-ink placeholder:text-ink-2 focus:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action label:border-2 label:border-ink label:bg-label label:font-semibold'
